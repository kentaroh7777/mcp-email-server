import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConnectionManager } from '../../connection-manager.js'
import { AccountManager } from '../../services/account-manager.js'
import { GmailHandler } from '../../services/gmail.js'
import { ImapFlowHandler } from '../../services/imapflow-handler.js'

// モック設定
vi.mock('../../services/gmail.js')
vi.mock('../../services/imapflow-handler.js')

// ConnectionLoggerのモック設定
vi.mock('../../connection-logger.js', () => {
  return {
    ConnectionLogger: {
      getInstance: vi.fn(() => ({
        logPoolStatus: vi.fn(),
        logConnectionEvent: vi.fn(),
        logConnectionError: vi.fn()
      }))
    }
  };
})

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let accountManager: AccountManager;

  beforeEach(() => {
    accountManager = new AccountManager();
    connectionManager = new ConnectionManager(accountManager);
  });

  afterEach(async () => {
    await connectionManager.cleanup();
  });

  describe('getGmailHandler', () => {
    it('should create new Gmail handler for first access', async () => {
      // Gmailアカウント設定のモック
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token'
      });

      const handler = await connectionManager.getGmailHandler('test_gmail');
      expect(handler).toBeInstanceOf(GmailHandler);
    });

    it('should reuse existing Gmail handler', async () => {
      // アカウント設定とハンドラー再利用のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token'
      });

      const handler1 = await connectionManager.getGmailHandler('test_gmail');
      const handler2 = await connectionManager.getGmailHandler('test_gmail');
      expect(handler1).toBe(handler2);
    });

    it('should throw error for non-existent Gmail account', async () => {
      // 存在しないアカウントのテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue(undefined);

      await expect(connectionManager.getGmailHandler('nonexistent')).rejects.toThrow('Gmail account not found: nonexistent');
    });

    it('should throw error for IMAP account requested as Gmail', async () => {
      // IMAP アカウントを Gmail として要求する場合のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_imap',
        type: 'imap',
        host: 'imap.example.com',
        port: 993,
        tls: true,
        user: 'test@example.com',
        password: 'password'
      });

      await expect(connectionManager.getGmailHandler('test_imap')).rejects.toThrow('Gmail account not found: test_imap');
    });
  });

  describe('getImapHandler', () => {
    it('should create new IMAP handler for first access', async () => {
      // IMAPアカウント設定のモック
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_imap',
        type: 'imap',
        host: 'imap.example.com',
        port: 993,
        tls: true,
        user: 'test@example.com',
        password: 'password'
      });

      const handler = await connectionManager.getImapHandler('test_imap');
      expect(handler).toBeInstanceOf(ImapFlowHandler);
    });

    it('should reuse existing IMAP handler', async () => {
      // アカウント設定とハンドラー再利用のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_imap',
        type: 'imap',
        host: 'imap.example.com',
        port: 993,
        tls: true,
        user: 'test@example.com',
        password: 'password'
      });

      const handler1 = await connectionManager.getImapHandler('test_imap');
      const handler2 = await connectionManager.getImapHandler('test_imap');
      expect(handler1).toBe(handler2);
    });

    it('should throw error for non-existent IMAP account', async () => {
      // 存在しないアカウントのテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue(undefined);

      await expect(connectionManager.getImapHandler('nonexistent')).rejects.toThrow('IMAP account not found: nonexistent');
    });
  });

  describe('testConnection', () => {
    it('should test Gmail connection successfully', async () => {
      // Gmail接続テスト成功のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token'
      });

      // GmailHandler.testConnection をモック
      const mockTestConnection = vi.fn().mockResolvedValue(undefined);
      vi.mocked(GmailHandler).mockImplementation(() => ({
        testConnection: mockTestConnection
      }) as any);

      const result = await connectionManager.testConnection('test_gmail');
      expect(result.success).toBe(true);
      expect(result.accountType).toBe('gmail');
      expect(result.accountName).toBe('test_gmail');
      expect(result.message).toBe('Gmail connection test successful');
    });

    it('should test IMAP connection successfully', async () => {
      // IMAP接続テスト成功のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_imap',
        type: 'imap',
        host: 'imap.example.com',
        port: 993,
        tls: true,
        user: 'test@example.com',
        password: 'password'
      });

      // ImapFlowHandler.testConnection をモック
      const mockTestConnection = vi.fn().mockResolvedValue(undefined);
      vi.mocked(ImapFlowHandler).mockImplementation(() => ({
        testConnection: mockTestConnection
      }) as any);

      const result = await connectionManager.testConnection('test_imap');
      expect(result.success).toBe(true);
      expect(result.accountType).toBe('imap');
      expect(result.accountName).toBe('test_imap');
      expect(result.message).toBe('IMAP connection test successful');
    });

    it('should handle connection test failure', async () => {
      // 接続テスト失敗のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue(undefined);

      const result = await connectionManager.testConnection('nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Account not found');
    });

    it('should handle Gmail connection test error', async () => {
      // Gmail接続テストエラーのテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token'
      });

      // GmailHandler.testConnection がエラーを投げる
      const mockTestConnection = vi.fn().mockRejectedValue(new Error('Connection failed'));
      vi.mocked(GmailHandler).mockImplementation(() => ({
        testConnection: mockTestConnection
      }) as any);

      const result = await connectionManager.testConnection('test_gmail');
      expect(result.success).toBe(false);
      expect(result.accountType).toBe('gmail');
      expect(result.message).toContain('Connection test failed: Connection failed');
    });
  });

  describe('cleanup', () => {
    it('should cleanup all connections', async () => {
      // クリーンアップ機能のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token'
      });

      await connectionManager.getGmailHandler('test_gmail');
      const statusBefore = connectionManager.getPoolStatus();
      expect(statusBefore.gmail.active).toBe(1);

      await connectionManager.cleanup();
      const statusAfter = connectionManager.getPoolStatus();
      expect(statusAfter.gmail.active).toBe(0);
    });

    it('should cleanup IMAP connections', async () => {
      // IMAPクリーンアップ機能のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_imap',
        type: 'imap',
        host: 'imap.example.com',
        port: 993,
        tls: true,
        user: 'test@example.com',
        password: 'password'
      });

      await connectionManager.getImapHandler('test_imap');
      const statusBefore = connectionManager.getPoolStatus();
      expect(statusBefore.imap.active).toBe(1);

      await connectionManager.cleanup();
      
      const statusAfter = connectionManager.getPoolStatus();
      expect(statusAfter.imap.active).toBe(0);
    });
  });

  describe('getPoolStatus', () => {
    it('should return correct pool status', async () => {
      // プール状況取得のテスト
      const status = connectionManager.getPoolStatus();
      expect(status).toHaveProperty('gmail');
      expect(status).toHaveProperty('imap');
      expect(typeof status.gmail.active).toBe('number');
      expect(typeof status.imap.active).toBe('number');
      expect(Array.isArray(status.gmail.accounts)).toBe(true);
      expect(Array.isArray(status.imap.accounts)).toBe(true);
    });

    it('should track account names correctly', async () => {
      // アカウント名追跡のテスト
      vi.spyOn(accountManager, 'getAccount')
        .mockReturnValueOnce({
          name: 'gmail1',
          type: 'gmail',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          refreshToken: 'test-refresh-token'
        })
        .mockReturnValueOnce({
          name: 'imap1',
          type: 'imap',
          host: 'imap.example.com',
          port: 993,
          tls: true,
          user: 'test@example.com',
          password: 'password'
        });

      await connectionManager.getGmailHandler('gmail1');
      await connectionManager.getImapHandler('imap1');

      const status = connectionManager.getPoolStatus();
      expect(status.gmail.accounts).toContain('gmail1');
      expect(status.imap.accounts).toContain('imap1');
    });
  });
});