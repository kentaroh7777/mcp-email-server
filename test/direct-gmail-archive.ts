import { config } from 'dotenv';
import { GmailHandler } from '../src/gmail.js';

config();

async function directGmailArchive() {
  console.log('=== 直接Gmail アーカイブテスト（UNREAD削除版） ===');
  
  const gmail = new GmailHandler();
  
  try {
    // メール一覧取得
    console.log('1. INBOXのメール一覧を取得...');
    const emails = await gmail.listEmails('kentaroisp', { limit: 1 });
    
    if (!emails || emails.length === 0) {
      console.log('❌ INBOXにメールが見つかりません');
      return;
    }
    
    const testEmail = emails[0];
    console.log(`📧 テスト対象: ${testEmail.subject}`);
    console.log(`📧 ID: ${testEmail.id}`);
    console.log(`📧 未読: ${testEmail.isUnread}`);
    
    // アーカイブ実行
    console.log('\n2. アーカイブ実行...');
    const result = await gmail.archiveEmail('kentaroisp', testEmail.id);
    
    if (result) {
      console.log('✅ アーカイブ実行完了');
    } else {
      console.log('❌ アーカイブ失敗');
      return;
    }
    
    // 移動確認
    console.log('\n3. 移動確認...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verifyEmails = await gmail.listEmails('kentaroisp', { limit: 5 });
    const stillInInbox = verifyEmails.find(email => email.id === testEmail.id);
    
    if (stillInInbox) {
      console.log('❌ メールがまだINBOXに残っています');
      console.log('🔍 Gmailの自動カテゴリ再分類が発生している可能性があります');
    } else {
      console.log('✅ メールがINBOXから消えました（アーカイブ成功！）');
    }
    
    console.log(`📊 現在のINBOXメール数: ${verifyEmails.length}`);
    
  } catch (error) {
    console.log('❌ 例外エラー:', error instanceof Error ? error.message : 'Unknown error');
  }
}

directGmailArchive().catch(console.error); 