import WebSocket from 'ws';

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: any;
}

async function testMCPArchive() {
  console.log('🧪 === MCP Archive Tool テスト ===');
  
  const ws = new WebSocket('ws://localhost:3001');
  
  return new Promise<void>((resolve, reject) => {
    let messageId = 1;
    
    ws.on('open', () => {
      console.log('✅ MCPサーバーに接続しました');
      
      // 1. まずINBOXのメール一覧を取得
      const listRequest: MCPRequest = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: {
            account_name: 'MAIN',
            limit: 5
          }
        }
      };
      
      ws.send(JSON.stringify(listRequest));
    });
    
    ws.on('message', (data) => {
      try {
        const response: MCPResponse = JSON.parse(data.toString());
        console.log(`📨 Response ID: ${response.id}`);
        
        if (response.id === 1) {
          // INBOXメール一覧の結果
          if (response.result?.emails && response.result.emails.length > 0) {
            const testEmail = response.result.emails[0];
            console.log(`📧 テスト対象: ${testEmail.subject}`);
            console.log(`📧 ID: ${testEmail.id}`);
            console.log(`📧 未読: ${testEmail.isUnread}`);
            
            // 2. アーカイブ実行（UNREADラベル削除オプション付き）
            console.log('\n🗂️ アーカイブ実行（UNREAD削除あり）...');
            const archiveRequest: MCPRequest = {
              jsonrpc: '2.0',
              id: messageId++,
              method: 'tools/call',
              params: {
                name: 'archive_email',
                arguments: {
                  account_name: 'MAIN',
                  email_id: testEmail.id,
                  remove_unread: true
                }
              }
            };
            
            ws.send(JSON.stringify(archiveRequest));
          } else {
            console.log('❌ INBOXにメールがありません');
            ws.close();
            resolve();
          }
        } else if (response.id === 2) {
          // アーカイブ結果
          if (response.result?.success) {
            console.log('✅ アーカイブ成功！');
            console.log(`📊 結果: ${response.result.message}`);
            console.log(`🔧 UNREAD削除: ${response.result.remove_unread}`);
            
            // 3. 結果確認のため再度メール一覧を取得
            console.log('\n📋 アーカイブ後のINBOX確認...');
            const verifyRequest: MCPRequest = {
              jsonrpc: '2.0',
              id: messageId++,
              method: 'tools/call',
              params: {
                name: 'list_emails',
                arguments: {
                  account_name: 'MAIN',
                  limit: 5
                }
              }
            };
            
            ws.send(JSON.stringify(verifyRequest));
          } else {
            console.log('❌ アーカイブ失敗');
            if (response.error) {
              console.log(`エラー: ${response.error.message}`);
            }
            ws.close();
            resolve();
          }
        } else if (response.id === 3) {
          // アーカイブ後の確認結果
          console.log(`📊 アーカイブ後のINBOXメール数: ${response.result?.emails?.length || 0}`);
          console.log('\n🎉 MCPアーカイブツールのテスト完了！');
          
          ws.close();
          resolve();
        }
        
      } catch (error) {
        console.log('❌ JSON解析エラー:', error);
        ws.close();
        reject(error);
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocketエラー:', error);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('🔌 MCPサーバーとの接続を終了しました');
      resolve();
    });
  });
}

testMCPArchive().catch(console.error); 