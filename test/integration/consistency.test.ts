// test/integration/consistency.test.ts
// 設計書の詳細を反映した実装コード

import { describe, it, expect, beforeEach, vi } from 'vitest'
import McpEmailServer from '../../src/index.js'

describe('Connection Consistency Verification', () => {
  let mcpServer: McpEmailServer;

  beforeEach(() => {
    mcpServer = new McpEmailServer();
  });

  it('should maintain consistency between test_connection and list_emails', async () => {
    // test_connectionとlist_emailsの一貫性確保の検証
    const accountName = 'test_account';

    // Mock ConnectionManager for consistent testing
    const mockConnectionManager = {
      testConnection: vi.fn(),
      getGmailHandler: vi.fn(),
      getImapHandler: vi.fn()
    };

    const mockAccountManager = {
      getAccount: vi.fn().mockReturnValue({
        name: accountName,
        type: 'gmail',
        config: {}
      })
    };

    (mcpServer as any).connectionManager = mockConnectionManager;
    (mcpServer as any).accountManager = mockAccountManager;

    // Scenario 1: test_connection成功時、list_emailsも成功
    mockConnectionManager.testConnection.mockResolvedValueOnce({
      success: true,
      accountName,
      accountType: 'gmail',
      message: 'Success'
    });

    mockConnectionManager.getGmailHandler.mockResolvedValueOnce({
      listEmails: vi.fn().mockResolvedValue([])
    });

    // test_connection実行
    const testRequest = {
      jsonrpc: '2.0' as const,
      method: 'tools/call',
      params: {
        name: 'test_connection',
        arguments: { account_name: accountName }
      },
      id: 1
    };

    const testResponse = await mcpServer.handleRequest(testRequest);

    // list_emails実行
    const listRequest = {
      jsonrpc: '2.0' as const,
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: { account_name: accountName, limit: 1 }
      },
      id: 2
    };

    const listResponse = await mcpServer.handleRequest(listRequest);

    // 一貫性確認
    if (testResponse.result.status === 'connected') {
      // test_connectionが成功した場合、list_emailsも成功するべき
      expect(listResponse.error).toBeUndefined();
      expect(listResponse.result).toBeDefined();
    } else {
      // test_connectionが失敗した場合、list_emailsも失敗するべき
      expect(listResponse.error).toBeDefined();
    }
  });

  it('should use same ConnectionManager instance for both operations', async () => {
    // 同一ConnectionManagerインスタンス使用の確認
    const accountName = 'test_account';
    
    // Mock setup
    const mockConnectionManager = {
      testConnection: vi.fn().mockResolvedValue({
        success: true,
        accountName,
        accountType: 'gmail',
        message: 'Success'
      }),
      getGmailHandler: vi.fn().mockResolvedValue({
        listEmails: vi.fn().mockResolvedValue([])
      })
    };

    const mockAccountManager = {
      getAccount: vi.fn().mockReturnValue({
        name: accountName,
        type: 'gmail',
        config: {}
      })
    };

    (mcpServer as any).connectionManager = mockConnectionManager;
    (mcpServer as any).accountManager = mockAccountManager;

    await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'test_connection', arguments: { account_name: accountName } },
      id: 1
    });

    await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'list_emails', arguments: { account_name: accountName } },
      id: 2
    });

    // ConnectionManagerが適切に呼ばれることを確認
    expect(mockConnectionManager.testConnection).toHaveBeenCalledTimes(1);
    expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledTimes(1);
    expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledWith(accountName);
  });

  it('should handle test_connection failure and list_emails consistency', async () => {
    // test_connection失敗時の一貫性テスト
    const accountName = 'failing_account';

    const mockConnectionManager = {
      testConnection: vi.fn().mockResolvedValue({
        success: false,
        accountName,
        accountType: 'imap',
        message: 'Connection failed'
      }),
      getImapHandler: vi.fn().mockRejectedValue(new Error('Connection failed'))
    };

    const mockAccountManager = {
      getAccount: vi.fn().mockReturnValue({
        name: accountName,
        type: 'imap',
        config: {}
      })
    };

    (mcpServer as any).connectionManager = mockConnectionManager;
    (mcpServer as any).accountManager = mockAccountManager;

    // test_connection実行（失敗）
    const testResponse = await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'test_connection', arguments: { account_name: accountName } },
      id: 1
    });

    // list_emails実行（失敗するべき）
    const listResponse = await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'list_emails', arguments: { account_name: accountName } },
      id: 2
    });

    // 一貫性確認：test_connection失敗時、list_emailsも失敗
    expect(testResponse.result.status).toBe('failed');
    expect(listResponse.error).toBeDefined();
    expect(listResponse.error?.message).toContain('Tool execution failed');
  });

  it('should verify duplicate instance elimination', () => {
    // 重複インスタンス作成の完全解消確認
    const server = new McpEmailServer();
    
    // McpEmailServerにgmailHandler/imapHandlerプロパティが存在しないことを確認
    expect((server as any).gmailHandler).toBeUndefined();
    expect((server as any).imapHandler).toBeUndefined();
    
    // ConnectionManagerが存在することを確認
    expect((server as any).connectionManager).toBeDefined();
    expect((server as any).connectionManager.constructor.name).toBe('ConnectionManager');
  });

  it('should maintain connection pool across multiple operations', async () => {
    // 接続プール再利用の確認
    const accountName = 'pool_test_account';
    
    const mockHandler = {
      listEmails: vi.fn().mockResolvedValue([]),
      getEmailDetail: vi.fn().mockResolvedValue({
        id: 'test-id',
        subject: 'Test',
        body: 'Test body'
      })
    };

    const mockConnectionManager = {
      testConnection: vi.fn().mockResolvedValue({
        success: true,
        accountName,
        accountType: 'gmail',
        message: 'Success'
      }),
      getGmailHandler: vi.fn().mockResolvedValue(mockHandler)
    };

    const mockAccountManager = {
      getAccount: vi.fn().mockReturnValue({
        name: accountName,
        type: 'gmail',
        config: {}
      })
    };

    (mcpServer as any).connectionManager = mockConnectionManager;
    (mcpServer as any).accountManager = mockAccountManager;

    // 複数の操作を実行
    await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'test_connection', arguments: { account_name: accountName } },
      id: 1
    });

    await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'list_emails', arguments: { account_name: accountName } },
      id: 2
    });

    await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'get_email_detail', arguments: { account_name: accountName, email_id: 'test-id' } },
      id: 3
    });

    // ConnectionManagerが適切に再利用されることを確認
    expect(mockConnectionManager.testConnection).toHaveBeenCalledTimes(1);
    expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledTimes(2); // list_emails + get_email_detail
    expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledWith(accountName);
  });
});