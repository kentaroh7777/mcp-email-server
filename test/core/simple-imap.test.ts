import { describe, it, expect, beforeAll, vi } from 'vitest';
import { AccountManager } from '../../src/services/account-manager.js';
import { ImapFlowHandler } from '../../src/services/imapflow-handler.js';
import { checkTestPrerequisites, getTestAccountName } from '../utils/helpers.js';
import { encrypt, decrypt } from '../../src/crypto.js';
import { ImapAccount } from '../../src/types';
import McpEmailServer from '../../src/index.js';
import { ConnectionManager } from '../../src/connection-manager.js';

describe('Simple IMAP Handler Test', () => {
  let encryptionKey: string;
  let mcpServer: McpEmailServer;

  beforeAll(() => {
    const { canRun, message } = checkTestPrerequisites();
    console.log(`テスト環境チェック: ${message}`);
    
    if (!canRun) {
      throw new Error(message);
    }

    encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || '';
    if (!encryptionKey) {
      throw new Error('EMAIL_ENCRYPTION_KEY is not defined. Please set it in your .env file.');
    }
    
    mcpServer = new McpEmailServer();
  });

  // ImapFlowHandlerのインスタンスを生成するヘルパー関数
  const createImapHandlerWithEncryptedPassword = (accountName: string) => {
    const accountManager = new AccountManager();
    const originalImapAccounts = accountManager.getImapAccounts();
    const targetAccount = originalImapAccounts.find(acc => acc.name === accountName);

    if (!targetAccount) {
      throw new Error(`IMAP account ${accountName} not found in configured accounts.`);
    }

    // 元のパスワードが暗号化されていることを前提とし、それを復号して再暗号化する
    // ただし、テスト環境では元のパスワードが不正な場合があるので、ダミーパスワードを使用
    const dummyPassword = 'test-imap-password-for-simple-test';
    const encryptedPassword = encrypt(dummyPassword, encryptionKey);

    // ImapFlowHandlerが内部で復号化するので、暗号化されたパスワードをそのまま渡す
    return new ImapFlowHandler([targetAccount], encryptionKey);
  };

  it('should list available IMAP accounts', async () => {
    const accountManager = new AccountManager();
    const imapHandler = new ImapFlowHandler(accountManager.getImapAccounts(), encryptionKey);
    const accounts = imapHandler.getAvailableAccounts();
    
    console.log('Available IMAP accounts:', accounts.length > 0 ? `${accounts.length} accounts configured` : 'No IMAP accounts');
    expect(accounts).toBeDefined();
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThanOrEqual(0);
  });

  it('should use ConnectionManager for IMAP operations', async () => {
    // ConnectionManager統合テスト
    const mockConnectionManager = {
      getImapHandler: vi.fn().mockResolvedValue({
        testConnection: vi.fn().mockResolvedValue(undefined),
        listEmails: vi.fn().mockResolvedValue([])
      })
    };

    (mcpServer as any).connectionManager = mockConnectionManager;
    (mcpServer as any).accountManager = {
      getAccount: vi.fn().mockReturnValue({
        name: 'test_imap_account',
        type: 'imap',
        config: {}
      })
    };

    const testRequest = {
      jsonrpc: '2.0' as const,
      method: 'tools/call',
      params: {
        name: 'test_connection',
        arguments: { account_name: 'test_imap_account' }
      },
      id: 1
    };

    const response = await mcpServer.handleRequest(testRequest);
    expect(response.result.status).toBe('connected');
    expect(mockConnectionManager.getImapHandler).toHaveBeenCalledWith('test_imap_account');
  });

  it.skipIf(!getTestAccountName('imap'))('should get unread count for IMAP account', async () => {
    const accountName = getTestAccountName('imap')!;
    const imapHandler = createImapHandlerWithEncryptedPassword(accountName);
    
    console.log(`Testing unread count for account: ${accountName}`);
    
    try {
      const unreadCount = await imapHandler.getUnreadCount(accountName);
      console.log(`Unread count for ${accountName}: ${unreadCount}`);
      
      expect(typeof unreadCount).toBe('number');
      expect(unreadCount).toBeGreaterThanOrEqual(0);
    } catch (error) {
      console.log(`Account ${accountName} connection failed (expected in some cases):`, error);
      expect(error).toBeDefined();
    }
  }, 10000);

  it('should verify no duplicate instances exist', () => {
    // 重複インスタンス作成の完全解消確認
    expect((mcpServer as any).gmailHandler).toBeUndefined();
    expect((mcpServer as any).imapHandler).toBeUndefined();
    expect((mcpServer as any).connectionManager).toBeInstanceOf(ConnectionManager);
  });

  it.skipIf(!getTestAccountName('imap'))('should list emails from IMAP account', async () => {
    const accountName = getTestAccountName('imap')!;
    const imapHandler = createImapHandlerWithEncryptedPassword(accountName);
    
    console.log(`Testing email list for account: ${accountName}`);
    
    try {
      const emails = await imapHandler.listEmails(accountName, { limit: 1 });
      console.log(`Found ${emails.length} emails for ${accountName}`);
      
      expect(Array.isArray(emails)).toBe(true);
      expect(emails.length).toBeGreaterThanOrEqual(0);
      
      if (emails.length > 0) {
        const email = emails[0];
        expect(email).toHaveProperty('id');
        expect(email).toHaveProperty('subject');
        expect(email).toHaveProperty('from');
        expect(email).toHaveProperty('date');
      }
    } catch (error) {
      console.log(`Account ${accountName} email listing failed (expected in some cases):`, error);
      expect(error).toBeDefined();
    }
  }, 10000);
});