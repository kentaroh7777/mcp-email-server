#!/usr/bin/env node

/**
 * Gmail Desktop Authentication Script
 * 
 * このスクリプトは、MCP Email Serverサーバー用の
 * デスクトップアプリケーション認証フローでGmailアクセストークンを取得します。
 * 
 * 使用方法:
 *   1. .envファイルにデスクトップアプリ用の認証情報を設定
 *   2. node scripts/gmail-desktop-auth.mjs
 *   3. ブラウザで認証し、認証コードを入力
 *   4. .envファイルにトークンが自動追加される
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

const ENV_FILE = path.resolve(__dirname, '../.env');

class GmailDesktopAuth {
  constructor() {
    this.config = {};
    this.oAuth2Client = null;
  }

  /**
   * .envファイルから設定を読み込み
   */
  loadConfig() {
    try {
      if (!fs.existsSync(ENV_FILE)) {
        throw new Error(`.envファイルが見つかりません: ${ENV_FILE}`);
      }

      const envContent = fs.readFileSync(ENV_FILE, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        if (line.includes('=') && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('=').trim();
          this.config[key.trim()] = value;
        }
      }

      // 必要な設定項目をチェック
      const required = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REDIRECT_URI'];
      for (const key of required) {
        if (!this.config[key]) {
          throw new Error(`必要な設定が見つかりません: ${key}`);
        }
      }

      console.log('✅ .envファイルから設定を読み込みました');
      console.log(`📧 Client ID: ${this.config.GMAIL_CLIENT_ID.substring(0, 20)}...`);
      console.log(`🔗 Redirect URI: ${this.config.GMAIL_REDIRECT_URI}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ 設定読み込みエラー:', error.message);
      return false;
    }
  }

  /**
   * OAuth2クライアントを初期化
   */
  initializeOAuth() {
    this.oAuth2Client = new google.auth.OAuth2(
      this.config.GMAIL_CLIENT_ID,
      this.config.GMAIL_CLIENT_SECRET,
      this.config.GMAIL_REDIRECT_URI
    );
    
    console.log('✅ OAuth2クライアントを初期化しました');
  }

  /**
   * 認証URLを生成してブラウザで開く
   */
  generateAuthUrl() {
    const authUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log('\n🌐 Gmail認証URLを生成しました:');
    console.log(authUrl);
    console.log('\n📝 このURLがブラウザで自動的に開きます...');
    
    // ブラウザで認証URLを開く
    exec(`open "${authUrl}"`, (error) => {
      if (error) {
        console.log('⚠️  ブラウザを自動で開けませんでした。上記URLを手動でコピーしてブラウザで開いてください。');
      }
    });

    return authUrl;
  }

  /**
   * ユーザーから認証コードを取得
   */
  async getAuthCodeFromUser() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log('\n💡 認証手順:');
      console.log('   1. ブラウザでGoogleアカウントにログイン');
      console.log('   2. アプリのアクセス許可を承認');
      console.log('   3. 表示された認証コードをコピー');
      
      rl.question('\n🔑 認証コードを入力してください: ', (code) => {
        rl.close();
        resolve(code.trim());
      });
    });
  }

  /**
   * 認証コードからトークンを取得
   */
  async exchangeCodeForTokens(authCode) {
    try {
      console.log('\n🔄 認証コードをトークンに交換中...');
      
      const { tokens } = await this.oAuth2Client.getToken(authCode);
      this.oAuth2Client.setCredentials(tokens);
      
      console.log('✅ トークンの取得に成功しました');
      
      // トークン情報を表示（セキュリティのため一部マスク）
      console.log('📄 取得されたトークン情報:');
      console.log(`   Access Token: ${tokens.access_token ? tokens.access_token.substring(0, 20) + '...' : 'なし'}`);
      console.log(`   Refresh Token: ${tokens.refresh_token ? tokens.refresh_token.substring(0, 20) + '...' : 'なし'}`);
      console.log(`   Expires: ${tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : 'なし'}`);
      
      return tokens;
      
    } catch (error) {
      console.error('❌ トークン取得エラー:', error.message);
      throw error;
    }
  }

  /**
   * トークンを.envファイルに保存
   */
  saveTokensToEnv(tokens, accountName = 'MAIN') {
    try {
      console.log(`\n💾 ${accountName}アカウントのトークンを.envファイルに保存中...`);
      
      let envContent = fs.readFileSync(ENV_FILE, 'utf8');
      
      // 正しい形式のキー名
      const refreshTokenKey = `GMAIL_REFRESH_TOKEN_${accountName.toLowerCase()}`;
      
      // 既存のトークン設定を削除（全ての古い形式）
      const tokensToRemove = [
        // 新しい正しい形式
        new RegExp(`^${refreshTokenKey}=.*$`, 'gm'),
        // 古い間違った形式
        new RegExp(`^${accountName}_ACCESS_TOKEN=.*$`, 'gm'),
        new RegExp(`^${accountName}_REFRESH_TOKEN=.*$`, 'gm'),
        new RegExp(`^${accountName}_TOKEN_EXPIRY=.*$`, 'gm'),
        // さらに古い形式
        new RegExp(`^GMAIL_ACCESS_TOKEN_${accountName.toLowerCase()}=.*$`, 'gm'),
        new RegExp(`^GMAIL_REFRESH_TOKEN_${accountName.toLowerCase()}=.*$`, 'gm'),
        new RegExp(`^GMAIL_TOKEN_EXPIRY_${accountName.toLowerCase()}=.*$`, 'gm')
      ];
      
      for (const regex of tokensToRemove) {
        envContent = envContent.replace(regex, '');
      }
      
      // 空行を整理
      envContent = envContent.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      // 既存のGMAIL ACCOUNT TOKENSセクションを探す
      const tokenSectionExists = envContent.includes('# GMAIL ACCOUNT TOKENS (Correct Format)');
      
      if (tokenSectionExists) {
        // 既存セクションの末尾に追加
        const insertPosition = envContent.lastIndexOf('# GMAIL ACCOUNT TOKENS (Correct Format)');
        const beforeSection = envContent.substring(0, insertPosition);
        const afterSection = envContent.substring(insertPosition);
        const afterSectionEnd = afterSection.indexOf('\n\n');
        
        if (afterSectionEnd !== -1) {
          const newAfterSection = afterSection.substring(afterSectionEnd);
          envContent = beforeSection + 
                      afterSection.substring(0, afterSectionEnd) + 
                      `\n${refreshTokenKey}=${tokens.refresh_token}` +
                      newAfterSection;
        } else {
          envContent = envContent + `\n${refreshTokenKey}=${tokens.refresh_token}`;
        }
      } else {
        // 新しいセクションを作成
        if (!envContent.endsWith('\n')) {
          envContent += '\n';
        }
        
        const tokenSection = `
# ==============================================
# GMAIL ACCOUNT TOKENS (Correct Format)
# ==============================================
${refreshTokenKey}=${tokens.refresh_token}
`;
        envContent += tokenSection;
      }
      
      fs.writeFileSync(ENV_FILE, envContent);
      
      console.log(`✅ ${accountName}アカウントのトークンを正しい形式で保存しました`);
      console.log(`   ${refreshTokenKey}=***`);
      return true;
      
    } catch (error) {
      console.error('❌ トークン保存エラー:', error.message);
      return false;
    }
  }

  /**
   * 認証をテスト（Gmailプロフィール情報を取得）
   */
  async testAuthentication() {
    try {
      console.log('\n🧪 Gmail認証テスト中...');
      
      const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
      
      // プロフィール情報を取得
      const profile = await gmail.users.getProfile({ userId: 'me' });
      
      console.log('✅ Gmail認証テスト成功！');
      console.log(`📧 メールアドレス: ${profile.data.emailAddress}`);
      console.log(`📊 総メール数: ${profile.data.messagesTotal}`);
      console.log(`📈 スレッド数: ${profile.data.threadsTotal}`);
      
      // 最新メールを1件取得してテスト
      const messages = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 1
      });
      
      if (messages.data.messages && messages.data.messages.length > 0) {
        console.log('📮 最新メールへのアクセスも確認済み');
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Gmail認証テストエラー:', error.message);
      return false;
    }
  }

  /**
   * 既存のトークンをチェック
   */
  checkExistingTokens(accountName = 'MAIN') {
    const refreshTokenKey = `GMAIL_REFRESH_TOKEN_${accountName.toLowerCase()}`;
    if (this.config[refreshTokenKey]) {
      console.log(`⚠️  ${accountName}アカウントの既存トークンが見つかりました`);
      return true;
    }
    return false;
  }

  /**
   * メイン認証フロー
   */
  async runAuthFlow(accountName = 'MAIN') {
    console.log('🚀 Gmail デスクトップ認証セットアップを開始します\n');
    console.log(`📧 対象アカウント: ${accountName}`);

    // Step 1: 設定を読み込み
    if (!this.loadConfig()) {
      return false;
    }

    // Step 2: 既存トークンの確認
    if (this.checkExistingTokens(accountName)) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question(`${accountName}アカウントの既存トークンを上書きしますか？ (y/N): `, (answer) => {
          rl.close();
          resolve(answer.toLowerCase());
        });
      });

      if (answer !== 'y' && answer !== 'yes') {
        console.log('認証をキャンセルしました。');
        return false;
      }
    }

    // Step 3: OAuth2クライアントを初期化
    this.initializeOAuth();

    // Step 4: 認証URLを生成・表示
    this.generateAuthUrl();

    // Step 5: 認証コードを取得
    const authCode = await this.getAuthCodeFromUser();

    if (!authCode) {
      console.error('❌ 認証コードが入力されませんでした');
      return false;
    }

    // Step 6: トークンを取得
    const tokens = await this.exchangeCodeForTokens(authCode);

    // Step 7: トークンを.envファイルに保存
    if (!this.saveTokensToEnv(tokens, accountName)) {
      return false;
    }

    // Step 8: 認証をテスト
    await this.testAuthentication();

    console.log('\n🎉 Gmail認証セットアップが完了しました！');
    console.log('これで MCP Email Server から Gmail にアクセス可能です。');
    
    return true;
  }
}

// 使用方法を表示
function showUsage() {
  console.log(`
📖 使用方法:

1. 前提条件:
   - Google Cloud Console でデスクトップアプリケーション用の OAuth 2.0 クライアント ID を作成
   - .env ファイルに以下を設定:
     GMAIL_CLIENT_ID=your-client-id
     GMAIL_CLIENT_SECRET=your-client-secret  
     GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob

2. 実行:
   node scripts/gmail-desktop-auth.mjs [ACCOUNT_NAME]
   
   例:
   node scripts/gmail-desktop-auth.mjs MAIN    # メインアカウント
   node scripts/gmail-desktop-auth.mjs WORK    # 仕事用アカウント

3. 認証フロー:
   - ブラウザが開いて Google の認証ページが表示される
   - Google アカウントでログインし、Gmail へのアクセスを承認
   - 認証コードをコピーして、プロンプトに貼り付け
   - .env ファイルにトークンが自動追加される

4. 確認:
   - Gmail認証テストが自動実行され、メール情報が表示される
`);
}

// メイン実行部分
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  const accountName = args[0] || 'MAIN';
  
  if (!/^[A-Z][A-Z0-9_]*$/.test(accountName)) {
    console.error('❌ アカウント名は英大文字とアンダースコアのみ使用可能です (例: MAIN, WORK)');
    process.exit(1);
  }

  const auth = new GmailDesktopAuth();
  const success = await auth.runAuthFlow(accountName);
  
  process.exit(success ? 0 : 1);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('❌ 予期しないエラー:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  認証がキャンセルされました');
  process.exit(1);
});

// スクリプトが直接実行された場合のみmainを呼び出し
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default GmailDesktopAuth; 