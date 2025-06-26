import { config } from 'dotenv';
import { GmailHandler } from '../src/gmail.js';

config();

async function testUnreadArchive() {
  console.log('=== 未読メール アーカイブテスト ===');
  
  const gmail = new GmailHandler();
  
  try {
    // 未読メールを検索
    console.log('1. 未読メールを検索...');
    const unreadEmails = await gmail.searchEmails('kentaroisp', 'is:unread', 5);
    
    if (!unreadEmails || unreadEmails.length === 0) {
      console.log('❌ 未読メールが見つかりません');
      return;
    }
    
    const testEmail = unreadEmails[0];
    console.log(`📧 テスト対象: ${testEmail.subject}`);
    console.log(`📧 ID: ${testEmail.id}`);
    console.log(`📧 未読: ${testEmail.isUnread}`);
    console.log(`📧 送信者: ${testEmail.from}`);
    
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
    
    // INBOXから消えているかチェック
    const inboxEmails = await gmail.listEmails('kentaroisp', { limit: 10 });
    const stillInInbox = inboxEmails.find(email => email.id === testEmail.id);
    
    if (stillInInbox) {
      console.log('❌ メールがまだINBOXに残っています');
    } else {
      console.log('✅ メールがINBOXから消えました（アーカイブ成功！）');
    }
    
    // アーカイブされたメールを検索で確認
    console.log('\n4. アーカイブ状態確認...');
    const archivedEmails = await gmail.searchEmails('kentaroisp', `id:${testEmail.id}`, 1);
    
    if (archivedEmails.length > 0) {
      console.log('✅ メールはまだ存在します（削除されていない）');
      console.log(`📍 現在の状態: アーカイブ済み`);
    } else {
      console.log('❌ メールが見つかりません（削除された可能性）');
    }
    
    console.log(`📊 現在のINBOXメール数: ${inboxEmails.length}`);
    
  } catch (error) {
    console.log('❌ 例外エラー:', error instanceof Error ? error.message : 'Unknown error');
  }
}

testUnreadArchive().catch(console.error); 