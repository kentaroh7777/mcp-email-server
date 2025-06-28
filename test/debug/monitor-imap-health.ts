#!/usr/bin/env npx tsx

/**
 * Email Server Health Monitor
 * 全ツールの応答性をチェックする包括的ヘルスチェック
 */

import { spawn } from 'child_process';
import path from 'path';

const serverPath = path.join(process.cwd(), 'run-email-server.ts');

async function runHealthCheck(): Promise<{
  success: boolean;
  results: any[];
  errors: string[];
}> {
  const testCommands = [
    // 統合ツール
    {
      name: 'list_accounts',
      command: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_accounts', arguments: { random_string: 'test' } }
      }
    },
    {
      name: 'get_account_stats',
      command: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'get_account_stats', arguments: { random_string: 'test' } }
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
    },
    // Gmailツール
    {
      name: 'list_emails',
      command: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'MAIN', limit: 1 }
        }
      }
    },
    {
      name: 'get_unread_count',
      command: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'get_unread_count',
          arguments: { account_name: 'MAIN' }
        }
      }
    },
    // IMAPツール
    {
      name: 'list_imap_emails',
      command: {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'list_imap_emails',
          arguments: { account_name: 'info_h_fpo_com', limit: 1 }
        }
      }
    },
    {
      name: 'get_imap_unread_count',
      command: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'get_imap_unread_count',
          arguments: { account_name: 'info_h_fpo_com' }
        }
      }
    }
  ];

  const results: any[] = [];
  const errors: string[] = [];

  for (const test of testCommands) {
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
  
  // Gmailツール
  console.log('\n📧 Gmailツール:');
  ['list_emails', 'get_unread_count'].forEach(toolName => {
    const result = health.results.find(r => r.test === toolName);
    if (result) {
      const status = result.success ? '✅' : (result.timedOut ? '⏰' : '❌');
      console.log(`  ${status} ${result.test}`);
    }
  });
  
  // IMAPツール
  console.log('\n📨 IMAPツール:');
  ['list_imap_emails', 'get_imap_unread_count'].forEach(toolName => {
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