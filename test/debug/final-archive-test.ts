import { config } from 'dotenv';
import { MCPEmailProtocolHandler } from '../src/mcp-handler.js';

config();

async function finalArchiveTest() {
  console.log('=== 最終アーカイブテスト（UNREAD削除版） ===');
  
  const handler = new MCPEmailProtocolHandler();
  
  try {
    // メール一覧取得
    const listResponse = await handler.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: { account_name: 'MAIN', limit: 1 }
      }
    });
    
    if (listResponse.error) {
      console.log('❌ メール一覧取得エラー:', listResponse.error.message);
      return;
    }
    
    const emailData = JSON.parse(listResponse.result.content[0].text);
    if (!emailData.emails || emailData.emails.length === 0) {
      console.log('❌ INBOXにメールが見つかりません');
      return;
    }
    
    const testEmail = emailData.emails[0];
    console.log(`📧 テスト対象: ${testEmail.subject}`);
    console.log(`📧 ID: ${testEmail.id}`);
    
    // アーカイブ実行
    const archiveResponse = await handler.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'archive_email',
        arguments: {
          account_name: 'MAIN',
          email_id: testEmail.id
        }
      }
    });
    
    if (archiveResponse.error) {
      console.log('❌ アーカイブエラー:', archiveResponse.error.message);
      return;
    }
    
    console.log('✅ アーカイブ実行完了');
    
    // 移動確認
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verifyResponse = await handler.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: { account_name: 'MAIN', limit: 5 }
      }
    });
    
    if (verifyResponse.error) {
      console.log('❌ 確認エラー:', verifyResponse.error.message);
      return;
    }
    
    const verifyData = JSON.parse(verifyResponse.result.content[0].text);
    const stillInInbox = verifyData.emails?.find((email: any) => email.id === testEmail.id);
    
    if (stillInInbox) {
      console.log('❌ メールがまだINBOXに残っています');
      console.log('🔍 Gmailの自動カテゴリ再分類が発生している可能性があります');
    } else {
      console.log('✅ メールがINBOXから消えました（アーカイブ成功！）');
    }
    
    console.log(`📊 現在のINBOXメール数: ${verifyData.emails?.length || 0}`);
    
  } catch (error) {
    console.log('❌ 例外エラー:', error instanceof Error ? error.message : 'Unknown error');
  }
}

finalArchiveTest().catch(console.error); 