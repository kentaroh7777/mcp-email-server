#!/usr/bin/env npx tsx

/**
 * Email Server Health Monitor (HTTP版)
 * FastMCPのHTTP Streamingサーバーに対してJSON-RPCをPOSTして疎通確認を行う
 */

// Node.js v18+ のグローバル fetch を使用
import { setTimeout as delay } from 'node:timers/promises';
import net from 'node:net';

interface FailureAnalysis {
  reason: string;
  solution: string;
  command?: string;
}

function analyzeFailure(testName: string, errorMessage: string): FailureAnalysis {
  const isGmailAccount = testName.includes('(') && !testName.includes('_h_fpo_com');
  const isImapAccount = testName.includes('_h_fpo_com');
  
  // Gmail認証エラーの分析
  if (isGmailAccount && errorMessage.includes('Authentication failed')) {
    if (errorMessage.includes('invalid_grant')) {
      return {
        reason: 'Gmailリフレッシュトークンが期限切れまたは無効です',
        solution: 'Gmail認証を再実行してください',
        command: 'npx tsx scripts/gmail-desktop-auth.mjs'
      };
    } else if (errorMessage.includes('invalid_client')) {
      return {
        reason: 'GmailクライアントIDまたはシークレットが無効です',
        solution: '.envファイルのGMAIL_CLIENT_IDとGMAIL_CLIENT_SECRETを確認してください',
      };
    } else {
      return {
        reason: 'Gmail認証エラーが発生しています',
        solution: 'Gmail認証を再実行するか、アカウント設定を確認してください',
        command: 'npx tsx scripts/gmail-desktop-auth.mjs'
      };
    }
  }
  
  // IMAP認証エラーの分析
  if (isImapAccount && errorMessage.includes('connection')) {
    if (errorMessage.includes('AUTHENTICATIONFAILED')) {
      return {
        reason: 'IMAPアカウントのパスワードが間違っているか期限切れです',
        solution: '.envファイルのIMAP_PASSWORD_<account>を確認し、暗号化し直してください',
        command: 'npx tsx scripts/encrypt-password.mjs'
      };
    } else if (errorMessage.includes('connection refused') || errorMessage.includes('timeout')) {
      return {
        reason: 'IMAPサーバーへの接続ができません',
        solution: '.envファイルのIMAP_HOST_<account>とIMAP_PORT_<account>を確認してください'
      };
    } else {
      return {
        reason: 'IMAP接続エラーが発生しています',
        solution: 'アカウント設定とネットワーク接続を確認してください'
      };
    }
  }
  
  // 一般的なエラー
  if (errorMessage.includes('Account not found')) {
    return {
      reason: 'アカウントが見つかりません',
      solution: '.envファイルにアカウント設定が正しく記載されているか確認してください'
    };
  }
  
  return {
    reason: '不明なエラーが発生しています',
    solution: 'ログを確認し、必要に応じてサポートに連絡してください'
  };
}

function getServerUrl(): string {
  // 環境変数があれば優先。なければデフォルトのHTTPエンドポイントを使用
  // ~/.cursor/mcp.json でも http://localhost:3456/mcp が設定されている前提
  return process.env.MCP_EMAIL_SERVER_URL || 'http://localhost:3456/mcp';
}

let activeSessionId: string | undefined;

function parseHostPortFromUrl(urlStr: string): { host: string; port: number } {
  try {
    const u = new URL(urlStr);
    const host = u.hostname || 'localhost';
    const port = u.port ? Number(u.port) : 3456;
    return { host, port };
  } catch {
    return { host: 'localhost', port: 3456 };
  }
}

async function checkTcpOpen(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port });
    let done = false;
    const onDone = (ok: boolean) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(ok);
    };
    const timer = setTimeout(() => onDone(false), timeoutMs);
    socket.on('connect', () => {
      clearTimeout(timer);
      onDone(true);
    });
    socket.on('error', () => {
      clearTimeout(timer);
      onDone(false);
    });
  });
}

