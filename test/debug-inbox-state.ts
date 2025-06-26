import { config } from 'dotenv';
import { GmailHandler } from '../src/gmail.js';

config();

async function debugInboxState() {
  console.log('=== INBOX状態デバッグ ===');
  
  const gmail = new GmailHandler();
  
  try {
    // 1. INBOX内のメール一覧（詳細）
    console.log('1. INBOX内のメール一覧...');
    const inboxEmails = await gmail.listEmails('kentaroisp', { limit: 5 });
    
    console.log(`📊 INBOX内メール数: ${inboxEmails.length}`);
    inboxEmails.forEach((email, i) => {
      console.log(`${i+1}. ID: ${email.id}`);
      console.log(`   件名: ${email.subject.substring(0, 50)}...`);
      console.log(`   未読: ${email.isUnread}`);
      console.log('');
    });
    
    // 2. 特定のメールID検索
    const targetId = '197ab9f965c194b0';
    console.log(`\n2. 特定メール検索 (ID: ${targetId})...`);
    
    try {
      const searchResult = await gmail.searchEmails('kentaroisp', `rfc822msgid:${targetId}`, 1);
      console.log(`検索結果数: ${searchResult.length}`);
      
      if (searchResult.length > 0) {
        console.log(`✅ メール見つかりました: ${searchResult[0].subject}`);
      } else {
        console.log(`❌ メールが見つかりません`);
      }
    } catch (error) {
      console.log(`❌ 検索エラー: ${error}`);
    }
    
    // 3. 未読メール一覧
    console.log(`\n3. 未読メール一覧...`);
    const unreadEmails = await gmail.searchEmails('kentaroisp', 'is:unread', 10);
    console.log(`📊 未読メール数: ${unreadEmails.length}`);
    
    unreadEmails.forEach((email, i) => {
      console.log(`${i+1}. ID: ${email.id}`);
      console.log(`   件名: ${email.subject.substring(0, 50)}...`);
      console.log('');
    });
    
    // 4. アーカイブされたメール検索
    console.log(`\n4. アーカイブメール検索...`);
    const archivedEmails = await gmail.searchEmails('kentaroisp', '-in:inbox', 5);
    console.log(`📊 アーカイブメール数: ${archivedEmails.length}`);
    
    archivedEmails.forEach((email, i) => {
      console.log(`${i+1}. ID: ${email.id}`);
      console.log(`   件名: ${email.subject.substring(0, 50)}...`);
      console.log('');
    });
    
  } catch (error) {
    console.log('❌ 例外エラー:', error instanceof Error ? error.message : 'Unknown error');
  }
}

debugInboxState().catch(console.error); 