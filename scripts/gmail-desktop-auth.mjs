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
  saveTokensToEnv(tokens, accountName) {
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
  checkExistingTokens(accountName) {
    const refreshTokenKey = `GMAIL_REFRESH_TOKEN_${accountName.toLowerCase()}`;
    if (this.config[refreshTokenKey]) {
      console.log(`⚠️  ${accountName}アカウントの既存トークンが見つかりました`);
      return true;
    }
    return false;
  }

  /**
   * .envファイルから利用可能なGmailアカウントを検出
   */
  async detectAvailableAccounts() {
    const accounts = [];
    
    // GMAIL_REFRESH_TOKEN_xxx パターンを検索（トークンが設定されているアカウント）
    for (const key in this.config) {
      const match = key.match(/^GMAIL_REFRESH_TOKEN_([a-z0-9_]+)$/);
      if (match && this.config[key]) {
        const accountName = match[1];
        const refreshToken = this.config[key];
        
        // トークンの有効性をチェック
        const tokenStatus = await this.checkTokenValidity(accountName, refreshToken);
        
        accounts.push({
          name: accountName,
          hasToken: true,
          isValid: tokenStatus.isValid,
          error: tokenStatus.error
        });
      }
    }
    
    // アカウント名でソート
    accounts.sort((a, b) => a.name.localeCompare(b.name));
    
    return accounts;
  }

  /**
   * リフレッシュトークンの有効性をチェック
   */
  async checkTokenValidity(accountName, refreshToken) {
    try {
      // OAuth2クライアントを作成
      const oauth2Client = new google.auth.OAuth2(
        this.config.GMAIL_CLIENT_ID,
        this.config.GMAIL_CLIENT_SECRET,
        this.config.GMAIL_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      
      // Gmail APIを使って軽量なテストを実行
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // プロフィール取得を試みる（最も軽量なAPI呼び出し）
      await gmail.users.getProfile({ userId: 'me' });
      
      return { isValid: true, error: null };
    } catch (error) {
      // エラーの種類を判定
      if (error.response?.data?.error === 'invalid_grant') {
        return { isValid: false, error: 'expired' };
      } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return { isValid: 'unknown', error: 'network' };
      } else {
        return { isValid: false, error: error.message };
      }
    }
  }

  /**
   * アカウント選択プロンプト
   */
  async selectAccount(accounts) {
    console.log('\n📋 アカウント選択:');
    
    if (accounts.length > 0) {
      console.log('既存のアカウント:');
      accounts.forEach((account, index) => {
        let status = '';
        if (account.isValid === true) {
          status = ' ✅';
        } else if (account.isValid === false) {
          if (account.error === 'expired') {
            status = ' ⚠️  (トークン期限切れ - 再認証が必要)';
          } else {
            status = ' ❌ (エラー: ' + account.error + ')';
          }
        } else if (account.isValid === 'unknown') {
          status = ' ❓ (ネットワークエラー - 確認できません)';
        }
        console.log(`   ${index + 1}. ${account.name}${status}`);
      });
      console.log(`   ${accounts.length + 1}. 新規アカウントを追加`);
      
      // 期限切れアカウントがある場合は警告
      const expiredAccounts = accounts.filter(a => a.isValid === false && a.error === 'expired');
      if (expiredAccounts.length > 0) {
        console.log('\n⚠️  警告: 以下のアカウントのトークンが期限切れです:');
        expiredAccounts.forEach(account => {
          console.log(`   - ${account.name}`);
        });
        console.log('   これらのアカウントを選択すると再認証が必要です。');
      }
    } else {
      console.log('トークンが設定されているアカウントはありません。');
      console.log('   1. 新規アカウントを追加');
    }
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const maxOption = accounts.length + 1;
    
    return new Promise((resolve) => {
      rl.question(`\n番号を選択 (1-${maxOption}) またはアカウント名を直接入力: `, (answer) => {
        rl.close();
        const index = parseInt(answer);
        
        if (index >= 1 && index <= accounts.length) {
          // 既存アカウントを選択
          const selectedAccount = accounts[index - 1];
          if (selectedAccount.isValid === false && selectedAccount.error === 'expired') {
            console.log(`\n⚠️  ${selectedAccount.name} のトークンは期限切れです。再認証を行います。`);
          }
          resolve(selectedAccount.name);
        } else if (index === maxOption) {
          // 新規アカウント追加を選択
          const rl2 = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          rl2.question('新規アカウント名を入力 (英数字、アンダースコア): ', (customName) => {
            rl2.close();
            if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(customName)) {
              resolve(customName);
            } else {
              console.error('❌ 無効なアカウント名です（英字で始まり、英数字・アンダースコアのみ使用可）');
              resolve(null);
            }
          });
        } else if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(answer)) {
          // 直接アカウント名を入力
          resolve(answer);
        } else {
          console.error('❌ 無効な選択です');
          resolve(null);
        }
      });
    });
  }

  /**
   * メイン認証フロー
   */
  async runAuthFlow(accountName, skipOverwritePrompt = false) {
    console.log('🚀 Gmail デスクトップ認証セットアップを開始します\n');
    console.log(`📧 対象アカウント: ${accountName}`);

    // Step 1: 設定を読み込み
    if (!this.loadConfig()) {
      return false;
    }

    // Step 2: 既存トークンの確認
    if (this.checkExistingTokens(accountName) && !skipOverwritePrompt) {
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
    
    console.log('\n🔄 重要: サーバーの再起動が必要です');
    console.log('認証トークンの更新を有効にするため、MCPサーバーを再起動してください:');
    console.log('  📋 推奨コマンド: ./scripts/server.sh restart');
    console.log('  📋 または手動で:');
    console.log('    launchctl unload ~/Library/LaunchAgents/com.user.mcp-email-server.plist');
    console.log('    launchctl load ~/Library/LaunchAgents/com.user.mcp-email-server.plist');
    console.log('\n✅ 再起動後、動作確認を実行してください:');
    console.log('  📋 npm run health:check');
    
    return true;
  }
}

