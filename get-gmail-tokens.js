import { google } from 'googleapis';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// .envファイルから設定を読み込み
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

async function getTokens() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // 認証URLを生成
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('='.repeat(60));
  console.log('Gmail OAuth2 トークン取得ガイド');
  console.log('='.repeat(60));
  console.log();
  console.log('ステップ1: 以下のURLをブラウザで開いてください：');
  console.log();
  console.log(authUrl);
  console.log();
  console.log('ステップ2: Googleアカウントでログインし、アクセスを許可してください');
  console.log('ステップ3: リダイレクトされたURLから認証コードをコピーしてください');
  console.log('例: http://localhost:3000/oauth2callback?code=AUTHORIZATION_CODE&scope=...');
  console.log('     ↑ この AUTHORIZATION_CODE 部分をコピー');
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('認証コードを入力してください: ', async (code) => {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log();
      console.log('='.repeat(60));
      console.log('✅ トークン取得成功！');
      console.log('='.repeat(60));
      console.log();
      console.log('以下を.envファイルに追加してください：');
      console.log();
      console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GMAIL_REDIRECT_URI=${REDIRECT_URI}`);
      console.log(`GMAIL_ACCESS_TOKEN_personal=${tokens.access_token}`);
      console.log(`GMAIL_REFRESH_TOKEN_personal=${tokens.refresh_token}`);
      console.log();
      console.log('※ personalの部分はアカウント名です（任意の名前に変更可能）');
      console.log();

    } catch (error) {
      console.error('エラー:', error.message);
    }
    rl.close();
  });
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('❌ エラー: .envファイルにGMAIL設定が見つかりません');
  console.log('   以下を.envファイルに追加してください：');
  console.log('   GMAIL_CLIENT_ID=your-client-id');
  console.log('   GMAIL_CLIENT_SECRET=your-client-secret');
  console.log('   GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback');
} else {
  getTokens();
} 