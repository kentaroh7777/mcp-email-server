import { IMAPHandler } from '../../src/imap.js';
import { MCPEmailServer } from '../../src/index.js';
import * as dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

async function debugKHArchive() {
  console.log('🔍 IMAP Archive Debug for kh@h-fpo.com');
  console.log('=====================================');

  const accountName = 'kh_h_fpo_com';
  
  try {
    // 1. IMAPハンドラーの初期化確認
    console.log('\n1. IMAPハンドラー初期化確認');
    const imapHandler = new IMAPHandler();
    const availableAccounts = imapHandler.getAvailableAccounts();
    console.log('利用可能なIMAPアカウント:', availableAccounts);
    
    if (!availableAccounts.includes(accountName)) {
      console.error(`❌ アカウント ${accountName} が見つかりません`);
      return;
    }
    console.log(`✅ アカウント ${accountName} が見つかりました`);

    // 2. メール一覧取得テスト
    console.log('\n2. メール一覧取得テスト');
    const emails = await imapHandler.listEmails(accountName, { folder: 'INBOX', limit: 5 });
    console.log(`📧 メール数: ${emails.length}`);
    
    if (emails.length === 0) {
      console.log('📭 メールがありません。テスト終了。');
      return;
    }

    // 最初のメールを選択
    const testEmail = emails[0];
    console.log(`🎯 テスト対象メール: ID=${testEmail.id}, Subject="${testEmail.subject}"`);

    // 3. アーカイブ実行前の状態確認
    console.log('\n3. アーカイブ実行前の状態確認');
    console.log(`メールID: ${testEmail.id}`);
    console.log(`件名: ${testEmail.subject}`);
    console.log(`送信者: ${testEmail.from}`);
    console.log(`現在のフォルダ: INBOX`);

    // 4. アーカイブ実行
    console.log('\n4. アーカイブ実行');
    try {
      console.log('🔄 アーカイブ処理を実行中...');
      const archiveResult = await imapHandler.archiveEmail(accountName, testEmail.id);
      console.log('✅ アーカイブ成功:', archiveResult);

      // 5. アーカイブ後の確認
      console.log('\n5. アーカイブ後の確認');
      
      // INBOXから削除されたか確認
      const inboxAfter = await imapHandler.listEmails(accountName, { folder: 'INBOX', limit: 10 });
      const stillInInbox = inboxAfter.find(email => email.id === testEmail.id);
      
      if (stillInInbox) {
        console.log('⚠️  メールはまだINBOXにあります');
      } else {
        console.log('✅ メールはINBOXから削除されました');
      }

      // Archive/Sent/Trash フォルダを確認
      const foldersToCheck = ['Archive', 'Sent', 'Trash', 'INBOX.Archive', 'INBOX.Sent', 'INBOX.Trash'];
      let foundInFolder: string | null = null;
      let archivedEmailDetails: any = null;
      
      for (const folder of foldersToCheck) {
        try {
          console.log(`📁 ${folder} フォルダをチェック中...`);
          const folderEmails = await imapHandler.listEmails(accountName, { folder: folder, limit: 50 });
          const archivedEmail = folderEmails.find(email => 
            email.id === testEmail.id || 
            email.subject === testEmail.subject ||
            email.subject.includes(testEmail.subject.substring(0, 10)) // 部分一致も確認
          );
          
          if (archivedEmail) {
            console.log(`✅ メールが ${folder} フォルダに見つかりました`);
            console.log(`   ID: ${archivedEmail.id}`);
            console.log(`   件名: ${archivedEmail.subject}`);
            console.log(`   送信者: ${archivedEmail.from}`);
            console.log(`   日時: ${archivedEmail.date}`);
            foundInFolder = folder;
            archivedEmailDetails = archivedEmail;
            
            // メール詳細も取得して確認
            try {
              const emailDetail = await imapHandler.getEmailDetail(accountName, archivedEmail.id);
              console.log(`   📄 メール詳細取得成功 - 本文長: ${emailDetail.body?.length || 0}文字`);
            } catch (detailError) {
              console.log(`   ⚠️  メール詳細取得失敗: ${(detailError as Error).message}`);
            }
          } else {
            console.log(`❌ メールは ${folder} フォルダにありません (${folderEmails.length}件中)`);
          }
        } catch (folderError) {
          console.log(`⚠️  ${folder} フォルダにアクセスできません:`, (folderError as Error).message);
        }
      }

      // 移動確認の結果をサマリー
      console.log('\n📊 アーカイブ結果サマリー:');
      console.log('========================');
      if (stillInInbox && foundInFolder) {
        console.log('🔄 メールは複製されました（元のINBOXにも残存）');
        console.log(`   INBOXのID: ${testEmail.id}`);
                 console.log(`   ${foundInFolder}のID: ${archivedEmailDetails?.id || 'unknown'}`);
      } else if (!stillInInbox && foundInFolder) {
        console.log('✅ メールは正常に移動されました');
        console.log(`   移動先: ${foundInFolder}`);
                 console.log(`   新しいID: ${archivedEmailDetails?.id || 'unknown'}`);
      } else if (stillInInbox && !foundInFolder) {
        console.log('❌ アーカイブ失敗: メールがINBOXに残ったまま');
      } else {
        console.log('⚠️  メールが見つかりません（削除された可能性）');
      }

    } catch (archiveError) {
      console.error('❌ アーカイブエラー:', archiveError);
      
      // エラーの詳細分析
      console.log('\n🔍 エラー詳細分析:');
      console.log('エラーメッセージ:', (archiveError as Error).message);
      console.log('エラータイプ:', (archiveError as Error).constructor.name);
      console.log('スタックトレース:', (archiveError as Error).stack);
    }

  } catch (error) {
    console.error('❌ 全体エラー:', error);
  }
}

