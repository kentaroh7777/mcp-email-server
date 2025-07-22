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

import { MCPEmailProtocolHandler } from '../src/mcp-handler.js';
import { setupProductionLogging, logToFile, outputMCPResponse } from '../src/file-logger.js';
import * as readline from 'readline';

// 本番環境でのログ設定
setupProductionLogging();

// サーバー起動ログ（テスト環境では抑制）
if (process.env.NODE_ENV !== 'test') {
  logToFile('info', 'MCP Email Server starting...', { 
    nodeEnv: process.env.NODE_ENV,
    pid: process.pid 
  });
}

// 暗号化キーを環境変数から取得
const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';

// MCPハンドラーを初期化
const handler = new MCPEmailProtocolHandler(encryptionKey);

// アカウント設定を環境変数から自動設定

// IMAP アカウントの自動設定
const imapAccounts = Object.keys(process.env)
  .filter(key => key.startsWith('IMAP_HOST_'))
  .map(key => key.replace('IMAP_HOST_', ''));

for (const accountName of imapAccounts) {
  const host = process.env[`IMAP_HOST_${accountName}`];
  const port = parseInt(process.env[`IMAP_PORT_${accountName}`] || '993');
  const secure = process.env[`IMAP_SECURE_${accountName}`] !== 'false';
  const user = process.env[`IMAP_USER_${accountName}`];
  const password = process.env[`IMAP_PASSWORD_${accountName}`];
  
  if (host && user && password) {
    handler.addImapAccount(accountName, host, port, secure, user, password);
  }
}

// XServer アカウントの自動設定
const xserverAccounts = Object.keys(process.env)
  .filter(key => key.startsWith('XSERVER_DOMAIN_'))
  .map(key => key.replace('XSERVER_DOMAIN_', ''));

for (const accountName of xserverAccounts) {
  const server = process.env[`XSERVER_SERVER_${accountName}`];
  const domain = process.env[`XSERVER_DOMAIN_${accountName}`];
  const username = process.env[`XSERVER_USER_${accountName}`];
  const password = process.env[`XSERVER_PASSWORD_${accountName}`];
  
  if (server && domain && username && password) {
    handler.addXServerAccount(accountName, server, domain, username, password);
  }
}

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
    
    // レスポンスをstdoutに送信
    outputMCPResponse(response);
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