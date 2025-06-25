#!/usr/bin/env node

/**
 * MCP Email Server Connection Test Script
 * Tests all configured Gmail and IMAP accounts
 */

const dotenv = require('dotenv');
const { MCPEmailServer } = require('./dist/index');

// Load environment variables
dotenv.config();

console.log('='.repeat(60));
console.log('MCP Email Server Connection Test');
console.log('='.repeat(60));

async function testConnections() {
  const server = new MCPEmailServer();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  console.log('\n📧 Testing Email Server Configuration...\n');

  try {
    // Test encryption key
    console.log('🔐 Testing encryption configuration...');
    const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey === 'your-encryption-key-here' || encryptionKey === 'your-very-secure-encryption-key-change-this') {
      console.log('❌ Encryption key not configured or using default value');
      console.log('   Please set EMAIL_ENCRYPTION_KEY in your .env file');
      failedTests++;
    } else {
      console.log('✅ Encryption key configured');
      passedTests++;
    }
    totalTests++;

    // Test account listing
    console.log('\n📋 Testing account listing...');
    const listAccountsRequest = {
      jsonrpc: '2.0',
      id: 'test-list-accounts',
      method: 'tools/call',
      params: {
        name: 'list_accounts',
        arguments: {}
      }
    };

    try {
      const response = await server.handleRequest(listAccountsRequest);
      
      if (response.error) {
        console.log('❌ Account listing failed:', response.error.message);
        failedTests++;
      } else {
        const accounts = response.result.accounts || [];
        console.log(`✅ Found ${accounts.length} configured accounts`);
        
        // Show account details
        accounts.forEach(account => {
          const statusIcon = account.status === 'connected' ? '✅' : '❌';
          console.log(`   ${statusIcon} ${account.name} (${account.type}): ${account.status}`);
          if (account.errorMessage) {
            console.log(`      Error: ${account.errorMessage}`);
          }
        });
        
        passedTests++;
      }
    } catch (error) {
      console.log('❌ Account listing test failed:', error.message);
      failedTests++;
    }
    totalTests++;

    // Test individual account connections
    console.log('\n🔌 Testing individual account connections...');
    
    // Get available accounts for testing
    const gmailAccounts = [];
    const imapAccounts = [];
    
    // Check Gmail accounts from environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('GMAIL_ACCESS_TOKEN_')) {
        const accountName = key.replace('GMAIL_ACCESS_TOKEN_', '');
        gmailAccounts.push(accountName);
      }
    });
    
    // Check IMAP accounts from environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('IMAP_HOST_')) {
        const accountName = key.replace('IMAP_HOST_', '');
        imapAccounts.push(accountName);
      }
    });
    
    // Check XServer accounts from environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('XSERVER_DOMAIN_')) {
        const accountName = key.replace('XSERVER_DOMAIN_', '');
        imapAccounts.push(accountName);
      }
    });

    console.log(`   Found ${gmailAccounts.length} Gmail accounts and ${imapAccounts.length} IMAP accounts to test`);

    // Test each account
    const allAccounts = [...gmailAccounts, ...imapAccounts];
    
    if (allAccounts.length === 0) {
      console.log('⚠️  No accounts configured for testing');
      console.log('   Configure accounts in your .env file to test connections');
    } else {
      for (const accountName of allAccounts) {
        console.log(`\n   Testing ${accountName}...`);
        const testRequest = {
          jsonrpc: '2.0',
          id: `test-${accountName}`,
          method: 'tools/call',
          params: {
            name: 'test_connection',
            arguments: {
              account_name: accountName
            }
          }
        };

        try {
          const response = await server.handleRequest(testRequest);
          
          if (response.error) {
            console.log(`   ❌ ${accountName}: ${response.error.message}`);
            failedTests++;
          } else {
            const result = response.result;
            const statusIcon = result.status === 'connected' ? '✅' : '❌';
            console.log(`   ${statusIcon} ${accountName} (${result.type || 'unknown'}): ${result.testResult}`);
            
            if (result.status === 'connected') {
              passedTests++;
            } else {
              failedTests++;
            }
          }
        } catch (error) {
          console.log(`   ❌ ${accountName}: Test failed - ${error.message}`);
          failedTests++;
        }
        totalTests++;
      }
    }

    // Test unified search if accounts are available
    if (allAccounts.length > 0) {
      console.log('\n🔍 Testing unified search functionality...');
      const searchRequest = {
        jsonrpc: '2.0',
        id: 'test-search',
        method: 'tools/call',
        params: {
          name: 'search_all_emails',
          arguments: {
            query: 'test',
            accounts: 'ALL',
            limit: 5
          }
        }
      };

      try {
        const response = await server.handleRequest(searchRequest);
        
        if (response.error) {
          console.log('❌ Unified search failed:', response.error.message);
          failedTests++;
        } else {
          const result = response.result;
          console.log(`✅ Unified search completed`);
          console.log(`   Found ${result.totalFound} total emails`);
          console.log(`   Returned ${result.emails.length} emails`);
          console.log(`   Response time: ${result.responseTime}ms`);
          
          if (result.errors && result.errors.length > 0) {
            console.log('   Warnings:');
            result.errors.forEach(error => {
              console.log(`     - ${error}`);
            });
          }
          
          passedTests++;
        }
      } catch (error) {
        console.log('❌ Unified search test failed:', error.message);
        failedTests++;
      }
      totalTests++;
    }

    // Test account statistics
    console.log('\n📊 Testing account statistics...');
    const statsRequest = {
      jsonrpc: '2.0',
      id: 'test-stats',
      method: 'tools/call',
      params: {
        name: 'get_account_stats',
        arguments: {}
      }
    };

    try {
      const response = await server.handleRequest(statsRequest);
      
      if (response.error) {
        console.log('❌ Account statistics failed:', response.error.message);
        failedTests++;
      } else {
        const stats = response.result;
        console.log('✅ Account statistics retrieved');
        console.log(`   Total accounts: ${stats.summary.totalAccounts}`);
        console.log(`   Connected accounts: ${stats.summary.connectedAccounts}`);
        console.log(`   Total unread emails: ${stats.summary.totalUnreadEmails}`);
        
        passedTests++;
      }
    } catch (error) {
      console.log('❌ Account statistics test failed:', error.message);
      failedTests++;
    }
    totalTests++;

  } catch (error) {
    console.log('❌ Fatal error during testing:', error.message);
    failedTests++;
  }

  // Test summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  console.log(`Success rate: ${successRate}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! Your MCP Email Server is ready to use.');
    console.log('\nNext steps:');
    console.log('1. Build the project: npm run build');
    console.log('2. Configure Cursor MCP settings with the path to dist/index.js');
    console.log('3. Start using the email tools in Cursor!');
  } else {
    console.log('\n⚠️  Some tests failed. Please check your configuration.');
    console.log('\nTroubleshooting:');
    console.log('1. Verify your .env file configuration');
    console.log('2. Check that all required environment variables are set');
    console.log('3. Ensure OAuth2 tokens are valid (Gmail)');
    console.log('4. Test IMAP server connectivity manually');
    console.log('5. Verify encrypted passwords are correct');
  }
  
  console.log('\n' + '='.repeat(60));
  
  return failedTests === 0;
}

// Run the tests
if (require.main === module) {
  testConnections()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testConnections };