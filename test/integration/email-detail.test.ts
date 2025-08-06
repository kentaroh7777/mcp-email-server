import { describe, test, expect, beforeAll, vi } from 'vitest';
import { TestHelper } from '../utils/helpers.js';
import { encrypt, decrypt } from '../../src/utils/crypto.js';
import { ImapFlowHandler } from '../../src/services/imapflow-handler.js';
import { ImapAccount } from '../../src/types';
import { AccountManager } from '../../src/services/account-manager';
import McpEmailServer from '../../src/index.js';
import { ConnectionManager } from '../../src/connection-manager.js';

describe('Email Detail Tests', () => {
  let helper: TestHelper;
  let configuredAccounts: { gmail: string[]; imap: string[]; xserver: string[] };
  let mcpServer: McpEmailServer;

  beforeAll(() => {
    helper = new TestHelper();
    configuredAccounts = helper.getConfiguredAccounts();
    mcpServer = new McpEmailServer();
    
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
      const listData = listResponse.result;
      expect(listData).toBeDefined();
      expect(Array.isArray(listData)).toBe(true);

      if (listData.length === 0) {
        console.log('No emails found in Gmail account, skipping detail test');
        return;
      }

      // 最初のメールの詳細を取得
      const emailId = listData[0].id;
      console.log(`Getting detail for email ID: ${emailId}`);

      const detailResponse = await helper.callTool('get_email_detail', {
        account_name: accountName,
        email_id: emailId
      });

      expect(detailResponse.error).toBeUndefined();
      const detailData = detailResponse.result;
      
      // 詳細データの検証
      expect(detailData).toBeDefined();
      expect(detailData.id).toBe(emailId);
      expect(detailData.subject).toBeDefined();
      expect(detailData.from).toBeDefined();
      expect(detailData.body).toBeDefined();
      expect(typeof detailData.body).toBe('string');
      expect(detailData.body.length).toBeGreaterThan(0);
      
      console.log(`Successfully retrieved email detail:`);
      console.log(`  Subject: ${detailData.subject}`);
      console.log(`  From: ${detailData.from}`);
      console.log(`  Body length: ${detailData.body.length} characters`);
      console.log(`  Body preview: ${detailData.body.substring(0, 100)}...`);
      
      // 添付ファイル情報の検証
      expect(detailData.attachments).toBeDefined();
      expect(Array.isArray(detailData.attachments)).toBe(true);
      
      if (detailData.attachments.length > 0) {
        console.log(`  Attachments: ${detailData.attachments.length} files`);
        detailData.attachments.forEach((attachment: any, index: number) => {
          console.log(`    ${index + 1}. ${attachment.filename} (${attachment.contentType}, ${attachment.size} bytes)`);
        });
      }
    }, 30000);
  });

  describe('IMAP Email Detail Retrieval', () => {
    test('IMAPアカウントから実際のメール詳細を取得できる', async () => {
      const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;
      if (!encryptionKey) {
        console.log('テストスキップ: EMAIL_ENCRYPTION_KEY が .env に設定されていません。');
        return;
      }

      const imapAccounts = [...configuredAccounts.imap, ...configuredAccounts.xserver];
      if (imapAccounts.length === 0) {
        console.log(`テストスキップ: IMAP Email Detail Retrieval テストには、.env ファイルにIMAPアカウントの設定が必要です。
          例:
          IMAP_HOST_your_account=your_imap_host
          IMAP_USER_your_account=your_imap_username
          IMAP_PASSWORD_your_account=your_encrypted_imap_password
          または
          XSERVER_DOMAIN_your_account=your_domain
          XSERVER_USERNAME_your_account=your_username
          XSERVER_PASSWORD_your_account=your_encrypted_xserver_password
        `);
        return;
      }

      const accountManager = new AccountManager();
      const targetAccountName = imapAccounts[0]; // 最初のIMAPアカウントを使用
      const originalImapAccount = accountManager.getAccount(targetAccountName) as ImapAccount;

      if (!originalImapAccount) {
        console.log(`テストスキップ: IMAPアカウント ${targetAccountName} の詳細が AccountManager から取得できませんでした。`);
        return;
      }

      // IMAPHandlerを直接インスタンス化（内部で復号化される）
      const imapHandler = new ImapFlowHandler([originalImapAccount], encryptionKey);
      const accountName = originalImapAccount.name;

      console.log(`Testing IMAP email detail for account: ${accountName}`);

      try {
        // まず最新のメール一覧を取得
        const listData = await imapHandler.listEmails(accountName, { limit: 3 });

        expect(listData).toBeDefined();
        expect(Array.isArray(listData)).toBe(true);

        if (listData.length === 0) {
          console.log('No emails found in IMAP account, skipping detail test');
          return;
        }

        // デバッグ情報を表示
        console.log(`Found ${listData.length} emails in IMAP account:`);
        listData.forEach((email, index) => {
          console.log(`  ${index + 1}. ID: ${email.id}, Subject: ${email.subject}, Date: ${email.date}`);
        });

        // 最新のメールの詳細を取得（配列の最初の要素 - 最新のメール）
        const emailId = listData[0].id;
        console.log(`Getting detail for email ID: ${emailId}`);

        const detailData = await imapHandler.getEmailDetail(accountName, emailId);
        
        // 詳細データの検証
        expect(detailData).toBeDefined();
        expect(detailData.id).toBe(emailId);
        expect(detailData.subject).toBeDefined();
        expect(detailData.from).toBeDefined();
        expect(detailData.body).toBeDefined();
        expect(typeof detailData.body).toBe('string');
        expect(detailData.body.length).toBeGreaterThan(0);
        
        console.log(`Successfully retrieved IMAP email detail:`);
        console.log(`  Subject: ${detailData.subject}`);
        console.log(`  From: ${detailData.from}`);
        console.log(`  Body length: ${detailData.body.length} characters`);
        console.log(`  Body preview: ${detailData.body.substring(0, 100)}...`);
        
        // 添付ファイル情報の検証
        expect(detailData.attachments).toBeDefined();
        expect(Array.isArray(detailData.attachments)).toBe(true);
        
        if (detailData.attachments.length > 0) {
          console.log(`  Attachments: ${detailData.attachments.length} files`);
          detailData.attachments.forEach((attachment: any, index: number) => {
            console.log(`    ${index + 1}. ${attachment.filename} (${attachment.contentType}, ${attachment.size} bytes)`);
          });
        }
      } catch (error: any) {
        console.error(`IMAP Email Detail Retrieval failed for ${accountName}: ${error.message}`);
        throw error; // テストを失敗させる
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

          const listData = listResponse.result;
          
          if (!listData || listData.length === 0) {
            console.log(`  No emails found in account`);
            continue;
          }

          const emailId = listData[listData.length - 1].id; // 最新のメールを取得
          
          // メール詳細を取得
          const detailResponse = await helper.callTool('get_email_detail', {
            account_name: accountName,
            email_id: emailId
          });

          if (detailResponse.error) {
            console.log(`  Failed to get email detail: ${detailResponse.error.message}`);
            continue;
          }

          const detailData = detailResponse.result;
          
          // 基本的な検証
          expect(detailData).toBeDefined();
          expect(detailData.id).toBe(emailId);
          expect(detailData.body).toBeDefined();
          expect(typeof detailData.body).toBe('string');
          
          console.log(`  ✅ Success - Subject: ${detailData.subject}`);
          console.log(`  ✅ Body length: ${detailData.body.length} characters`);
          
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

  describe('ConnectionManager Integration Tests', () => {
    test('should use ConnectionManager for email detail operations', async () => {
      // ConnectionManager統合テスト
      expect((mcpServer as any).connectionManager).toBeInstanceOf(ConnectionManager);
      expect((mcpServer as any).gmailHandler).toBeUndefined();
      expect((mcpServer as any).imapHandler).toBeUndefined();
    });

    test('should maintain consistency between tools using ConnectionManager', async () => {
      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue({
          listEmails: vi.fn().mockResolvedValue([{
            id: 'test-email-id',
            subject: 'Test Subject',
            from: 'test@example.com',
            date: new Date().toISOString()
          }]),
          getEmailDetail: vi.fn().mockResolvedValue({
            id: 'test-email-id',
            subject: 'Test Subject',
            from: 'test@example.com',
            body: 'Test body content',
            attachments: []
          })
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test-gmail-account',
          type: 'gmail',
          config: {}
        })
      };

      // list_emails実行
      const listResponse = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'test-gmail-account', limit: 1 }
        },
        id: 1
      });

      expect(listResponse.result).toBeDefined();
      expect(Array.isArray(listResponse.result)).toBe(true);

      // get_email_detail実行（同じConnectionManagerインスタンス使用）
      const detailResponse = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_email_detail',
          arguments: { account_name: 'test-gmail-account', email_id: 'test-email-id' }
        },
        id: 2
      });

      expect(detailResponse.result).toBeDefined();
      expect(detailResponse.result.id).toBe('test-email-id');
      
      // 同じConnectionManagerインスタンスが使用されることを確認
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledTimes(2);
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledWith('test-gmail-account');
    });
  });

  describe('Email Detail Error Handling', () => {
    test('暗号化・復号のサイクルが正しく動作する', () => {
      const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;
      expect(encryptionKey, 'EMAIL_ENCRYPTION_KEY must be defined in .env').toBeDefined();

      const originalPassword = 'my-secret-password-for-testing';
      
      // 1. Encrypt the password
      const encryptedPassword = encrypt(originalPassword, encryptionKey!);
      
      // 2. Decrypt the password
      const decryptedPassword = decrypt(encryptedPassword, encryptionKey!);
      
      // 3. Verify that the decrypted password matches the original
      expect(decryptedPassword).toBe(originalPassword);
      console.log('✅ Encryption/Decryption cycle test passed.');
    });
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