// 使用方法を表示
function showUsage() {
  console.log(`
📖 使用方法:

1. 前提条件:
   - Google Cloud Console でデスクトップアプリケーション用の OAuth 2.0 クライアント ID を作成
   - .env ファイルに以下を設定（全アカウント共通）:
     GMAIL_CLIENT_ID=your-client-id
     GMAIL_CLIENT_SECRET=your-client-secret  
     GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
     
     # 認証後、各アカウントのトークンが自動追加される:
     GMAIL_REFRESH_TOKEN_account1=xxx  # アカウント1
     GMAIL_REFRESH_TOKEN_account2=xxx  # アカウント2

2. 実行:
   node scripts/gmail-desktop-auth.mjs [ACCOUNT_NAME]
   
   # 引数なしの場合: .envから利用可能なアカウントを自動検出して選択
   node scripts/gmail-desktop-auth.mjs
   
   # アカウント名を指定する場合:
   node scripts/gmail-desktop-auth.mjs account1    # アカウント1
   node scripts/gmail-desktop-auth.mjs account2    # アカウント2

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

  const auth = new GmailDesktopAuth();
  
  // 設定を先に読み込む
  if (!auth.loadConfig()) {
    process.exit(1);
  }
  
  let accountName = args[0];
  
  // 引数なしの場合、利用可能なアカウントから選択
  let skipOverwritePrompt = false;
  
  if (!accountName) {
    console.log('🔍 アカウントのトークン状態を確認中...');
    const accounts = await auth.detectAvailableAccounts();
    
    // アカウント選択プロンプトを表示
    accountName = await auth.selectAccount(accounts);
    if (!accountName) {
      process.exit(1);
    }
    
    // 選択されたアカウントが期限切れの場合、上書き確認をスキップ
    const selectedAccount = accounts.find(a => a.name === accountName);
    if (selectedAccount && selectedAccount.isValid === false && selectedAccount.error === 'expired') {
      skipOverwritePrompt = true;
      console.log(`\n⚠️  ${accountName} のトークンは期限切れのため、再認証を実行します。`);
    }
    
    console.log(`\n📧 選択されたアカウント: ${accountName}`);
  } else {
    // 引数でアカウント名が指定された場合の検証
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(accountName)) {
      console.error('❌ アカウント名は英数字とアンダースコアのみ使用可能です (例: main, work)');
      process.exit(1);
    }
    
    // 引数指定の場合もトークン状態をチェック
    console.log('🔍 トークン状態を確認中...');
    const refreshTokenKey = `GMAIL_REFRESH_TOKEN_${accountName.toLowerCase()}`;
    if (auth.config[refreshTokenKey]) {
      const tokenStatus = await auth.checkTokenValidity(accountName, auth.config[refreshTokenKey]);
      if (tokenStatus.isValid === false && tokenStatus.error === 'expired') {
        skipOverwritePrompt = true;
        console.log(`\n⚠️  ${accountName} のトークンは期限切れのため、再認証を実行します。`);
      }
    }
  }

  const success = await auth.runAuthFlow(accountName, skipOverwritePrompt);
  
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