import { IMAPHandler } from '../../src/imap.js';
import * as dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

async function debugAccountLoading() {
  console.log('🔍 IMAP Account Loading Debug');
  console.log('=============================');

  try {
    // 環境変数を直接確認
    console.log('\n1. 環境変数確認:');
    const khVars = Object.keys(process.env).filter(key => key.includes('kh_h_fpo_com'));
    console.log('kh_h_fpo_com関連の環境変数:');
    khVars.forEach(key => {
      const value = process.env[key];
      console.log(`  ${key}: ${value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : 'undefined'}`);
    });

    // IMAPハンドラーを初期化
    console.log('\n2. IMAPハンドラー初期化:');
    const imapHandler = new IMAPHandler();
    
    // 利用可能なアカウント一覧を取得
    console.log('\n3. 利用可能なアカウント一覧:');
    const availableAccounts = imapHandler.getAvailableAccounts();
    console.log(`アカウント数: ${availableAccounts.length}`);
    availableAccounts.forEach((account, index) => {
      console.log(`  ${index + 1}. ${account}`);
    });

    // kh_h_fpo_comが含まれているかチェック
    const targetAccount = 'kh_h_fpo_com';
    const isFound = availableAccounts.includes(targetAccount);
    console.log(`\n4. ${targetAccount} の存在確認:`);
    console.log(`  結果: ${isFound ? '✅ 見つかりました' : '❌ 見つかりません'}`);

    if (!isFound) {
      console.log('\n5. アカウントが見つからない原因調査:');
      
      // 暗号化キーの確認
      const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;
      console.log(`  暗号化キー: ${encryptionKey ? '設定済み' : '未設定'}`);
      
      // XServer関連の環境変数パターンを確認
      const xserverVars = Object.keys(process.env).filter(key => key.startsWith('XSERVER_'));
      console.log(`  XServer環境変数数: ${xserverVars.length}`);
      xserverVars.forEach(key => {
        console.log(`    ${key}: ${process.env[key] ? '設定済み' : '未設定'}`);
      });

      // 手動でアカウントを追加してみる
      console.log('\n6. 手動アカウント追加テスト:');
      try {
        const server = process.env.XSERVER_SERVER_kh_h_fpo_com;
        const domain = process.env.XSERVER_DOMAIN_kh_h_fpo_com;
        const username = process.env.XSERVER_USERNAME_kh_h_fpo_com;
        const password = process.env.XSERVER_PASSWORD_kh_h_fpo_com;

        console.log(`  Server: ${server}`);
        console.log(`  Domain: ${domain}`);
        console.log(`  Username: ${username}`);
        console.log(`  Password: ${password ? '設定済み' : '未設定'}`);

        if (server && domain && username && password) {
          imapHandler.addXServerAccount(targetAccount, server, domain, username, password);
          console.log('  ✅ 手動追加成功');
          
          const updatedAccounts = imapHandler.getAvailableAccounts();
          console.log(`  更新後のアカウント数: ${updatedAccounts.length}`);
          console.log(`  ${targetAccount}の存在: ${updatedAccounts.includes(targetAccount) ? '✅ あり' : '❌ なし'}`);
        } else {
          console.log('  ❌ 必要な環境変数が不足しています');
        }
      } catch (error) {
        console.error('  ❌ 手動追加エラー:', error);
      }
    }

    // 簡単な接続テスト
    if (availableAccounts.includes(targetAccount)) {
      console.log('\n7. 接続テスト:');
      try {
        const emails = await imapHandler.listEmails(targetAccount, { folder: 'INBOX', limit: 1 });
        console.log(`  ✅ 接続成功 (${emails.length}件のメール)`);
      } catch (error) {
        console.error('  ❌ 接続エラー:', error);
      }
    }

  } catch (error) {
    console.error('❌ 全体エラー:', error);
  }
}

debugAccountLoading().catch(console.error); 