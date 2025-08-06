import { describe, it, expect, beforeEach, vi } from 'vitest'
import McpEmailServer from '../../src/index.js'

describe('API Compatibility', () => {
  let mcpServer: McpEmailServer;

  beforeEach(() => {
    mcpServer = new McpEmailServer();
  });

  describe('Tool Response Format', () => {
    it('should maintain test_connection response format', async () => {
      // API互換性：test_connection戻り値形式の確認
      const mockConnectionManager = {
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_account',
          accountType: 'gmail',
          message: 'Connection successful'
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
      
      // 既存の戻り値形式を維持
      expect(response.result).toHaveProperty('status');
      expect(response.result).toHaveProperty('account');
      expect(response.result).toHaveProperty('accountType');
      expect(response.result).toHaveProperty('testResult');
      expect(response.result.status).toBe('connected');
    });

    it('should maintain test_connection failure response format', async () => {
      // API互換性：test_connection失敗時の戻り値形式の確認
      const mockConnectionManager = {
        testConnection: vi.fn().mockResolvedValue({
          success: false,
          accountName: 'test_account',
          accountType: 'gmail',
          message: 'Connection failed'
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
      
      // 既存の戻り値形式を維持
      expect(response.result).toHaveProperty('status');
      expect(response.result).toHaveProperty('account');
      expect(response.result).toHaveProperty('accountType');
      expect(response.result).toHaveProperty('testResult');
      expect(response.result.status).toBe('failed');
    });

    it('should maintain send_email response format', async () => {
      // API互換性：send_email戻り値形式の確認
      const mockHandler = {
        sendEmail: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'test-message-id',
          error: undefined
        })
      };

      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue(mockHandler)
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
          name: 'send_email',
          arguments: {
            account_name: 'test_gmail',
            to: 'test@example.com',
            subject: 'Test',
            text: 'Test message'
          }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      
      // 既存の戻り値形式を維持
      expect(response.result).toHaveProperty('success');
      expect(response.result).toHaveProperty('messageId');
      expect(response.result).toHaveProperty('error');
    });

    it('should maintain list_emails response format', async () => {
      // API互換性：list_emails戻り値形式の確認
      const mockHandler = {
        listEmails: vi.fn().mockResolvedValue([
          {
            id: '1',
            subject: 'Test Email',
            from: 'test@example.com',
            date: '2023-01-01',
            snippet: 'Test snippet'
          }
        ])
      };

      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue(mockHandler)
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
      
      // 配列形式の戻り値を確認
      expect(Array.isArray(response.result)).toBe(true);
      if (Array.isArray(response.result) && response.result.length > 0) {
        const email = response.result[0];
        expect(email).toHaveProperty('id');
        expect(email).toHaveProperty('subject');
        expect(email).toHaveProperty('from');
        expect(email).toHaveProperty('date');
      }
    });

    it('should maintain search_all_emails response format', async () => {
      // API互換性：search_all_emails戻り値形式の確認
      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue({
          searchEmails: vi.fn().mockResolvedValue([
            { id: '1', subject: 'Test Email', from: 'test@gmail.com', date: '2023-01-01' }
          ])
        }),
        getImapHandler: vi.fn().mockResolvedValue({
          searchEmails: vi.fn().mockResolvedValue([])
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
      
      // 既存の戻り値形式を維持
      expect(response.result).toHaveProperty('emails');
      expect(response.result).toHaveProperty('totalFound');
      expect(response.result).toHaveProperty('searchQuery');
      expect(Array.isArray(response.result.emails)).toBe(true);
      expect(typeof response.result.totalFound).toBe('number');
      expect(typeof response.result.searchQuery).toBe('string');
    });
  });

  describe('Tool List Compatibility', () => {
    it('should return same tool list structure', () => {
      // API互換性：ツールリストの構造確認
      const toolsResponse = mcpServer.getTools();
      expect(toolsResponse).toHaveProperty('tools');
      expect(Array.isArray(toolsResponse.tools)).toBe(true);
      
      // 主要ツールの存在確認
      const toolNames = toolsResponse.tools.map(t => t.name);
      expect(toolNames).toContain('list_emails');
      expect(toolNames).toContain('test_connection');
      expect(toolNames).toContain('send_email');
      expect(toolNames).toContain('search_emails');
      expect(toolNames).toContain('get_email_detail');
      expect(toolNames).toContain('archive_email');
      expect(toolNames).toContain('list_accounts');
      expect(toolNames).toContain('get_account_stats');
      expect(toolNames).toContain('search_all_emails');
    });

    it('should maintain tool schema structure', () => {
      // API互換性：ツールスキーマの構造確認
      const toolsResponse = mcpServer.getTools();
      const testConnectionTool = toolsResponse.tools.find(t => t.name === 'test_connection');
      
      expect(testConnectionTool).toBeDefined();
      expect(testConnectionTool?.description).toBeDefined();
      expect(testConnectionTool?.inputSchema).toBeDefined();
      expect(testConnectionTool?.inputSchema.properties).toHaveProperty('account_name');
      expect(testConnectionTool?.inputSchema.required).toContain('account_name');
    });
  });

  describe('MCP Protocol Compatibility', () => {
    it('should maintain initialize response format', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'initialize',
        params: {},
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response).toHaveProperty('result');
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: expect.any(String),
          capabilities: expect.any(Object),
          serverInfo: expect.any(Object)
        }
      });
    });

    it('should maintain error response format', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'invalid_method',
        params: {},
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle account name validation consistently', async () => {
      const mockConnectionManager = {
        getGmailHandler: vi.fn()
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue(null)
      };

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'nonexistent' }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Account not found');
    });

    it('should handle missing account_name parameter consistently', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: {}
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('account_name is required');
    });
  });
});