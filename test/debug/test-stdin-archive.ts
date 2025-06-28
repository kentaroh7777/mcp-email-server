import { spawn } from 'child_process';

async function testStdinArchive() {
  console.log('🧪 === Stdin/Stdout MCP Archive Tool テスト ===');
  
  // MCPサーバーを起動
  const serverProcess = spawn('npx', ['tsx', 'test/run-email-server-fast.ts'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let messageId = 1;
  let responses: any[] = [];
  
  // レスポンス処理
  serverProcess.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter((line: string) => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        console.log(`📨 Response ID: ${response.id}`, response.result || response.error);
      } catch (error) {
        console.log('❌ JSON解析エラー:', line);
      }
    }
  });
  
  serverProcess.stderr?.on('data', (data) => {
    console.log('⚠️ stderr:', data.toString());
  });
  
  // 1秒待ってからテスト開始
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // 1. INBOXのメール一覧を取得
    console.log('1. INBOXメール一覧取得...');
    const listRequest = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: {
          account_name: 'MAIN',
          limit: 3
        }
      }
    };
    
    serverProcess.stdin?.write(JSON.stringify(listRequest) + '\n');
    
    // レスポンス待ち
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (responses.length > 0 && responses[0].result?.emails?.length > 0) {
      const testEmail = responses[0].result.emails[0];
      console.log(`📧 テスト対象: ${testEmail.subject}`);
      console.log(`📧 ID: ${testEmail.id}`);
      console.log(`📧 未読: ${testEmail.isUnread}`);
      
      // 2. アーカイブ実行（UNREADラベル削除あり）
      console.log('\n2. アーカイブ実行（UNREAD削除あり）...');
      const archiveRequest = {
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
      
      serverProcess.stdin?.write(JSON.stringify(archiveRequest) + '\n');
      
      // レスポンス待ち
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (responses.length > 1) {
        const archiveResult = responses[1];
        if (archiveResult.result?.success) {
          console.log('✅ アーカイブ成功！');
          console.log(`📊 結果: ${archiveResult.result.message}`);
          console.log(`🔧 UNREAD削除: ${archiveResult.result.remove_unread}`);
          
          // 3. 確認のため再度リスト取得
          console.log('\n3. アーカイブ後のINBOX確認...');
          const verifyRequest = {
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'list_emails',
              arguments: {
                account_name: 'MAIN',
                limit: 3
              }
            }
          };
          
          serverProcess.stdin?.write(JSON.stringify(verifyRequest) + '\n');
          
          // 最終レスポンス待ち
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (responses.length > 2) {
            const verifyResult = responses[2];
            console.log(`📊 アーカイブ後のINBOXメール数: ${verifyResult.result?.emails?.length || 0}`);
            
            // アーカイブされたメールがINBOXから消えているかチェック
            const stillInInbox = verifyResult.result?.emails?.find((email: any) => email.id === testEmail.id);
            if (stillInInbox) {
              console.log('❌ メールがまだINBOXに残っています');
            } else {
              console.log('✅ メールがINBOXから消えました！');
            }
          }
        } else {
          console.log('❌ アーカイブ失敗');
          console.log('エラー:', archiveResult.error || 'Unknown error');
        }
      }
    } else {
      console.log('❌ INBOXにメールがありません');
    }
    
  } catch (error) {
    console.log('❌ テストエラー:', error);
  } finally {
    console.log('\n🎉 テスト完了！');
    serverProcess.kill();
  }
}

testStdinArchive().catch(console.error); 