import { IMAPHandler } from '../../src/imap.js';
import * as dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

async function testFolders() {
  console.log('🔍 Simple Folder Test for kh@h-fpo.com');
  console.log('======================================');

  const accountName = 'kh_h_fpo_com';
  const imapHandler = new IMAPHandler();
  
  // よくあるフォルダ名をテスト
  const foldersToTest = [
    'INBOX',
    'Sent',
    'Archive', 
    'Trash',
    'Deleted',
    'Junk',
    'Spam',
    'INBOX.Sent',
    'INBOX.Archive',
    'INBOX.Trash',
    'INBOX.Deleted',
    'INBOX.Junk',
    'INBOX.Spam',
    'Sent Items',
    'Deleted Items',
    '送信済み',
    'ゴミ箱',
    'アーカイブ'
  ];

  console.log(`\n📁 ${foldersToTest.length}個のフォルダをテスト中...`);
  
  const accessibleFolders: string[] = [];
  const inaccessibleFolders: string[] = [];

  for (const folder of foldersToTest) {
    try {
      console.log(`📂 テスト中: ${folder}`);
      const emails = await imapHandler.listEmails(accountName, { folder: folder, limit: 1 });
      console.log(`  ✅ アクセス可能 (${emails.length >= 0 ? 'メール取得成功' : 'メール取得失敗'})`);
      accessibleFolders.push(folder);
    } catch (error) {
      console.log(`  ❌ アクセス不可: ${(error as Error).message}`);
      inaccessibleFolders.push(folder);
    }
    
    // サーバーに負荷をかけないよう少し待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 結果サマリー:');
  console.log('===============');
  console.log(`✅ アクセス可能なフォルダ (${accessibleFolders.length}個):`);
  accessibleFolders.forEach(folder => console.log(`   - ${folder}`));
  
  console.log(`\n❌ アクセス不可なフォルダ (${inaccessibleFolders.length}個):`);
  inaccessibleFolders.forEach(folder => console.log(`   - ${folder}`));

  // アーカイブに使えそうなフォルダを特定
  const archiveCandidates = accessibleFolders.filter(folder => 
    folder.toLowerCase().includes('sent') || 
    folder.toLowerCase().includes('archive') ||
    folder.includes('送信済み') ||
    folder.includes('アーカイブ')
  );

  console.log(`\n🎯 アーカイブ候補フォルダ (${archiveCandidates.length}個):`);
  archiveCandidates.forEach(folder => console.log(`   - ${folder}`));

  if (archiveCandidates.length === 0) {
    console.log('\n⚠️  アーカイブ用フォルダが見つかりません。');
    console.log('    削除フラグ(\\Deleted)の設定のみ使用することを推奨します。');
  }
}

testFolders().catch(console.error); 