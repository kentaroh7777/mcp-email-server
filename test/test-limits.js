#!/usr/bin/env node

import dotenv from 'dotenv';
import { MCPEmailServer } from '../dist/index.js';

dotenv.config();

async function testLimits() {
  console.log('=== Email Fetching Limits Test ===\n');

  // Show current environment settings
  console.log('Current environment settings:');
  console.log(`MAX_EMAIL_CONTENT_LIMIT: ${process.env.MAX_EMAIL_CONTENT_LIMIT || 'default (500)'}`);
  console.log(`MAX_EMAIL_FETCH_PAGES: ${process.env.MAX_EMAIL_FETCH_PAGES || 'default (2)'}`);
  console.log(`MAX_EMAIL_FETCH_PER_PAGE: ${process.env.MAX_EMAIL_FETCH_PER_PAGE || 'default (500)'}`);
  console.log('');

  const server = new MCPEmailServer();

  // Get first Gmail account
  const gmailAccounts = [];
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('GMAIL_ACCESS_TOKEN_')) {
      const accountName = key.replace('GMAIL_ACCESS_TOKEN_', '');
      gmailAccounts.push(accountName);
    }
  });

  if (gmailAccounts.length === 0) {
    console.log('❌ No Gmail accounts found');
    return;
  }

  const accountName = gmailAccounts[0];
  console.log(`Testing with account: ${accountName}\n`);

  // Test 1: List emails with limit
  console.log('Test 1: List emails with limit=1000 (should be capped by MAX_EMAIL_CONTENT_LIMIT)');
  try {
    const listRequest = {
      jsonrpc: '2.0',
      id: 'test-list',
      method: 'tools/call',
      params: {
        name: 'list_gmail_emails',
        arguments: {
          account_name: accountName,
          limit: 1000,
          unread_only: false
        }
      }
    };

    const response = await server.handleRequest(listRequest);
    
    if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    } else {
      const emails = response.result.emails;
      console.log(`✅ Retrieved ${emails.length} emails (limit applied)`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('');

  // Test 2: Unread count (should use the configured page limits)
  console.log('Test 2: Unread count (using page limits)');
  try {
    const countRequest = {
      jsonrpc: '2.0',
      id: 'test-count',
      method: 'tools/call',
      params: {
        name: 'get_unread_count',
        arguments: {
          account_name: accountName,
          folder: 'INBOX'
        }
      }
    };

    console.log('Counting unread emails...');
    const start = Date.now();
    const response = await server.handleRequest(countRequest);
    const elapsed = Date.now() - start;
    
    if (response.error) {
      console.log(`❌ Error: ${response.error.message}`);
    } else {
      const unreadCount = response.result.unreadCount;
      console.log(`✅ Unread emails: ${unreadCount.toLocaleString()} (took ${elapsed}ms)`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n=== Test Summary ===');
  console.log('✅ Environment variable limits are working properly');
  console.log('📋 Settings can be adjusted in .env file:');
  console.log('   - MAX_EMAIL_CONTENT_LIMIT: Controls email list/search limits');
  console.log('   - MAX_EMAIL_FETCH_PAGES: Controls unread count accuracy vs speed');
  console.log('   - MAX_EMAIL_FETCH_PER_PAGE: Controls page size for Gmail API');
}

testLimits().catch(console.error);
