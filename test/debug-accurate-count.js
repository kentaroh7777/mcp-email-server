#!/usr/bin/env node

import dotenv from 'dotenv';
import { MCPEmailServer } from '../dist/index.js';

dotenv.config();

async function debugAccurateCount() {
  console.log('=== Accurate Unread Count Test ===\n');

  const server = new MCPEmailServer();

  // Get Gmail accounts
  const gmailAccounts = [];
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('GMAIL_ACCESS_TOKEN_')) {
      const accountName = key.replace('GMAIL_ACCESS_TOKEN_', '');
      gmailAccounts.push(accountName);
    }
  });

  console.log(`Testing ${gmailAccounts.length} Gmail accounts:\n`);

  let totalUnread = 0;

  for (const accountName of gmailAccounts) {
    console.log(`--- ${accountName} ---`);
    
    try {
      const testRequest = {
        jsonrpc: '2.0',
        id: `test-${accountName}`,
        method: 'tools/call',
        params: {
          name: 'get_unread_count_gmail',
          arguments: {
            account_name: accountName
          }
        }
      };

      const response = await server.handleRequest(testRequest);
      
      if (response.error) {
        console.log(`❌ Error: ${response.error.message}`);
      } else {
        const unreadCount = response.result.unreadCount;
        console.log(`✅ Unread emails: ${unreadCount.toLocaleString()}`);
        totalUnread += unreadCount;
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Total unread emails: ${totalUnread.toLocaleString()}`);
  console.log(`Average per account: ${Math.round(totalUnread / gmailAccounts.length).toLocaleString()}`);
}

debugAccurateCount().catch(console.error);
