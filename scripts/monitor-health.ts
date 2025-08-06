#!/usr/bin/env npx tsx

/**
 * Email Server Health Monitor
 * 全ツールの応答性をチェックする包括的ヘルスチェック
 */

import { spawn } from 'child_process';
import path from 'path';

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

const serverPath = path.join(process.cwd(), 'scripts/run-email-server.ts');

async function runHealthCheck(): Promise<{
  success: boolean;
  results: any[];
  errors: string[];
  failures: { testName: string; analysis: FailureAnalysis }[];
}> {
  const results: any[] = [];
  const errors: string[] = [];
  const failures: { testName: string; analysis: FailureAnalysis }[] = [];

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
      const data = listAccountsResult.response.result;
      if (data && Array.isArray(data.accounts)) {
        allAccountNames = data.accounts.map((acc: any) => acc.name);
      }
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
  return new Promise((resolve) => {
    const child = spawn('timeout', [`${Math.ceil(timeoutMs/1000)}s`, 'npx', 'tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // timeoutコマンドを使用しているので、内部タイムアウトは不要
    // const timeout = setTimeout(() => {
    //   timedOut = true;
    //   child.kill('SIGTERM');
    //   resolve({
    //     success: false,
    //     error: 'Command timed out',
    //     timedOut: true
    //   });
    // }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        if (code === 124) {
          // timeoutコマンドのタイムアウト終了コード
          resolve({
            success: false,
            error: 'Command timed out',
            timedOut: true
          });
        } else if (stdout.trim()) {
          // 複数のJSONレスポンスがある場合、最初のものを使用
          const lines = stdout.trim().split('\n');
          const firstLine = lines[0];
          const response = JSON.parse(firstLine);
          
          // エラーレスポンスの場合は失敗として扱う
          const hasError = response.error !== undefined;
          
          // レスポンス内容のステータスもチェック（test_connectionなど）
          let applicationLevelError = false;
          let errorMessage = '';
          
          if (hasError) {
            errorMessage = response.error.message;
            applicationLevelError = true;
          } else if (response.result && response.result.status === 'failed') {
            errorMessage = response.result.testResult || 'Application level failure';
            applicationLevelError = true;
          }
          
          resolve({
            success: !applicationLevelError,
            response,
            error: applicationLevelError ? errorMessage : undefined,
            timedOut: false
          });
        } else {
          resolve({
            success: false,
            error: `No output. Code: ${code}, Stderr: ${stderr}`,
            timedOut: false
          });
        }
      } catch (error) {
        resolve({
          success: false,
          error: `JSON parse error: ${error}. Stdout: ${stdout}, Stderr: ${stderr}`,
          timedOut: false
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        error: `Process error: ${error.message}`,
        timedOut: false
      });
    });

    child.stdin.write(JSON.stringify(command) + '\n');
    child.stdin.end();
  });
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