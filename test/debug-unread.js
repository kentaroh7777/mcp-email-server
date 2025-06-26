#!/usr/bin/env node

import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

async function debugUnreadCounts() {
  console.log('=== Gmail API Unread Count Debug ===\n');

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('❌ Gmail credentials not found');
    return;
  }

  // Get Gmail accounts
  const gmailAccounts = [];
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('GMAIL_ACCESS_TOKEN_')) {
      const accountName = key.replace('GMAIL_ACCESS_TOKEN_', '');
      gmailAccounts.push(accountName);
    }
  });

  console.log(`Found ${gmailAccounts.length} Gmail accounts: ${gmailAccounts.join(', ')}\n`);

  for (const accountName of gmailAccounts) {
    console.log(`--- ${accountName} ---`);
    
    try {
      const refreshToken = process.env[`GMAIL_REFRESH_TOKEN_${accountName}`];
      if (!refreshToken) {
        console.log('❌ No refresh token found');
        continue;
      }

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost'
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Test 1: Basic unread query (current implementation)
      console.log('Test 1: Basic unread query');
      const response1 = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread'
      });
      console.log(`  resultSizeEstimate: ${response1.data.resultSizeEstimate}`);
      console.log(`  actual messages returned: ${response1.data.messages?.length || 0}`);

      // Test 2: With maxResults
      console.log('Test 2: With maxResults=500');
      const response2 = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults: 500
      });
      console.log(`  resultSizeEstimate: ${response2.data.resultSizeEstimate}`);
      console.log(`  actual messages returned: ${response2.data.messages?.length || 0}`);

      // Test 3: Profile info
      console.log('Test 3: Profile info');
      const profile = await gmail.users.getProfile({
        userId: 'me'
      });
      console.log(`  email: ${profile.data.emailAddress}`);
      console.log(`  total messages: ${profile.data.messagesTotal}`);

      // Test 4: Labels info
      console.log('Test 4: INBOX label info');
      const labels = await gmail.users.labels.list({
        userId: 'me'
      });
      const inboxLabel = labels.data.labels?.find(label => label.name === 'INBOX');
      if (inboxLabel) {
        console.log(`  INBOX messagesTotal: ${inboxLabel.messagesTotal}`);
        console.log(`  INBOX messagesUnread: ${inboxLabel.messagesUnread}`);
      }

      // Test 5: UNREAD label info
      const unreadLabel = labels.data.labels?.find(label => label.name === 'UNREAD');
      if (unreadLabel) {
        console.log(`  UNREAD messagesTotal: ${unreadLabel.messagesTotal}`);
        console.log(`  UNREAD messagesUnread: ${unreadLabel.messagesUnread}`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
}

debugUnreadCounts().catch(console.error); 