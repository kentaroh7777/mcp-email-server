import { TestHelper } from '../utils/helpers.js';

async function debugSendEmail() {
  const helper = new TestHelper();
  
  console.log('=== Debug send_email functionality ===');
  
  // アカウント一覧確認
  console.log('\n1. Checking available accounts...');
  const accountsResponse = await helper.callTool('list_accounts', {});
  console.log('Accounts:', JSON.stringify(accountsResponse, null, 2));
  
  // IMAP → Gmail 送信テスト
  console.log('\n2. Testing IMAP → Gmail send...');
  const response = await helper.callTool('send_email', {
    account_name: 'info_h_fpo_com',
    to: 'kabuco.h@gmail.com',
    subject: 'Debug Test Email',
    text: 'This is a debug test email'
  });
  
  console.log('Full response:', JSON.stringify(response, null, 2));
  
  if (response.result?.content?.[0]?.text) {
    const result = JSON.parse(response.result.content[0].text);
    console.log('Parsed result:', JSON.stringify(result, null, 2));
    
    if (!result.success && result.error) {
      console.log('❌ Send failed with error:', result.error);
    } else if (result.success) {
      console.log('✅ Send successful:', result.messageId);
    }
  }
  
  // アカウント接続テスト
  console.log('\n3. Testing account connections...');
  const accounts = ['kentaroh7', 'kabucoh', 'info_h_fpo_com', 'kh_h_fpo_com'];
  
  for (const account of accounts) {
    console.log(`\nTesting connection for ${account}:`);
    const connResponse = await helper.callTool('test_connection', {
      account_name: account
    });
    
    if (connResponse.result?.content?.[0]?.text) {
      const connResult = JSON.parse(connResponse.result.content[0].text);
      console.log(`  ${account}: ${connResult.status} (${connResult.accountType})`);
      if (connResult.error) {
        console.log(`  Error: ${connResult.error}`);
      }
    }
  }
}

debugSendEmail().catch(console.error); 