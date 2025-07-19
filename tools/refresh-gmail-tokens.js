#!/usr/bin/env node

/**
 * Gmail Refresh Token 自動更新スクリプト
 * 
 * 使用方法:
 * 1. 対話式モード: node tools/refresh-gmail-tokens.js
 * 2. 特定アカウント: node tools/refresh-gmail-tokens.js kentaroh7
 * 3. 全アカウント確認: node tools/refresh-gmail-tokens.js --check-all
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

class GmailTokenManager {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
  }

  // 既存のGmailアカウントを検出
  getConfiguredAccounts() {
    const accounts = [];
    const envKeys = Object.keys(process.env);
    
    for (const key of envKeys) {
      if (key.startsWith('GMAIL_REFRESH_TOKEN_')) {
        const accountName = key.replace('GMAIL_REFRESH_TOKEN_', '');
        accounts.push(accountName);
      }
    }
    
    return accounts;
  }

  // トークンの有効性をテスト
  async testToken(accountName) {
    const refreshToken = process.env[`GMAIL_REFRESH_TOKEN_${accountName}`];
    
    if (!refreshToken) {
      return { valid: false, error: 'Refresh token not found' };
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      // アクセストークンを取得してテスト
      const { token } = await this.oauth2Client.getAccessToken();
      
      if (token) {
        return { valid: true, token };
      } else {
        return { valid: false, error: 'Failed to get access token' };
      }
    } catch (error) {
      return { 
        valid: false, 
        error: error.message,
        needsReauth: error.message.includes('invalid_grant')
      };
    }
  }

  // 新しいトークンを取得
  async getNewTokens(accountName) {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log(`\n📧 ${accountName} アカウントの新しいトークンを取得します`);
    console.log('='.repeat(60));
    console.log('\n1. 以下のURLをブラウザで開いてください:');
    console.log(`\n${authUrl}\n`);
    console.log('2. Googleアカウントでログインし、アクセスを許可');
    console.log('3. リダイレクト後のURL全体を貼り付けてください');
    console.log('   例: http://localhost:3000/oauth2callback?code=4/xxxxx&scope=...');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      rl.question('\nリダイレクトされたURL全体を貼り付けてください: ', async (input) => {
        let code;
        
        // URLからcodeパラメータを抽出
        try {
          if (input.includes('code=')) {
            const url = new URL(input);
            code = url.searchParams.get('code');
            if (!code) {
              throw new Error('URLからcodeパラメータが見つかりません');
            }
            console.log(`✅ 認証コードを抽出しました: ${code.substring(0, 20)}...`);
          } else {
            // 直接コードが入力された場合
            code = input.trim();
            console.log(`📝 認証コードを受け取りました: ${code.substring(0, 20)}...`);
          }
        } catch (error) {
          console.error('❌ URL解析エラー:', error.message);
          console.log('💡 認証コードを直接入力してください');
          code = input.trim();
        }
        try {
          const { tokens } = await this.oauth2Client.getToken(code);
          
          console.log('\n✅ トークン取得成功！');
          
          // .envファイルを更新
          await this.updateEnvFile(accountName, tokens);
          
          resolve(tokens);
        } catch (error) {
          console.error('\n❌ エラー:', error.message);
          reject(error);
        }
        rl.close();
      });
    });
  }

  // .envファイルを更新
  async updateEnvFile(accountName, tokens) {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    try {
      envContent = fs.readFileSync(envPath, 'utf8');
    } catch (error) {
      console.warn('⚠️  .envファイルが見つかりません。新規作成します。');
    }

    // 既存のトークンを削除
    const lines = envContent.split('\n');
    const filteredLines = lines.filter(line => 
      !line.startsWith(`GMAIL_ACCESS_TOKEN_${accountName}=`) &&
      !line.startsWith(`GMAIL_REFRESH_TOKEN_${accountName}=`)
    );

    // 新しいトークンを追加
    filteredLines.push('');
    filteredLines.push(`# ${accountName} - Updated ${new Date().toISOString()}`);
    filteredLines.push(`GMAIL_ACCESS_TOKEN_${accountName}=${tokens.access_token}`);
    filteredLines.push(`GMAIL_REFRESH_TOKEN_${accountName}=${tokens.refresh_token}`);

    // ファイルに書き込み
    fs.writeFileSync(envPath, filteredLines.join('\n'));
    
    console.log(`\n📝 .envファイルを更新しました (${accountName})`);
  }

  // 全アカウントをチェック
  async checkAllAccounts() {
    console.log('🔍 全Gmailアカウントのトークン状態をチェック中...\n');
    
    const accounts = this.getConfiguredAccounts();
    
    if (accounts.length === 0) {
      console.log('❌ Gmailアカウントが設定されていません');
      return;
    }

    const results = [];
    
    for (const account of accounts) {
      console.log(`📧 ${account}をチェック中...`);
      const result = await this.testToken(account);
      results.push({ account, ...result });
      
      if (result.valid) {
        console.log(`  ✅ 有効`);
      } else {
        console.log(`  ❌ 無効: ${result.error}`);
      }
    }

    console.log('\n📊 チェック結果:');
    console.log('='.repeat(40));
    
    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.filter(r => !r.valid).length;
    
    console.log(`✅ 有効: ${validCount}/${accounts.length}`);
    console.log(`❌ 無効: ${invalidCount}/${accounts.length}`);

    const needsReauth = results.filter(r => r.needsReauth);
    if (needsReauth.length > 0) {
      console.log(`\n🔄 再認証が必要なアカウント:`);
      needsReauth.forEach(r => console.log(`  - ${r.account}`));
      console.log(`\n再認証するには: node tools/refresh-gmail-tokens.js <account_name>`);
    }

    return results;
  }

  // 特定のアカウントを更新
  async refreshAccount(accountName) {
    console.log(`🔄 ${accountName}のトークンをチェック中...`);
    
    const testResult = await this.testToken(accountName);
    
    if (testResult.valid) {
      console.log(`✅ ${accountName}のトークンは有効です`);
      return;
    }

    console.log(`❌ ${accountName}のトークンが無効: ${testResult.error}`);
    
    if (testResult.needsReauth) {
      console.log(`🔄 ${accountName}の再認証を開始...`);
      await this.getNewTokens(accountName);
      console.log(`✅ ${accountName}のトークン更新完了`);
    }
  }
}

// メイン実行
async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('❌ エラー: Gmail OAuth2設定が不完全です');
    console.log('以下を.envファイルに設定してください:');
    console.log('GMAIL_CLIENT_ID=your-client-id');
    console.log('GMAIL_CLIENT_SECRET=your-client-secret');
    console.log('GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback');
    process.exit(1);
  }

  const manager = new GmailTokenManager();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // 対話式モード
    console.log('Gmail Token Manager');
    console.log('='.repeat(40));
    console.log('1. 全アカウントチェック');
    console.log('2. 特定アカウント更新');
    console.log('3. 新規アカウント追加');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('\n選択してください (1-3): ', async (choice) => {
      switch (choice) {
        case '1':
          await manager.checkAllAccounts();
          break;
        case '2':
          const accounts = manager.getConfiguredAccounts();
          console.log('\n設定済みアカウント:', accounts.join(', '));
          rl.question('更新するアカウント名: ', async (accountName) => {
            await manager.refreshAccount(accountName);
            rl.close();
          });
          return;
        case '3':
          rl.question('新しいアカウント名: ', async (accountName) => {
            await manager.getNewTokens(accountName);
            rl.close();
          });
          return;
        default:
          console.log('無効な選択です');
      }
      rl.close();
    });

  } else if (args[0] === '--check-all') {
    // 全アカウントチェック
    await manager.checkAllAccounts();
    
  } else {
    // 特定アカウント更新
    const accountName = args[0];
    await manager.refreshAccount(accountName);
  }
}

// ES moduleでの実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 