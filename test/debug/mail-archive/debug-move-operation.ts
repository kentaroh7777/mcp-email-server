import { IMAPHandler } from '../../src/imap.js';
import * as dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

async function debugMoveOperation() {
  console.log('🔍 IMAP Move Operation Debug');
  console.log('============================');

  const accountName = 'kh_h_fpo_com';
  const imapHandler = new IMAPHandler();
  
  try {
    // 1. メール一覧取得
    console.log('\n1. メール一覧取得');
    const emails = await imapHandler.listEmails(accountName, { folder: 'INBOX', limit: 1 });
    
    if (emails.length === 0) {
      console.log('📭 メールがありません');
      return;
    }

    const testEmail = emails[0];
    console.log(`🎯 テスト対象: ID=${testEmail.id}, Subject="${testEmail.subject}"`);

    // 2. 削除フラグテスト（最もシンプル）
    console.log('\n2. 削除フラグテスト（10秒タイムアウト）');
    try {
      // タイムアウトを短縮してテスト
      const result = await Promise.race([
        testDeleteFlag(imapHandler, accountName, testEmail.id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('削除フラグテスト タイムアウト')), 10000)
        )
      ]);
      console.log('✅ 削除フラグテスト成功:', result);
    } catch (error) {
      console.error('❌ 削除フラグテスト失敗:', error);
    }

    // 3. 別のメールで削除フラグのみテスト
    console.log('\n3. 削除フラグのみテスト');
    const emails2 = await imapHandler.listEmails(accountName, { folder: 'INBOX', limit: 2 });
    if (emails2.length > 1) {
      const testEmail2 = emails2[1];
      console.log(`🎯 テスト対象2: ID=${testEmail2.id}, Subject="${testEmail2.subject}"`);
      
      try {
        const result = await Promise.race([
          testOnlyDeleteFlag(imapHandler, accountName, testEmail2.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('削除フラグのみテスト タイムアウト')), 10000)
          )
        ]);
        console.log('✅ 削除フラグのみテスト成功:', result);
      } catch (error) {
        console.error('❌ 削除フラグのみテスト失敗:', error);
      }
    }

  } catch (error) {
    console.error('❌ 全体エラー:', error);
  }
}

// 削除フラグ + 既読フラグのテスト
async function testDeleteFlag(imapHandler: IMAPHandler, accountName: string, emailId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // プライベートメソッドにアクセスするため、any型でキャスト
    const handler = imapHandler as any;
    
    handler.getConnection(accountName).then((imap: any) => {
      handler.openBox(imap, 'INBOX', false).then(() => {
        const uid = parseInt(emailId);
        console.log(`  🔄 削除フラグ + 既読フラグを設定中... (UID: ${uid})`);
        
        imap.addFlags(uid, ['\\Deleted', '\\Seen'], (err: any) => {
          if (err) {
            reject(new Error(`削除フラグ設定エラー: ${err.message}`));
          } else {
            console.log('  ✅ フラグ設定成功');
            resolve(true);
          }
        });
      }).catch(reject);
    }).catch(reject);
  });
}

// 削除フラグのみのテスト
async function testOnlyDeleteFlag(imapHandler: IMAPHandler, accountName: string, emailId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // プライベートメソッドにアクセスするため、any型でキャスト
    const handler = imapHandler as any;
    
    handler.getConnection(accountName).then((imap: any) => {
      handler.openBox(imap, 'INBOX', false).then(() => {
        const uid = parseInt(emailId);
        console.log(`  🔄 削除フラグのみ設定中... (UID: ${uid})`);
        
        imap.addFlags(uid, ['\\Deleted'], (err: any) => {
          if (err) {
            reject(new Error(`削除フラグ設定エラー: ${err.message}`));
          } else {
            console.log('  ✅ 削除フラグ設定成功');
            resolve(true);
          }
        });
      }).catch(reject);
    }).catch(reject);
  });
}

debugMoveOperation().catch(console.error); 