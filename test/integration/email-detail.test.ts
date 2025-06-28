import { describe, test, expect, beforeAll } from 'vitest';
import { TestHelper } from '../utils/helpers.js';

describe('Email Detail Tests', () => {
  let helper: TestHelper;
  let configuredAccounts: { gmail: string[]; imap: string[]; xserver: string[] };

  beforeAll(() => {
    helper = new TestHelper();
    configuredAccounts = helper.getConfiguredAccounts();
    
    const totalAccounts = configuredAccounts.gmail.length + configuredAccounts.imap.length + configuredAccounts.xserver.length;
    console.log(`テスト環境チェック: Gmail ${configuredAccounts.gmail.length}アカウント, IMAP ${configuredAccounts.imap.length}アカウント, XServer ${configuredAccounts.xserver.length}アカウント`);
    
    if (totalAccounts === 0) {
      throw new Error('No email accounts configured for testing');
    }
  });

  describe('Gmail Email Detail Retrieval', () => {
    test('Gmailアカウントから実際のメール詳細を取得できる', async () => {
      if (configuredAccounts.gmail.length === 0) {
        console.log('Gmail accounts not configured, skipping test');
        return;
      }

      const accountName = configuredAccounts.gmail[0];
      console.log(`Testing Gmail email detail for account: ${accountName}`);

      // まず最新のメール一覧を取得
      const listResponse = await helper.callTool('list_emails', {
        account_name: accountName,
        limit: 3
      });

      expect(listResponse.error).toBeUndefined();
      const listData = JSON.parse(listResponse.result.content[0].text);
      expect(listData.emails).toBeDefined();
      expect(Array.isArray(listData.emails)).toBe(true);

      if (listData.emails.length === 0) {
        console.log('No emails found in Gmail account, skipping detail test');
        return;
      }

      // 最初のメールの詳細を取得
      const emailId = listData.emails[0].id;
      console.log(`Getting detail for email ID: ${emailId}`);

      const detailResponse = await helper.callTool('get_email_detail', {
        account_name: accountName,
        email_id: emailId
      });

      expect(detailResponse.error).toBeUndefined();
      const detailData = JSON.parse(detailResponse.result.content[0].text);
      
      // 詳細データの検証
      expect(detailData.email).toBeDefined();
      expect(detailData.email.id).toBe(emailId);
      expect(detailData.email.subject).toBeDefined();
      expect(detailData.email.from).toBeDefined();
      expect(detailData.email.body).toBeDefined();
      expect(typeof detailData.email.body).toBe('string');
      expect(detailData.email.body.length).toBeGreaterThan(0);
      
      console.log(`Successfully retrieved email detail:`);
      console.log(`  Subject: ${detailData.email.subject}`);
      console.log(`  From: ${detailData.email.from}`);
      console.log(`  Body length: ${detailData.email.body.length} characters`);
      console.log(`  Body preview: ${detailData.email.body.substring(0, 100)}...`);
      
      // 添付ファイル情報の検証
      expect(detailData.email.attachments).toBeDefined();
      expect(Array.isArray(detailData.email.attachments)).toBe(true);
      
      if (detailData.email.attachments.length > 0) {
        console.log(`  Attachments: ${detailData.email.attachments.length} files`);
        detailData.email.attachments.forEach((attachment: any, index: number) => {
          console.log(`    ${index + 1}. ${attachment.filename} (${attachment.contentType}, ${attachment.size} bytes)`);
        });
      }
    }, 30000);
  });

  describe('IMAP Email Detail Retrieval', () => {
    test('IMAPアカウントから実際のメール詳細を取得できる', async () => {
      const imapAccounts = [...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (imapAccounts.length === 0) {
        console.log('IMAP accounts not configured, skipping test');
        return;
      }

      const accountName = imapAccounts[0];
      console.log(`Testing IMAP email detail for account: ${accountName}`);

      // まず最新のメール一覧を取得
      const listResponse = await helper.callTool('list_emails', {
        account_name: accountName,
        limit: 3
      });

      expect(listResponse.error).toBeUndefined();
      const listData = JSON.parse(listResponse.result.content[0].text);
      expect(listData.emails).toBeDefined();
      expect(Array.isArray(listData.emails)).toBe(true);

      if (listData.emails.length === 0) {
        console.log('No emails found in IMAP account, skipping detail test');
        return;
      }

      // 最初のメールの詳細を取得
      const emailId = listData.emails[0].id;
      console.log(`Getting detail for email ID: ${emailId}`);

      const detailResponse = await helper.callTool('get_email_detail', {
        account_name: accountName,
        email_id: emailId
      });

      expect(detailResponse.error).toBeUndefined();
      const detailData = JSON.parse(detailResponse.result.content[0].text);
      
      // 詳細データの検証
      expect(detailData.email).toBeDefined();
      expect(detailData.email.id).toBe(emailId);
      expect(detailData.email.subject).toBeDefined();
      expect(detailData.email.from).toBeDefined();
      expect(detailData.email.body).toBeDefined();
      expect(typeof detailData.email.body).toBe('string');
      expect(detailData.email.body.length).toBeGreaterThan(0);
      
      console.log(`Successfully retrieved IMAP email detail:`);
      console.log(`  Subject: ${detailData.email.subject}`);
      console.log(`  From: ${detailData.email.from}`);
      console.log(`  Body length: ${detailData.email.body.length} characters`);
      console.log(`  Body preview: ${detailData.email.body.substring(0, 100)}...`);
      
      // 添付ファイル情報の検証
      expect(detailData.email.attachments).toBeDefined();
      expect(Array.isArray(detailData.email.attachments)).toBe(true);
      
      if (detailData.email.attachments.length > 0) {
        console.log(`  Attachments: ${detailData.email.attachments.length} files`);
        detailData.email.attachments.forEach((attachment: any, index: number) => {
          console.log(`    ${index + 1}. ${attachment.filename} (${attachment.contentType}, ${attachment.size} bytes)`);
        });
      }
    }, 30000);
  });

  describe('Unified Email Detail Cross-Account Test', () => {
    test('複数アカウントでメール詳細取得が統一的に動作する', async () => {
      const allAccounts = [...configuredAccounts.gmail, ...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (allAccounts.length === 0) {
        return;
      }

      let successfulTests = 0;
      let totalTests = 0;

      for (const accountName of allAccounts.slice(0, 3)) { // 最大3アカウントでテスト
        totalTests++;
        
        try {
          console.log(`\nTesting unified email detail for account: ${accountName}`);
          
          // メール一覧を取得
          const listResponse = await helper.callTool('list_emails', {
            account_name: accountName,
            limit: 1
          });

          if (listResponse.error) {
            console.log(`  Failed to list emails: ${listResponse.error.message}`);
            continue;
          }

          const listData = JSON.parse(listResponse.result.content[0].text);
          
          if (!listData.emails || listData.emails.length === 0) {
            console.log(`  No emails found in account`);
            continue;
          }

          const emailId = listData.emails[0].id;
          
          // メール詳細を取得
          const detailResponse = await helper.callTool('get_email_detail', {
            account_name: accountName,
            email_id: emailId
          });

          if (detailResponse.error) {
            console.log(`  Failed to get email detail: ${detailResponse.error.message}`);
            continue;
          }

          const detailData = JSON.parse(detailResponse.result.content[0].text);
          
          // 基本的な検証
          expect(detailData.email).toBeDefined();
          expect(detailData.email.id).toBe(emailId);
          expect(detailData.email.body).toBeDefined();
          expect(typeof detailData.email.body).toBe('string');
          
          console.log(`  ✅ Success - Subject: ${detailData.email.subject}`);
          console.log(`  ✅ Body length: ${detailData.email.body.length} characters`);
          
          successfulTests++;
          
        } catch (error) {
          console.log(`  ❌ Error for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log(`\nUnified email detail test summary: ${successfulTests}/${totalTests} accounts successful`);
      
      // 少なくとも1つのアカウントで成功していることを確認
      expect(successfulTests).toBeGreaterThan(0);
      expect(totalTests).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Email Detail Error Handling', () => {
    test('存在しないメールIDで適切なエラーを返す', async () => {
      if (configuredAccounts.gmail.length === 0) {
        return;
      }

      const accountName = configuredAccounts.gmail[0];
      const invalidEmailId = 'invalid_email_id_12345';

      const response = await helper.callTool('get_email_detail', {
        account_name: accountName,
        email_id: invalidEmailId
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Tool execution failed');
      
      console.log(`Correctly handled invalid email ID: ${response.error?.message}`);
    });

    test('存在しないアカウントで適切なエラーを返す', async () => {
      const invalidAccountName = 'non_existent_account_12345';
      const dummyEmailId = 'dummy_email_id';

      const response = await helper.callTool('get_email_detail', {
        account_name: invalidAccountName,
        email_id: dummyEmailId
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('not found');
      
      console.log(`Correctly handled invalid account: ${response.error?.message}`);
    });
  });
});