// MCP経由での単一メールアーカイブテスト
async function debugMCPArchive() {
  console.log('\n\n🔍 MCP経由での単一メールアーカイブテスト');
  console.log('========================================');

  const server = new MCPEmailServer();
  const accountName = 'kh_h_fpo_com';

  try {
    // メール一覧取得
    console.log('1. MCP経由でメール一覧取得');
    const listRequest = {
      jsonrpc: '2.0' as const,
      id: 'test-list',
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: {
          account_name: accountName,
          limit: 3
        }
      }
    };

    const listResponse = await server.handleRequest(listRequest);
    console.log('メール一覧レスポンス:', JSON.stringify(listResponse, null, 2));

    if (listResponse.error) {
      console.error('❌ メール一覧取得エラー:', listResponse.error);
      return;
    }

    const listData = JSON.parse(listResponse.result.content[0].text);
    if (!listData.emails || listData.emails.length === 0) {
      console.log('📭 メールがありません');
      return;
    }

    const testEmailId = listData.emails[0].id;
    console.log(`🎯 テスト対象メールID: ${testEmailId}`);

    // 単一メールアーカイブ実行
    console.log('\n2. MCP経由で単一メールアーカイブ実行');
    const archiveRequest = {
      jsonrpc: '2.0' as const,
      id: 'test-archive',
      method: 'tools/call',
      params: {
        name: 'archive_email',
        arguments: {
          account_name: accountName,
          email_id: testEmailId,
          remove_unread: true
        }
      }
    };

    const archiveResponse = await server.handleRequest(archiveRequest);
    console.log('アーカイブレスポンス:', JSON.stringify(archiveResponse, null, 2));

    if (archiveResponse.error) {
      console.error('❌ MCPアーカイブエラー:', archiveResponse.error);
    } else {
      console.log('✅ MCP単一メールアーカイブ成功');
    }

  } catch (error) {
    console.error('❌ MCPテストエラー:', error);
  }
}

