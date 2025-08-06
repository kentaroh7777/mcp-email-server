#!/usr/bin/env node

// .envファイルを読み込み（エラーハンドリング付き）
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// プロジェクトルートの.envファイルを読み込み
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(dirname(__dirname), '.env');

dotenv.config({ path: envPath });

import McpEmailServer from '../src/index.js';
import * as readline from 'readline';

// MCPハンドラーを初期化（アカウントは自動読み込み）
const handler = new McpEmailServer();

// stdinからのJSONRPCメッセージを処理
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// 各行をJSONRPCリクエストとして処理
rl.on('line', async (line: string) => {
  try {
    const request = JSON.parse(line.trim());
    const response = await handler.handleRequest(request);
    
    // レスポンスをstdoutに送信（Todoistサーバーと同じ方式）
    console.log(JSON.stringify(response));
  } catch (error) {
    // エラーレスポンスを送信
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    };
    console.log(JSON.stringify(errorResponse));
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