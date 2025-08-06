#!/usr/bin/env node

// Cursor用デバッグMCPサーバー
// 標準出力にもデバッグ情報を出力（MCPプロトコル違反になるが、デバッグのため）

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as readline from 'readline';

// プロジェクトルートの.envファイルを読み込み
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(dirname(__dirname), '.env');

dotenv.config({ path: envPath });

import McpEmailServer from '../src/index.js';

// MCPハンドラーを初期化
const handler = new McpEmailServer();

// 起動メッセージ（MCPプロトコル違反だがデバッグのため）
console.log(JSON.stringify({
  jsonrpc: '2.0',
  method: 'notification/debug',
  params: {
    level: 'info',
    message: 'MCP Email Server starting...',
    data: {
      NODE_ENV: process.env.NODE_ENV,
      hasEncryptionKey: !!process.env.EMAIL_ENCRYPTION_KEY,
      pid: process.pid,
      timestamp: new Date().toISOString()
    }
  }
}));

// stdinからのJSONRPCメッセージを処理
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// バッファリングを無効化
process.stdout.setEncoding('utf8');
process.stdin.setEncoding('utf8');

// 各行をJSONRPCリクエストとして処理
rl.on('line', async (line: string) => {
  try {
    // デバッグ通知（MCPプロトコル違反だがデバッグのため）
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notification/debug',
      params: {
        level: 'debug',
        message: 'Received request',
        data: { request: line, timestamp: new Date().toISOString() }
      }
    }));
    
    const request = JSON.parse(line.trim());
    const response = await handler.handleRequest(request);
    
    // デバッグ通知
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notification/debug',
      params: {
        level: 'debug',
        message: 'Sending response',
        data: { response, timestamp: new Date().toISOString() }
      }
    }));
    
    // 実際のレスポンス
    console.log(JSON.stringify(response));
    
  } catch (error) {
    // エラー通知
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notification/debug',
      params: {
        level: 'error',
        message: 'Request processing error',
        data: { 
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      }
    }));
    
    // エラーレスポンス
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
        data: error instanceof Error ? error.message : String(error)
      }
    };
    
    console.log(JSON.stringify(errorResponse));
  }
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    method: 'notification/debug',
    params: {
      level: 'info',
      message: 'Server shutting down (SIGINT)',
      data: { timestamp: new Date().toISOString() }
    }
  }));
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    method: 'notification/debug',
    params: {
      level: 'info',
      message: 'Server shutting down (SIGTERM)',
      data: { timestamp: new Date().toISOString() }
    }
  }));
  rl.close();
  process.exit(0);
});

// 準備完了通知
console.log(JSON.stringify({
  jsonrpc: '2.0',
  method: 'notification/debug',
  params: {
    level: 'info',
    message: 'MCP Server ready and listening for input',
    data: { timestamp: new Date().toISOString() }
  }
}));