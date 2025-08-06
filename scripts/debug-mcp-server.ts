#!/usr/bin/env node

// デバッグ用のMCPサーバー
// 標準エラーにログを出力し、標準出力には純粋なMCP応答のみを出力

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

// デバッグログ用の関数（標準エラーに出力）
function debugLog(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] DEBUG: ${message}`, ...args);
}

// エラーログ用の関数
function errorLog(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`, ...args);
}

debugLog('MCP Email Server starting...', {
  NODE_ENV: process.env.NODE_ENV,
  DEBUG: process.env.DEBUG,
  pid: process.pid,
  hasEncryptionKey: !!process.env.EMAIL_ENCRYPTION_KEY
});

// MCPハンドラーを初期化
const handler = new McpEmailServer();
debugLog('McpEmailServer initialized');

// stdinからのJSONRPCメッセージを処理
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

debugLog('Readline interface created, waiting for input...');

// バッファリングを無効化
process.stdout.setEncoding('utf8');
process.stdin.setEncoding('utf8');

// 各行をJSONRPCリクエストとして処理
rl.on('line', async (line: string) => {
  try {
    debugLog('Received line:', line);
    const request = JSON.parse(line.trim());
    debugLog('Parsed request:', request);
    
    const response = await handler.handleRequest(request);
    debugLog('Generated response:', response);
    
    // レスポンスをstdoutに送信（純粋なJSON）
    console.log(JSON.stringify(response));
    
  } catch (error) {
    errorLog('Request processing error:', error);
    
    // エラーレスポンスを送信
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
  debugLog('Received SIGINT, closing...');
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  debugLog('Received SIGTERM, closing...');
  rl.close();
  process.exit(0);
});

debugLog('MCP Server ready and listening for input');