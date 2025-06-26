#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🧪 Testing MCP Email Server...\n');

// MCPサーバーを直接起動
const mcpServer = spawn('npx', ['tsx', 'run-email-server.ts'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  cwd: process.cwd()
});

let responseCount = 0;
const expectedResponses = 2;

// レスポンスの処理
mcpServer.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const parsed = JSON.parse(line);
        console.log('📤 Response received:', JSON.stringify(parsed, null, 2));
        responseCount++;
        
        if (responseCount >= expectedResponses) {
          console.log('\n✅ Test completed successfully!');
          mcpServer.kill();
          process.exit(0);
        }
      } catch (error) {
        // JSONではない行はスキップ（サーバーのログなど）
        console.log('ℹ️  Non-JSON output:', line);
      }
    }
  }
});

// エラーハンドリング
mcpServer.on('error', (error) => {
  console.error('❌ Error starting MCP server:', error);
  process.exit(1);
});

// サーバー起動待ち
setTimeout(() => {
  console.log('📥 Sending initialize request...');
  
  // 1. Initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {}
  };
  
  mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // 2秒後にtools/listリクエストを送信
  setTimeout(() => {
    console.log('📥 Sending tools/list request...');
    
    const toolsListRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    mcpServer.stdin.write(JSON.stringify(toolsListRequest) + '\n');
  }, 2000);
}, 1000);

// タイムアウト処理
setTimeout(() => {
  console.log('⏰ Test timeout - killing server');
  mcpServer.kill();
  process.exit(1);
}, 10000); 