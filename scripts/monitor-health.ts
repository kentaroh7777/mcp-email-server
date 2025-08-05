#!/usr/bin/env npx tsx

/**
 * Email Server Health Monitor
 * 全ツールの応答性をチェックする包括的ヘルスチェック
 */

import { spawn } from 'child_process';
import path from 'path';

const serverPath = path.join(process.cwd(), 'scripts/run-email-server.ts');

async function runHealthCheck(): Promise<{
  success: boolean;
  results: any[];
  errors: string[];
}> {
  const results: any[] = [];
  const errors: string[] = [];

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
    errors.push(`list_accounts: ${listAccountsResult.error || 'Timeout'}`);
  }

  let allAccountNames: string[] = [];
  if (listAccountsResult.success && listAccountsResult.response?.result?.content?.[0]?.text) {
    try {
      const data = JSON.parse(listAccountsResult.response.result.content[0].text);
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
        errors.push(`${test.name}: ${result.error || 'Timeout'}`);
      }
    } catch (error) {
      console.log(`  ❌ エラー: ${error}`);
      errors.push(`${test.name}: ${error}`);
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
    errors
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
          resolve({
            success: true,
            response,
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
  console.log('🏥 Running comprehensive health check...\n');
  console.log('Testing all accounts and core tools (timeout: 10s each)\n');
  
  const health = await runHealthCheck();
  
  console.log(`\n📊 Overall Status: ${health.success ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  console.log(`Tests Passed: ${health.results.filter(r => r.success).length}/${health.results.length}`);
  
  if (health.errors.length > 0) {
    console.log('\n🚨 Errors:');
    health.errors.forEach(error => console.log(`  - ${error}`));
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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}