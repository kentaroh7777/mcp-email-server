import { config } from 'dotenv';
import { GmailHandler } from '../src/gmail.js';

config();

async function finalSuccessTest() {
  console.log('🎯 === 最終アーカイブ成功テスト ===');
  
  const gmail = new GmailHandler();
  
  try {
    // 1. INBOX内のメール一覧
    console.log('1. INBOX内のメール一覧...');
    const inboxEmails = await gmail.listEmails('kentaroisp', { limit: 10 });
    
    if (inboxEmails.length === 0) {
      console.log('❌ INBOXにメールがありません');
      return;
    }
    
    const testEmail = inboxEmails[0];
    console.log(`📧 テスト対象: ${testEmail.subject}`);
    console.log(`📧 ID: ${testEmail.id}`);
    console.log(`📧 未読: ${testEmail.isUnread}`);
    
    // 2. アーカイブ実行
    console.log('\n2. アーカイブ実行...');
    const result = await gmail.archiveEmail('kentaroisp', testEmail.id);
    
    if (!result) {
      console.log('❌ アーカイブ失敗');
      return;
    }
    
    console.log('✅ アーカイブ実行完了');
    
    // 3. 結果確認（2秒待機）
    console.log('\n3. 結果確認（2秒待機）...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // INBOX一覧から消えているかチェック
    const newInboxEmails = await gmail.listEmails('kentaroisp', { limit: 10 });
    const stillInInbox = newInboxEmails.find(email => email.id === testEmail.id);
    
    if (stillInInbox) {
      console.log('❌ メールがまだINBOXに残っています');
    } else {
      console.log('✅ メールがINBOXから消えました！');
    }
    
    // アーカイブされたメールを検索で確認
    const archivedEmails = await gmail.searchEmails('kentaroisp', '-in:inbox', 10);
    const foundInArchive = archivedEmails.find(email => email.id === testEmail.id);
    
    if (foundInArchive) {
      console.log('✅ メールがアーカイブに存在します！');
    } else {
      console.log('❌ アーカイブでメールが見つかりません');
    }
    
    console.log(`\n📊 結果:`);
    console.log(`   - INBOX メール数: ${newInboxEmails.length} (元: ${inboxEmails.length})`);
    console.log(`   - アーカイブ メール数: ${archivedEmails.length}`);
    
    if (!stillInInbox && foundInArchive) {
      console.log('\n🎉 アーカイブ機能が完全に動作しています！');
    } else {
      console.log('\n⚠️  アーカイブに問題があります');
    }
    
  } catch (error) {
    console.log('❌ 例外エラー:', error instanceof Error ? error.message : 'Unknown error');
  }
}

finalSuccessTest().catch(console.error); 