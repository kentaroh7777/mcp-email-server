import { IMAPHandler } from '../../src/imap.js';
import * as Imap from 'imap';

async function checkFolders() {
  console.log('🔍 IMAP Folder Structure Check for kh@h-fpo.com');
  console.log('================================================');

  const accountName = 'kh_h_fpo_com';
  
  try {
    const imapHandler = new IMAPHandler();
    const availableAccounts = imapHandler.getAvailableAccounts();
    
    if (!availableAccounts.includes(accountName)) {
      console.error(`❌ アカウント ${accountName} が見つかりません`);
      return;
    }

    console.log(`✅ アカウント ${accountName} が見つかりました`);

    // IMAPコネクションを直接作成してフォルダ一覧を取得
    const config = {
      host: 'sv14111.xserver.jp',
      port: 993,
      secure: true,
      user: 'kh@h-fpo.com',
      password: process.env.XSERVER_PASSWORD_kh_h_fpo_com || ''
    };

    console.log('\n📁 フォルダ一覧を取得中...');
    
    const imap = new Imap(config);
    
    await new Promise<void>((resolve, reject) => {
      imap.once('ready', () => {
        console.log('✅ IMAP接続成功');
        
        // フォルダ一覧を取得
        imap.getBoxes((err, boxes) => {
          if (err) {
            console.error('❌ フォルダ取得エラー:', err);
            reject(err);
            return;
          }
          
          console.log('\n📂 利用可能なフォルダ:');
          console.log('===================');
          
          const printBoxes = (boxes: any, prefix = '') => {
            for (const [name, box] of Object.entries(boxes)) {
              const fullName = prefix + name;
              console.log(`${prefix}📁 ${name} (${fullName})`);
              
              if (box && typeof box === 'object' && 'children' in box && box.children) {
                printBoxes(box.children, prefix + '  ');
              }
            }
          };
          
          printBoxes(boxes);
          
          // 特定のフォルダをテスト
          const testFolders = ['Archive', 'Sent', 'Trash', 'INBOX.Archive', 'INBOX.Sent', 'INBOX.Trash', 'Deleted', 'Junk'];
          
          console.log('\n🧪 特定フォルダのテスト:');
          console.log('======================');
          
          let testIndex = 0;
          const testNextFolder = () => {
            if (testIndex >= testFolders.length) {
              imap.end();
              resolve();
              return;
            }
            
            const folderName = testFolders[testIndex];
            testIndex++;
            
            imap.openBox(folderName, true, (err, box) => {
              if (err) {
                console.log(`❌ ${folderName}: アクセス不可 (${err.message})`);
              } else {
                console.log(`✅ ${folderName}: アクセス可能 (${box.messages.total} メッセージ)`);
              }
              
              // 次のフォルダをテスト
              setTimeout(testNextFolder, 100);
            });
          };
          
          testNextFolder();
        });
      });
      
      imap.once('error', (err) => {
        console.error('❌ IMAP接続エラー:', err);
        reject(err);
      });
      
      imap.connect();
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkFolders().catch(console.error); 