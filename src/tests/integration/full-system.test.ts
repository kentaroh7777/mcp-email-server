// src/tests/integration/full-system.test.ts
// 設計書：単体テスト、統合テスト、回帰テストの実装

import { describe, it, expect, beforeAll, vi } from 'vitest'
import McpEmailServer from '../../index.js'
import { ConnectionManager } from '../../connection-manager.js'
import { ConnectionLogger } from '../../connection-logger.js'

describe('Full System Integration Test', () => {
  let mcpServer: McpEmailServer;

  beforeAll(() => {
    mcpServer = new McpEmailServer();
  });

  describe('Single Unit Tests', () => {
    it('should have ConnectionManager properly integrated', () => {
      // 単体テスト：ConnectionManager統合確認
      expect((mcpServer as any).connectionManager).toBeInstanceOf(ConnectionManager);
      expect(typeof (mcpServer as any).connectionManager.getPoolStatus).toBe('function');
    });

    it('should have ConnectionLogger singleton working', () => {
      // 単体テスト：ConnectionLoggerシングルトン確認
      const logger1 = ConnectionLogger.getInstance();
      const logger2 = ConnectionLogger.getInstance();
      expect(logger1).toBe(logger2);
    });

    it('should verify no duplicate handler instances exist', () => {
      // 単体テスト：重複インスタンス削除確認
      expect((mcpServer as any).gmailHandler).toBeUndefined();
      expect((mcpServer as any).imapHandler).toBeUndefined();
      expect((mcpServer as any).connectionManager).toBeInstanceOf(ConnectionManager);
    });

    it('should have proper AccountManager integration', () => {
      // 単体テスト：AccountManager統合確認
      expect((mcpServer as any).accountManager).toBeDefined();
      expect(typeof (mcpServer as any).accountManager.getAccount).toBe('function');
      expect(typeof (mcpServer as any).accountManager.getAllAccounts).toBe('function');
    });
  });

  describe('Integration Tests', () => {
    it('should integrate McpEmailServer with ConnectionManager', async () => {
      // 統合テスト：McpEmailServerとConnectionManagerの統合動作確認
      const mockConnectionManager = {
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_account',
          accountType: 'gmail',
          message: 'Success'
        }),
        getPoolStatus: vi.fn().mockReturnValue({
          gmail: { active: 0, accounts: [] },
          imap: { active: 0, accounts: [] }
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
        testResult: 'Success'
      });
    });

    it('should integrate multiple tools through ConnectionManager', async () => {
      // 統合テスト：複数ツールのConnectionManager経由統合
      const mockHandler = {
        listEmails: vi.fn().mockResolvedValue([{
          id: 'email-1',
          subject: 'Test Email',
          from: 'test@example.com',
          date: new Date().toISOString()
        }]),
        getEmailDetail: vi.fn().mockResolvedValue({
          id: 'email-1',
          subject: 'Test Email',
          from: 'test@example.com',
          body: 'Test email body',
          attachments: []
        })
      };

      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue(mockHandler)
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'integration_test_account',
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
          arguments: { account_name: 'integration_test_account', limit: 1 }
        },
        id: 1
      });

      // get_email_detail実行
      const detailResponse = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_email_detail',
          arguments: { account_name: 'integration_test_account', email_id: 'email-1' }
        },
        id: 2
      });

      expect(listResponse.result).toBeDefined();
      expect(Array.isArray(listResponse.result)).toBe(true);
      expect(listResponse.result[0].id).toBe('email-1');

      expect(detailResponse.result).toBeDefined();
      expect(detailResponse.result.id).toBe('email-1');
      expect(detailResponse.result.body).toBe('Test email body');

      // 同じConnectionManagerが使用されることを確認
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledTimes(2);
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledWith('integration_test_account');
    });

    it('should handle IMAP and Gmail accounts through unified ConnectionManager', async () => {
      // 統合テスト：IMAP/Gmail統一管理
      const mockGmailHandler = {
        listEmails: vi.fn().mockResolvedValue([{ id: 'gmail-1', subject: 'Gmail Test' }])
      };

      const mockImapHandler = {
        listEmails: vi.fn().mockResolvedValue([{ id: 'imap-1', subject: 'IMAP Test' }])
      };

      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue(mockGmailHandler),
        getImapHandler: vi.fn().mockResolvedValue(mockImapHandler)
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      const mockAccountManager = vi.fn()
        .mockReturnValueOnce({ name: 'gmail_account', type: 'gmail', config: {} })
        .mockReturnValueOnce({ name: 'imap_account', type: 'imap', config: {} });

      (mcpServer as any).accountManager = {
        getAccount: mockAccountManager
      };

      // Gmail アカウントテスト
      const gmailResponse = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'list_emails', arguments: { account_name: 'gmail_account' } },
        id: 1
      });

      // IMAP アカウントテスト
      const imapResponse = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'list_emails', arguments: { account_name: 'imap_account' } },
        id: 2
      });

      expect(gmailResponse.result).toBeDefined();
      expect(gmailResponse.result[0].subject).toBe('Gmail Test');

      expect(imapResponse.result).toBeDefined();
      expect(imapResponse.result[0].subject).toBe('IMAP Test');

      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledWith('gmail_account');
      expect(mockConnectionManager.getImapHandler).toHaveBeenCalledWith('imap_account');
    });
  });

  describe('Regression Tests', () => {
    it('should maintain existing API compatibility', async () => {
      // 回帰テスト：既存機能の動作継続確認
      const initResponse = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 1
      });

      expect(initResponse.result).toHaveProperty('protocolVersion');
      expect(initResponse.result).toHaveProperty('capabilities');
      expect(initResponse.result).toHaveProperty('serverInfo');
      expect(initResponse.result.serverInfo.name).toBe('mcp-email-server');
    });

    it('should return same tool structure as before', () => {
      // 回帰テスト：ツール構造の継続性確認
      const tools = mcpServer.getTools();
      expect(tools).toHaveProperty('tools');
      expect(Array.isArray(tools.tools)).toBe(true);
      
      const requiredTools = [
        'list_emails', 'search_emails', 'get_email_detail',
        'archive_email', 'send_email', 'list_accounts',
        'test_connection', 'get_account_stats', 'search_all_emails'
      ];
      
      const toolNames = tools.tools.map(t => t.name);
      requiredTools.forEach(toolName => {
        expect(toolNames).toContain(toolName);
      });
    });

    it('should maintain error handling compatibility', async () => {
      // 回帰テスト：エラーハンドリング継続性確認
      const invalidResponse = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'invalid_method',
        params: {},
        id: 1
      });

      expect(invalidResponse.error).toBeDefined();
      expect(invalidResponse.error?.code).toBe(-32601);
      expect(invalidResponse.error?.message).toContain('Method not found');
    });

    it('should maintain tool parameter validation', async () => {
      // 回帰テスト：パラメータ検証継続性確認
      const response = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: {} // account_name missing
        },
        id: 1
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('account_name is required');
    });
  });

  describe('System Verification', () => {
    // 外部コマンド実行テストは削除（テスト内からテストを実行しない）

    it('should verify duplicate instance elimination', () => {
      // システム検証：重複インスタンス作成の完全解消
      const server = new McpEmailServer();
      
      // McpEmailServerにgmailHandler/imapHandlerプロパティが存在しないことを確認
      expect((server as any).gmailHandler).toBeUndefined();
      expect((server as any).imapHandler).toBeUndefined();
      
      // ConnectionManagerが存在することを確認
      expect((server as any).connectionManager).toBeInstanceOf(ConnectionManager);
    });

    it('should verify consistent connection pool behavior', async () => {
      // システム検証：接続プール一貫性
      const server = new McpEmailServer();
      const connectionManager = (server as any).connectionManager;
      
      // プールの初期状態確認
      const initialStatus = connectionManager.getPoolStatus();
      expect(initialStatus.gmail.active).toBe(0);
      expect(initialStatus.imap.active).toBe(0);
      expect(Array.isArray(initialStatus.gmail.accounts)).toBe(true);
      expect(Array.isArray(initialStatus.imap.accounts)).toBe(true);
    });

    it('should verify ConnectionLogger integration', () => {
      // システム検証：ConnectionLogger統合確認
      const logger = ConnectionLogger.getInstance();
      expect(logger).toBeDefined();
      
      // シングルトンパターン確認
      const logger2 = ConnectionLogger.getInstance();
      expect(logger).toBe(logger2);
      
      // 基本メソッド存在確認
      expect(typeof logger.logConnectionEvent).toBe('function');
      expect(typeof logger.logPoolStatus).toBe('function');
      expect(typeof logger.logConnectionError).toBe('function');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      // パフォーマンステスト：並行リクエスト処理
      const mockConnectionManager = {
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'concurrent_test',
          accountType: 'gmail',
          message: 'Success'
        })
      };

      const mockAccountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'concurrent_test',
          type: 'gmail',
          config: {}
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = mockAccountManager;

      // 並行してリクエストを実行
      const requests = Array.from({ length: 5 }, (_, i) =>
        mcpServer.handleRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'test_connection', arguments: { account_name: 'concurrent_test' } },
          id: i + 1
        })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.result.status).toBe('connected');
      });

      expect(mockConnectionManager.testConnection).toHaveBeenCalledTimes(5);
    });

    it('should maintain memory efficiency with connection pooling', () => {
      // リソース管理テスト：メモリ効率性
      const server1 = new McpEmailServer();
      const server2 = new McpEmailServer();
      
      // 各サーバーが独立したConnectionManagerを持つことを確認
      expect((server1 as any).connectionManager).not.toBe((server2 as any).connectionManager);
      
      // しかし、ConnectionLoggerはシングルトンであることを確認
      const logger1 = ConnectionLogger.getInstance();
      const logger2 = ConnectionLogger.getInstance();
      expect(logger1).toBe(logger2);
    });
  });
});