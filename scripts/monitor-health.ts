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
  const listAccountsCommand = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'list_accounts', arguments: {} }
  };
  const listAccountsResult = await runMCPCommand(listAccountsCommand, 30000);
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
  const dynamicTestCommands: { name: string; command: any }[] = [];

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
    {
      name: 'search_all_emails',
      command: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_all_emails',
          arguments: { query: 'test', limit: 1, accounts: 'ALL' }
        }
      }
    }
  );

  // 各アカウントに対するテスト
  for (const accountName of allAccountNames) {
    // list_emails
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

    // get_email_detail (dummy_idを使用)
    dynamicTestCommands.push({
      name: `get_email_detail (${accountName})`,
      command: {
        jsonrpc: '2.0',
        id: results.length + 1,
        method: 'tools/call',
        params: {
          name: 'get_email_detail',
          arguments: { account_name: accountName, email_id: 'dummy_id' }
        }
      }
    });

    // archive_email (dummy_idを使用)
    dynamicTestCommands.push({
      name: `archive_email (${accountName})`,
      command: {
        jsonrpc: '2.0',
        id: results.length + 1,
        method: 'tools/call',
        params: {
          name: 'archive_email',
          arguments: { account_name: accountName, email_id: 'dummy_id' }
        }
      }
    });

    // send_email (ダミーの宛先と内容)
    dynamicTestCommands.push({
      name: `send_email (${accountName})`,
      command: {
        jsonrpc: '2.0',
        id: results.length + 1,
        method: 'tools/call',
        params: {
          name: 'send_email',
          arguments: {
            account_name: accountName,
            to: 'test@example.com',
            subject: 'Health Check Test',
            text: 'This is a health check test email.'
          }
        }
      }
    });
  }

  // 3. 動的に生成されたコマンドを実行
  for (const test of dynamicTestCommands) {
    try {
      const result = await runMCPCommand(test.command, 30000); // 30秒タイムアウト
      results.push({
        test: test.name,
        success: result.success,
        timedOut: result.timedOut
      });

      if (!result.success || result.timedOut) {
        errors.push(`${test.name}: ${result.error || 'Timeout'}`);
      }
    } catch (error) {
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

async function runMCPCommand(command: any, timeoutMs: number = 30000): Promise<{
  success: boolean;
  response?: any;
  error?: string;
  timedOut: boolean;
}> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      resolve({
        success: false,
        error: 'Command timed out',
        timedOut: true
      });
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (timedOut) return;

      try {
        if (stdout.trim()) {
          const response = JSON.parse(stdout.trim());
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
      clearTimeout(timeout);
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
  console.log('Testing all email server tools (timeout: 30s each)\n');
  
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
  ['list_accounts', 'get_account_stats', 'search_all_emails'].forEach(toolName => {
    const result = health.results.find(r => r.test === toolName);
    if (result) {
      const status = result.success ? '✅' : (result.timedOut ? '⏰' : '❌');
      console.log(`  ${status} ${result.test}`);
    }
  });
  
  // 統合されたメールツール
  console.log('\n📧 統合されたメールツール:');
  ['list_emails', 'get_email_detail', 'archive_email', 'send_email'].forEach(toolName => {
    const result = health.results.find(r => r.test === toolName);
    if (result) {
      const status = result.success ? '✅' : (result.timedOut ? '⏰' : '❌');
      console.log(`  ${status} ${result.test}`);
    }
  });

  process.exit(health.success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}