// MCP経由での複数メールアーカイブテスト
async function debugMCPBulkArchive() {
  console.log('\n\n🔍 MCP経由での複数メールアーカイブテスト');
  console.log('========================================');

  const server = new MCPEmailServer();
  const accountName = 'kh_h_fpo_com';

  try {
    // メール一覧取得（複数メール用）
    console.log('1. MCP経由でメール一覧取得（複数メール用）');
    const listRequest = {
      jsonrpc: '2.0' as const,
      id: 'test-bulk-list',
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: {
          account_name: accountName,
          limit: 5
        }
      }
    };

    const listResponse = await server.handleRequest(listRequest);
    console.log('メール一覧レスポンス:', JSON.stringify(listResponse, null, 2));

    if (listResponse.error) {
      console.error('❌ メール一覧取得エラー:', listResponse.error);
      return;
    }

    const listData = JSON.parse(listResponse.result.content[0].text);
    if (!listData.emails || listData.emails.length < 2) {
      console.log('📭 複数メールテストに十分なメールがありません（2件以上必要）');
      return;
    }

    // 複数メールIDを選択（最大3件）
    const testEmailIds = listData.emails.slice(0, Math.min(3, listData.emails.length)).map((email: any) => email.id);
    console.log(`🎯 テスト対象メールIDs: ${testEmailIds.join(', ')}`);
    console.log(`📧 対象メール件数: ${testEmailIds.length}件`);

    // 複数メールアーカイブ実行（配列形式）
    console.log('\n2. MCP経由で複数メールアーカイブ実行（配列形式）');
    const bulkArchiveRequest = {
      jsonrpc: '2.0' as const,
      id: 'test-bulk-archive',
      method: 'tools/call',
      params: {
        name: 'archive_email',
        arguments: {
          account_name: accountName,
          email_id: testEmailIds, // 配列で複数メールID指定
          remove_unread: true
        }
      }
    };

    const bulkArchiveResponse = await server.handleRequest(bulkArchiveRequest);
    console.log('複数メールアーカイブレスポンス:', JSON.stringify(bulkArchiveResponse, null, 2));

    if (bulkArchiveResponse.error) {
      console.error('❌ MCP複数メールアーカイブエラー:', bulkArchiveResponse.error);
    } else {
      console.log('✅ MCP複数メールアーカイブ成功');
      
      // レスポンスの詳細分析
      const bulkData = JSON.parse(bulkArchiveResponse.result.content[0].text);
      console.log('\n📊 複数メールアーカイブ結果分析:');
      console.log(`   総メール数: ${bulkData.total}件`);
      console.log(`   成功: ${bulkData.successful}件`);
      console.log(`   失敗: ${bulkData.failed}件`);
      
      if (bulkData.results && bulkData.results.length > 0) {
        console.log('\n✅ 成功したメール:');
        bulkData.results.forEach((result: any, index: number) => {
          console.log(`   ${index + 1}. メールID: ${result.email_id} - ステータス: ${result.status}`);
        });
      }
      
      if (bulkData.errors && bulkData.errors.length > 0) {
        console.log('\n❌ 失敗したメール:');
        bulkData.errors.forEach((error: any, index: number) => {
          console.log(`   ${index + 1}. メールID: ${error.email_id} - エラー: ${error.error}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ MCP複数メールテストエラー:', error);
  }
}

// 混合テスト（Gmail + IMAP）
async function debugMixedAccountArchive() {
  console.log('\n\n🔍 混合アカウント（Gmail + IMAP）アーカイブテスト');
  console.log('================================================');

  const server = new MCPEmailServer();
  const gmailAccount = 'kentaroh7'; // 実際のGmailアカウント
  const imapAccount = 'kh_h_fpo_com'; // IMAPアカウント

  try {
    // Gmail メール取得
    console.log('1. Gmailメール一覧取得');
    const gmailListRequest = {
      jsonrpc: '2.0' as const,
      id: 'test-gmail-list',
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: {
          account_name: gmailAccount,
          limit: 2
        }
      }
    };

    const gmailListResponse = await server.handleRequest(gmailListRequest);
    let gmailEmailIds: string[] = [];
    
    if (!gmailListResponse.error) {
      const gmailData = JSON.parse(gmailListResponse.result.content[0].text);
      if (gmailData.emails && gmailData.emails.length > 0) {
        gmailEmailIds = gmailData.emails.slice(0, 1).map((email: any) => email.id);
        console.log(`📧 Gmail メールID: ${gmailEmailIds.join(', ')}`);
      }
    }

    // IMAP メール取得
    console.log('\n2. IMAPメール一覧取得');
    const imapListRequest = {
      jsonrpc: '2.0' as const,
      id: 'test-imap-list',
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: {
          account_name: imapAccount,
          limit: 2
        }
      }
    };

    const imapListResponse = await server.handleRequest(imapListRequest);
    let imapEmailIds: string[] = [];
    
    if (!imapListResponse.error) {
      const imapData = JSON.parse(imapListResponse.result.content[0].text);
      if (imapData.emails && imapData.emails.length > 0) {
        imapEmailIds = imapData.emails.slice(0, 1).map((email: any) => email.id);
        console.log(`📧 IMAP メールID: ${imapEmailIds.join(', ')}`);
      }
    }

    // 各アカウントで個別にアーカイブテスト
    if (gmailEmailIds.length > 0) {
      console.log('\n3. Gmailアーカイブテスト');
      const gmailArchiveRequest = {
        jsonrpc: '2.0' as const,
        id: 'test-gmail-archive',
        method: 'tools/call',
        params: {
          name: 'archive_email',
          arguments: {
            account_name: gmailAccount,
            email_id: gmailEmailIds,
            remove_unread: true
          }
        }
      };

      const gmailArchiveResponse = await server.handleRequest(gmailArchiveRequest);
      if (gmailArchiveResponse.error) {
        console.error('❌ Gmailアーカイブエラー:', gmailArchiveResponse.error);
      } else {
        console.log('✅ Gmailアーカイブ成功');
      }
    }

    if (imapEmailIds.length > 0) {
      console.log('\n4. IMAPアーカイブテスト');
      const imapArchiveRequest = {
        jsonrpc: '2.0' as const,
        id: 'test-imap-archive',
        method: 'tools/call',
        params: {
          name: 'archive_email',
          arguments: {
            account_name: imapAccount,
            email_id: imapEmailIds,
            remove_unread: false
          }
        }
      };

      const imapArchiveResponse = await server.handleRequest(imapArchiveRequest);
      if (imapArchiveResponse.error) {
        console.error('❌ IMAPアーカイブエラー:', imapArchiveResponse.error);
      } else {
        console.log('✅ IMAPアーカイブ成功');
      }
    }

  } catch (error) {
    console.error('❌ 混合アカウントテストエラー:', error);
  }
}

// メイン実行
async function main() {
  console.log('Enhanced IMAP Archive Debug Script - 複数メール対応版');
  console.log('===================================================');
  console.log(`実行時刻: ${new Date().toLocaleString()}`);

  // 基本的なIMAPアーカイブテスト
  await debugKHArchive();
  
  // MCP経由での単一メールアーカイブテスト
  await debugMCPArchive();
  
  // MCP経由での複数メールアーカイブテスト（新機能）
  await debugMCPBulkArchive();
  
  // 混合アカウントテスト（Gmail + IMAP）
  await debugMixedAccountArchive();

  console.log('\n🏁 拡張デバッグ完了');
  console.log('テスト内容:');
  console.log('- ✅ 基本IMAPアーカイブ');
  console.log('- ✅ MCP単一メールアーカイブ');
  console.log('- ✅ MCP複数メールアーカイブ（新機能）');
  console.log('- ✅ 混合アカウント（Gmail + IMAP）アーカイブ');
}

main().catch(console.error); 