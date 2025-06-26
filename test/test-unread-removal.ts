import { config } from 'dotenv';
import { GmailHandler } from '../src/gmail.js';

config();

async function testUnreadRemoval() {
  console.log('🔍 === UNREADラベル削除テスト ===');
  
  const gmail = new GmailHandler();
  
  try {
    // 1. 未読メールを検索
    console.log('1. 未読メールを検索...');
    const unreadEmails = await gmail.searchEmails('kentaroisp', 'is:unread in:inbox', 5);
    
    if (!unreadEmails || unreadEmails.length === 0) {
      console.log('❌ INBOX内の未読メールが見つかりません');
      return;
    }
    
    const testEmail = unreadEmails[0];
    console.log(`📧 テスト対象: ${testEmail.subject}`);
    console.log(`📧 ID: ${testEmail.id}`);
    console.log(`📧 未読: ${testEmail.isUnread}`);
    
    // 2. UNREADラベルも削除するカスタムアーカイブを実行
    console.log('\n2. UNREADラベル削除アーカイブ実行...');
    
    // Gmail APIを直接使用してUNREADも削除
    const gmailApi = await gmail.authenticate('kentaroisp');
    
    // アーカイブ前のラベル確認
    const beforeModify = await gmailApi.users.messages.get({
      userId: 'me',
      id: testEmail.id,
      format: 'minimal'
    });
    
    const beforeLabels = beforeModify.data.labelIds || [];
    console.log(`[DEBUG] アーカイブ前のラベル: ${beforeLabels.join(', ')}`);
    
    // INBOXラベルがない場合は追加
    if (!beforeLabels.includes('INBOX')) {
      console.log(`[DEBUG] INBOXラベルを追加...`);
      await gmailApi.users.messages.modify({
        userId: 'me',
        id: testEmail.id,
        requestBody: {
          addLabelIds: ['INBOX']
        }
      });
    }
    
    // 削除対象ラベルを特定（UNREADも含む）
    const labelsToRemove: string[] = ['INBOX'];
    
    // カテゴリラベルを削除対象に追加
    const categoryLabels = beforeLabels.filter(label => 
      label.startsWith('CATEGORY_')
    );
    labelsToRemove.push(...categoryLabels);
    
    // UNREADラベルも削除対象に追加
    if (beforeLabels.includes('UNREAD')) {
      labelsToRemove.push('UNREAD');
    }
    
    console.log(`[DEBUG] 削除対象ラベル: ${labelsToRemove.join(', ')}`);
    
    // ラベル削除
    await gmailApi.users.messages.modify({
      userId: 'me',
      id: testEmail.id,
      requestBody: {
        removeLabelIds: labelsToRemove
      }
    });
    
    // CATEGORY_PERSONALを追加
    await gmailApi.users.messages.modify({
      userId: 'me',
      id: testEmail.id,
      requestBody: {
        addLabelIds: ['CATEGORY_PERSONAL']
      }
    });
    
    // アーカイブ後のラベル確認
    const afterModify = await gmailApi.users.messages.get({
      userId: 'me',
      id: testEmail.id,
      format: 'minimal'
    });
    
    console.log(`[DEBUG] アーカイブ後のラベル: ${afterModify.data.labelIds?.join(', ')}`);
    
    // 3. 結果確認
    console.log('\n3. 結果確認（2秒待機）...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // INBOXから消えているかチェック
    const inboxEmails = await gmail.listEmails('kentaroisp', { limit: 10 });
    const stillInInbox = inboxEmails.find(email => email.id === testEmail.id);
    
    if (stillInInbox) {
      console.log('❌ メールがまだINBOXに残っています');
    } else {
      console.log('✅ メールがINBOXから消えました！');
    }
    
    // 未読メール検索で見つかるかチェック
    const stillUnread = await gmail.searchEmails('kentaroisp', 'is:unread', 20);
    const foundAsUnread = stillUnread.find(email => email.id === testEmail.id);
    
    if (foundAsUnread) {
      console.log('📧 メールはまだ未読として検索されます');
    } else {
      console.log('✅ メールは未読検索から消えました（UNREADラベル削除成功）');
    }
    
    // アーカイブ検索で見つかるかチェック
    const archivedEmails = await gmail.searchEmails('kentaroisp', '-in:inbox', 10);
    const foundInArchive = archivedEmails.find(email => email.id === testEmail.id);
    
    if (foundInArchive) {
      console.log('✅ メールがアーカイブに存在します！');
    } else {
      console.log('❌ アーカイブでメールが見つかりません');
    }
    
    console.log('\n📊 結果まとめ:');
    console.log(`   - INBOXから削除: ${!stillInInbox ? '✅' : '❌'}`);
    console.log(`   - UNREADラベル削除: ${!foundAsUnread ? '✅' : '❌'}`);
    console.log(`   - アーカイブ保存: ${foundInArchive ? '✅' : '❌'}`);
    
  } catch (error) {
    console.log('❌ 例外エラー:', error instanceof Error ? error.message : 'Unknown error');
  }
}

testUnreadRemoval().catch(console.error); 