async function checkPing(host: string, port: number, timeoutMs = 2000): Promise<{ ok: boolean; status?: number; error?: string }>{
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${host}:${port}/ping`, { method: 'GET', signal: controller.signal });
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function initializeSession(timeoutMs: number = 10000): Promise<{ success: boolean; error?: string }>{
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = getServerUrl();
    const initializeRequest = {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        clientInfo: { name: 'health-check', version: '1.0.0' },
        capabilities: {
          tools: true,
          prompts: true,
          resources: false,
          logging: false,
          roots: { listChanged: false }
        }
      }
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' },
      body: JSON.stringify(initializeRequest),
      signal: controller.signal
    });
    // セッションIDはレスポンスヘッダーに付与される
    const sid = res.headers.get('mcp-session-id') || res.headers.get('Mcp-Session-Id') || undefined;
    if (!sid) {
      const body = await res.text();
      return { success: false, error: body || `No session id. HTTP ${res.status}` };
    }
    activeSessionId = sid;
    return { success: true };
  } catch (err: any) {
    const timedOut = err?.name === 'AbortError';
    return { success: false, error: timedOut ? 'initialize timed out' : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function runHealthCheck(): Promise<{
  success: boolean;
  results: any[];
  errors: string[];
  failures: { testName: string; analysis: FailureAnalysis }[];
}> {
  const results: any[] = [];
  const errors: string[] = [];
  const failures: { testName: string; analysis: FailureAnalysis }[] = [];

  // 0. サーバー状態チェック
  const serverUrl = getServerUrl();
  const { host, port } = parseHostPortFromUrl(serverUrl);
  console.log(`🔍 Server config`);
  console.log(`  URL: ${serverUrl}`);
  console.log(`  Host: ${host}`);
  console.log(`  Port: ${port}`);

  const tcpOpen = await checkTcpOpen(host, port, 1500);
  console.log(`  TCP listen: ${tcpOpen ? '✅' : '❌'}`);
  const ping = await checkPing(host, port, 1500);
  console.log(`  /ping: ${ping.ok ? `✅ (${ping.status})` : '❌'}`);

  // 起動直後の猶予
  if (!tcpOpen || !ping.ok) {
    console.log('  ⏳ retry after short delay...');
    await delay(500);
  }

  // 1. list_accountsツールを呼び出して全てのアカウント名を取得
  console.log(`🔄 list_accounts をテスト中...`);
  const listAccountsCommand = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'list_accounts', arguments: {} }
  };
  const listAccountsResult = await runMCPCommand(listAccountsCommand, 10000);
  
  const status = listAccountsResult.success ? '✅' : (listAccountsResult.timedOut ? '⏰' : '❌');
  console.log(`  ${status} ${listAccountsResult.success ? '成功' : (listAccountsResult.timedOut ? 'タイムアウト' : '失敗')}`);
  
  results.push({
    test: 'list_accounts',
    success: listAccountsResult.success,
    timedOut: listAccountsResult.timedOut
  });
  if (!listAccountsResult.success || listAccountsResult.timedOut) {
    const errorMsg = listAccountsResult.error || 'Timeout';
    errors.push(`list_accounts: ${errorMsg}`);
    failures.push({
      testName: 'list_accounts',
      analysis: analyzeFailure('list_accounts', errorMsg)
    });
  }

  let allAccountNames: string[] = [];
  if (listAccountsResult.success && listAccountsResult.response?.result) {
    try {
      // FastMCPのcontentにテキストJSONで入るパターンへ対応
      const result = listAccountsResult.response.result;
      // 1) content経由
      if (Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item && typeof item.text === 'string') {
            try {
              const parsed = JSON.parse(item.text);
              if (parsed && Array.isArray(parsed.accounts)) {
                allAccountNames.push(...parsed.accounts.map((acc: any) => acc.name));
              }
            } catch {/* ignore parse error per item */}
          }
        }
      }
      // 2) 従来の直接accounts
      if (Array.isArray((result as any).accounts)) {
        allAccountNames.push(...(result as any).accounts.map((acc: any) => acc.name));
      }
      // 重複除去
      allAccountNames = Array.from(new Set(allAccountNames)).filter(Boolean);
    } catch (e) {
      errors.push(`list_accounts: JSON parse error: ${e}`);
    }
  }

  // 2. その他のテストコマンドを動的に生成
  const dynamicTestCommands: { name: string; command: any; timeout?: number }[] = [];

  // 統合ツール (list_accountsは既に実行済み)
  dynamicTestCommands.push(
    {
      name: 'get_account_stats',
      command: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'get_account_stats', arguments: {} }
      }
    },
    // search_all_emailsは別途 test-search-all.sh でテスト
    // プロセス管理の制約によりmonitor-health.tsからは除外
  );

  // 各アカウントに対する軽量テスト（全アカウント）
  for (const accountName of allAccountNames) {
    // test_connection（軽量で安全、認証状態をチェック）
    dynamicTestCommands.push({
      name: `test_connection (${accountName})`,
      command: {
        jsonrpc: '2.0',
        id: results.length + 1,
        method: 'tools/call',
        params: {
          name: 'test_connection',
          arguments: { account_name: accountName }
        }
      }
    });

    // list_emails（1件のみ、軽量、実際の接続テスト）
    dynamicTestCommands.push({
      name: `list_emails (${accountName})`,
      command: {
        jsonrpc: '2.0',
        id: results.length + 1,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: accountName, limit: 1 }
        }
      }
    });
  }

  // 3. 動的に生成されたコマンドを実行
  for (const test of dynamicTestCommands) {
    try {
      console.log(`🔄 ${test.name} をテスト中...`);
      const timeout = test.timeout || 10000; // カスタムタイムアウトまたはデフォルト10秒
      const result = await runMCPCommand(test.command, timeout);
      
      const status = result.success ? '✅' : (result.timedOut ? '⏰' : '❌');
      console.log(`  ${status} ${result.success ? '成功' : (result.timedOut ? 'タイムアウト' : '失敗')}`);
      
      results.push({
        test: test.name,
        success: result.success,
        timedOut: result.timedOut
      });

      if (!result.success || result.timedOut) {
        const errorMsg = result.error || 'Timeout';
        errors.push(`${test.name}: ${errorMsg}`);
        failures.push({
          testName: test.name,
          analysis: analyzeFailure(test.name, errorMsg)
        });
      }
    } catch (error) {
      console.log(`  ❌ エラー: ${error}`);
      const errorMsg = String(error);
      errors.push(`${test.name}: ${errorMsg}`);
      failures.push({
        testName: test.name,
        analysis: analyzeFailure(test.name, errorMsg)
      });
      results.push({
        test: test.name,
        success: false,
        timedOut: false
      });
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
    failures
  };
}

async function runMCPCommand(command: any, timeoutMs: number = 10000): Promise<{
  success: boolean;
  response?: any;
  error?: string;
  timedOut: boolean;
}> {
  // 1) セッション未確立なら初期化
  if (!activeSessionId) {
    const init = await initializeSession(timeoutMs);
    if (!init.success) {
      return { success: false, error: init.error || 'Failed to initialize session', timedOut: false };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = getServerUrl();

  const doPost = async (): Promise<{ ok: boolean; responseText: string; status: number; error?: string }>=>(
    new Promise(async (resolve) => {
      try {
        const headers: Record<string, string> = { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' };
        if (activeSessionId) headers['mcp-session-id'] = activeSessionId;
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(command),
          signal: controller.signal
        });
        const text = await res.text();
        resolve({ ok: res.ok, responseText: text, status: res.status });
      } catch (e: any) {
        resolve({ ok: false, responseText: '', status: 0, error: String(e) });
      }
    })
  );

  try {
    // 2) 通常POST
    let { ok, responseText, status, error } = await doPost();
    // 3) セッションエラーなら再初期化して一度だけリトライ
    if (!ok && (responseText.includes('No valid session ID') || responseText.includes('No sessionId') || status === 400)) {
      const init = await initializeSession(timeoutMs);
      if (!init.success) {
        return { success: false, error: init.error || responseText || 'Failed to re-initialize session', timedOut: false };
      }
      ({ ok, responseText, status, error } = await doPost());
    }

    // FastMCPのHTTP StreamingはSSEで返る場合がある
    // SSEの本文例: "event: message\n" + "data: {json}\n\n"
    const parseSseFirstJson = (s: string): any | null => {
      const lines = (s || '').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          try {
            return JSON.parse(payload);
          } catch {
            continue;
          }
        }
        // 一部実装ではプレーンJSONのみ返す場合もある
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            return JSON.parse(trimmed);
          } catch {
            // noop
          }
        }
      }
      return null;
    };

    if (!ok && !responseText) {
      return { success: false, error: error || `HTTP ${status}`, timedOut: false };
    }

    const candidate = parseSseFirstJson(responseText);
    if (!candidate) {
      return { success: false, error: `HTTP error: Unexpected response format`, timedOut: false };
    }

    const response = candidate;
    const hasError = response.error !== undefined;
    let applicationLevelError = false;
    let errorMessage = '';
    if (hasError) {
      errorMessage = response.error.message;
      applicationLevelError = true;
    } else if (response.result && response.result.status === 'failed') {
      errorMessage = response.result.testResult || 'Application level failure';
      applicationLevelError = true;
    }
    return { success: !applicationLevelError, response, error: applicationLevelError ? errorMessage : undefined, timedOut: false };
  } catch (err: any) {
    const timedOut = err?.name === 'AbortError';
    return { success: false, error: timedOut ? 'Command timed out' : `HTTP error: ${String(err)}`, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  try {
    console.log('🏥 Running comprehensive health check...\n');
    console.log('Testing all accounts and core tools (timeout: 10s each)\n');
    
    const health = await runHealthCheck();
  
  console.log(`\n📊 Overall Status: ${health.success ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  console.log(`Tests Passed: ${health.results.filter(r => r.success).length}/${health.results.length}`);
  
  if (health.errors.length > 0) {
    console.log('\n🚨 エラー詳細:');
    health.errors.forEach(error => console.log(`  - ${error}`));
    
    if (health.failures.length > 0) {
      console.log('\n🔧 推奨対処法:');
      
      // Gmailアカウントの問題をグループ化
      const gmailFailures = health.failures.filter(f => f.testName.includes('(') && !f.testName.includes('_h_fpo_com'));
      const imapFailures = health.failures.filter(f => f.testName.includes('_h_fpo_com'));
      const otherFailures = health.failures.filter(f => !f.testName.includes('(') && !f.testName.includes('_h_fpo_com'));
      
      if (gmailFailures.length > 0) {
        console.log('\n  📧 Gmail アカウント:');
        const uniqueGmailSolutions = new Set();
        gmailFailures.forEach(failure => {
          console.log(`    • ${failure.testName}: ${failure.analysis.reason}`);
          if (!uniqueGmailSolutions.has(failure.analysis.solution)) {
            uniqueGmailSolutions.add(failure.analysis.solution);
            console.log(`      💡 対処法: ${failure.analysis.solution}`);
            if (failure.analysis.command) {
              console.log(`      📋 コマンド: ${failure.analysis.command}`);
            }
          }
        });
      }
      
      if (imapFailures.length > 0) {
        console.log('\n  📬 IMAP アカウント:');
        imapFailures.forEach(failure => {
          console.log(`    • ${failure.testName}: ${failure.analysis.reason}`);
          console.log(`      💡 対処法: ${failure.analysis.solution}`);
          if (failure.analysis.command) {
            console.log(`      📋 コマンド: ${failure.analysis.command}`);
          }
        });
      }
      
      if (otherFailures.length > 0) {
        console.log('\n  ⚙️  その他:');
        otherFailures.forEach(failure => {
          console.log(`    • ${failure.testName}: ${failure.analysis.reason}`);
          console.log(`      💡 対処法: ${failure.analysis.solution}`);
          if (failure.analysis.command) {
            console.log(`      📋 コマンド: ${failure.analysis.command}`);
          }
        });
      }
    }
  }

  console.log('\n📋 Detailed Results:');
  
  // 統合ツール
  console.log('\n🔗 統合ツール:');
  ['list_accounts', 'get_account_stats'].forEach(toolName => {
    const result = health.results.find(r => r.test === toolName);
    if (result) {
      const status = result.success ? '✅' : (result.timedOut ? '⏰' : '❌');
      console.log(`  ${status} ${result.test}`);
    }
  });
  
  // search_all_emailsは別途テスト
  console.log('\n💡 search_all_emails は別途テスト:');
  console.log('  📝 ./scripts/test-search-all.sh を実行してください');
  
  // アカウント別テスト結果
  console.log('\n📧 アカウント別テスト結果:');
  health.results
    .filter(r => r.test.includes('(') && r.test.includes(')'))
    .forEach(result => {
      const status = result.success ? '✅' : (result.timedOut ? '⏰' : '❌');
      console.log(`  ${status} ${result.test}`);
    });

    process.exit(health.success ? 0 : 1);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}