#!/usr/bin/env node

// .envファイルを読み込み
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// プロジェクトルートの.envファイルを読み込み
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(dirname(__dirname), '.env');

dotenv.config({ path: envPath });

import McpEmailServer from '../src/index.js';
import { setupProductionLogging, logToFile, outputMCPResponse } from '../src/file-logger.js';
import * as readline from 'readline';

// 本番環境でのログ設定
setupProductionLogging();

// 暗号化キーを環境変数から取得
const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';

// サーバー起動ログ（テスト環境では抑制）
logToFile('info', 'MCP Email Server starting...', { 
  NODE_ENV: process.env.NODE_ENV,
  encryptionKeyLength: encryptionKey.length,
  pid: process.pid 
});

// MCPハンドラーを初期化（アカウントは自動読み込み）
const handler = new McpEmailServer();

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
    logToFile('debug', 'Received request:', line);
    const request = JSON.parse(line.trim());
    const response = await handler.handleRequest(request);
    
    logToFile('debug', 'Sending response:', response);
    // レスポンスをstdoutに送信
    outputMCPResponse(response);
  } catch (error) {
    logToFile('error', 'Request processing error:', error);
    // エラーレスポンスを送信
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    };
    outputMCPResponse(errorResponse);
  }
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rl.close();
  process.exit(0);
}); 