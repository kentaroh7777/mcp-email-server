import { describe, it, expect, beforeEach, vi } from 'vitest'
import McpEmailServer from '../../src/index.js'

// モック設定
vi.mock('../../src/connection-manager.js')
vi.mock('../../src/services/account-manager.js')

describe('McpEmailServer Integration', () => {
  let mcpServer: McpEmailServer;

  beforeEach(() => {
    mcpServer = new McpEmailServer();
  });

  describe('ConnectionManager Integration', () => {
    it('should use ConnectionManager for Gmail operations', async () => {
      // ConnectionManagerのモック設定
      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue({
          listEmails: vi.fn().mockResolvedValue([]),
          testConnection: vi.fn().mockResolvedValue(undefined)
        }),
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_gmail',
          accountType: 'gmail',
          message: 'Gmail connection test successful'
        })
      };

      // McpEmailServerにモックを注入
      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_gmail',
          type: 'gmail',
          config: {}
        })
      };

      // list_emailsツール実行テスト
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'test_gmail' }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.result).toBeDefined();
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledWith('test_gmail');
    });

    it('should use ConnectionManager for IMAP operations', async () => {
      // ConnectionManagerのモック設定
      const mockConnectionManager = {
        getImapHandler: vi.fn().mockResolvedValue({
          listEmails: vi.fn().mockResolvedValue([]),
          testConnection: vi.fn().mockResolvedValue(undefined)
        }),
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_imap',
          accountType: 'imap',
          message: 'IMAP connection test successful'
        })
      };

      // McpEmailServerにモックを注入
      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_imap',
          type: 'imap',
          config: {}
        })
      };

      // list_emailsツール実行テスト
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'test_imap' }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.result).toBeDefined();
      expect(mockConnectionManager.getImapHandler).toHaveBeenCalledWith('test_imap');
    });

    it('should use ConnectionManager for test_connection', async () => {
      // test_connectionの統合テスト
      const mockConnectionManager = {
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_account',
          accountType: 'gmail',
          message: 'Gmail connection test successful'
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_account',
          type: 'gmail',
          config: {}
        })
      };

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'test_connection',
          arguments: { account_name: 'test_account' }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.result).toEqual({
        status: 'connected',
        account: 'test_account',
        accountType: 'gmail',
        testResult: 'Gmail connection test successful'
      });
    });

    it('should use ConnectionManager for search_all_emails', async () => {
      // search_all_emailsの統合テスト
      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue({
          searchEmails: vi.fn().mockResolvedValue([
            { id: '1', subject: 'Test Email', from: 'test@gmail.com', date: '2023-01-01' }
          ])
        }),
        getImapHandler: vi.fn().mockResolvedValue({
          searchEmails: vi.fn().mockResolvedValue([
            { id: '2', subject: 'IMAP Email', from: 'test@imap.com', date: '2023-01-02' }
          ])
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getGmailAccounts: vi.fn().mockReturnValue([{ name: 'test_gmail', type: 'gmail' }]),
        getImapAccounts: vi.fn().mockReturnValue([{ name: 'test_imap', type: 'imap' }])
      };

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'search_all_emails',
          arguments: { query: 'test', limit: 10 }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.result).toBeDefined();
      expect(response.result.emails).toBeDefined();
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledWith('test_gmail');
      expect(mockConnectionManager.getImapHandler).toHaveBeenCalledWith('test_imap');
    });
  });

  describe('Duplicate Instance Prevention', () => {
    it('should not create duplicate Gmail handlers', async () => {
      // 重複インスタンス作成防止のテスト
      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue({
          listEmails: vi.fn().mockResolvedValue([])
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_gmail',
          type: 'gmail',
          config: {}
        })
      };

      // 複数回のツール実行
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'test_gmail' }
        },
        id: 1
      };

      await mcpServer.handleRequest(request);
      await mcpServer.handleRequest(request);

      // ConnectionManagerが適切に呼ばれることを確認
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledTimes(2);
    });

    it('should not create duplicate IMAP handlers', async () => {
      // 重複インスタンス作成防止のテスト
      const mockConnectionManager = {
        getImapHandler: vi.fn().mockResolvedValue({
          listEmails: vi.fn().mockResolvedValue([])
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_imap',
          type: 'imap',
          config: {}
        })
      };

      // 複数回のツール実行
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'test_imap' }
        },
        id: 1
      };

      await mcpServer.handleRequest(request);
      await mcpServer.handleRequest(request);

      // ConnectionManagerが適切に呼ばれることを確認
      expect(mockConnectionManager.getImapHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle ConnectionManager errors gracefully', async () => {
      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockRejectedValue(new Error('Connection failed'))
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_gmail',
          type: 'gmail',
          config: {}
        })
      };

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'test_gmail' }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Connection failed');
    });
  });
});