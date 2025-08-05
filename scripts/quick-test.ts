#!/usr/bin/env npx tsx

/**
 * Quick Test - 効率的な動作確認テスト
 * 実際の接続テストではなく、基本的な応答性のみをチェック
 */

import { spawn } from 'child_process';
import path from 'path';

const serverPath = path.join(process.cwd(), 'scripts/run-email-server.ts');

interface TestResult {
  name: string;
  success: boolean;
  responseTime: number;
  error?: string;
}

async function runQuickTest(command: any, timeoutMs: number = 5000): Promise<TestResult> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill('SIGTERM');
        resolve({
          name: command.params?.name || 'unknown',
          success: false,
          responseTime: Date.now() - startTime,
          error: 'タイムアウト'
        });
      }
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        
        const responseTime = Date.now() - startTime;
        
        try {
          if (stdout.trim()) {
            const response = JSON.parse(stdout.trim());
            resolve({
              name: command.params?.name || 'unknown',
              success: !!response.result,
              responseTime,
              error: response.error?.message
            });
          } else {
            resolve({
              name: command.params?.name || 'unknown',
              success: false,
              responseTime,
              error: `出力なし (code: ${code})`
            });
          }
        } catch (error) {
          resolve({
            name: command.params?.name || 'unknown',
            success: false,
            responseTime,
            error: `JSON解析エラー: ${error}`
          });
        }
      }
    });

    child.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          name: command.params?.name || 'unknown',
          success: false,
          responseTime: Date.now() - startTime,
          error: `プロセスエラー: ${error.message}`
        });
      }
    });

    // コマンドを送信
    child.stdin.write(JSON.stringify(command) + '\n');
    child.stdin.end();
  });
}

async function main() {
  console.log('🚀 クイックテスト開始...\n');

  // 軽量なテストコマンドのみ
  const testCommands = [
    {
      name: 'サーバー初期化',
      command: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      }
    },
    {
      name: 'ツール一覧',
      command: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      }
    },
    {
      name: 'アカウント一覧テスト', 
      command: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_accounts',
          arguments: {}
        }
      }
    }
  ];

  const results: TestResult[] = [];
  let totalTime = 0;

  for (const test of testCommands) {
    console.log(`📋 ${test.name}をテスト中...`);
    
    const result = await runQuickTest(test.command, 10000); // 10秒タイムアウト
    results.push(result);
    totalTime += result.responseTime;

    if (result.success) {
      console.log(`  ✅ 成功 (${result.responseTime}ms)`);
    } else {
      console.log(`  ❌ 失敗 (${result.responseTime}ms): ${result.error}`);
    }
  }

  console.log('\n📊 テスト結果:');
  console.log(`成功: ${results.filter(r => r.success).length}/${results.length}`);
  console.log(`総実行時間: ${totalTime}ms`);
  console.log(`平均応答時間: ${Math.round(totalTime / results.length)}ms`);

  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('\n🚨 失敗したテスト:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 全テスト成功！');
    process.exit(0);
  }
}

// ES moduleでは直接実行
main().catch(console.error);
