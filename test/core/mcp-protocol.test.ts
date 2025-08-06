import { describe, it, expect, beforeEach } from 'vitest';
import McpEmailServer from '../../src/index.js';
import type { MCPRequest, MCPResponse } from '../../src/types.js';

describe('MCPEmailProtocolHandler', () => {
  let handler: McpEmailServer;
  
  beforeEach(() => {
    handler = new McpEmailServer();
  });

  describe('Basic MCP Protocol', () => {
    it('should handle initialize request', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };

      const response = await handler.handleRequest(request);

      const data = response.result;
      expect(data).toMatchObject({
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'mcp-email-server',
          version: '1.0.0'
        }
      });
    });

    it('should handle tools/list request', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const response = await handler.handleRequest(request);

      const data = response.result;
      expect(data).toHaveProperty('tools');
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.tools.length).toBeGreaterThan(0);
      
      // Check for expected tools (統合化されたツール名)
      const toolNames = data.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('list_emails');
      expect(toolNames).toContain('search_emails');
      expect(toolNames).toContain('get_email_detail');
      expect(toolNames).toContain('archive_email');
      expect(toolNames).toContain('send_email');
      expect(toolNames).toContain('list_accounts');
      expect(toolNames).toContain('test_connection');
      expect(toolNames).toContain('get_account_stats'); // 改良済み: アカウントタイプ情報付き
    });

    it('should return error for resources/list request (not implemented)', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list',
        params: {}
      };

      const response = await handler.handleRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        error: {
          code: -32601,
          message: 'Method not found: resources/list'
        }
      });
    });

    it('should return error for unknown method', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'unknown_method',
        params: {}
      };

      const response = await handler.handleRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        error: {
          code: -32601,
          message: 'Method not found: unknown_method'
        }
      });
    });
  });

  describe('Request Validation', () => {
    it('should reject invalid jsonrpc version', async () => {
      const request = {
        jsonrpc: '1.0',
        id: 1,
        method: 'initialize',
        params: {}
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.id).toBeNull();
      expect(response.error).toMatchObject({
        code: -32600,
        message: 'Invalid Request'
      });
    });

    it('should reject request without id', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {}
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.id).toBeNull();
      expect(response.error).toMatchObject({
        code: -32600,
        message: 'Invalid Request'
      });
    });

    it('should reject request without method', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        params: {}
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.id).toBeNull();
      expect(response.error).toMatchObject({
        code: -32600,
        message: 'Invalid Request'
      });
    });

    it('should reject non-object request', async () => {
      const response = await handler.handleRequest('invalid');

      expect(response.error).toBeDefined();
      expect(response.id).toBeNull();
      expect(response.error).toMatchObject({
        code: -32600,
        message: 'Invalid Request'
      });
    });
  });

  describe('Tool Calls', () => {
    it('should handle list_accounts tool call', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'list_accounts',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(5);
      
      // mcp-todoist形式のレスポンスをパース
      const data = response.result;
      expect(data).toBeDefined();
      expect(data).toHaveProperty('accounts');
      expect(Array.isArray(data.accounts)).toBe(true);
    });

    it('should return error for unknown tool', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toMatchObject({
        code: -32601,
        message: 'Tool not found: unknown_tool'
      });
    });

    it('should handle test_connection with missing account', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'test_connection',
          arguments: {
            account_name: 'nonexistent_account'
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(7);
      
      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: nonexistent_account'
      });
    });

    // 統合化されたツールのテスト
    it('should handle unified list_emails tool', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: {
            account_name: 'test_account'
          }
        }
      };

      const response = await handler.handleRequest(request);

      // アカウントが存在しない場合のエラーを確認
      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: test_account'
      });
    });

    it('should handle unified search_emails tool', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'search_emails',
          arguments: {
            account_name: 'test_account',
            query: 'test'
          }
        }
      };

      const response = await handler.handleRequest(request);

      // アカウントが存在しない場合のエラーを確認
      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: test_account'
      });
    });

    it('should handle unified get_email_detail tool', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'get_email_detail',
          arguments: {
            account_name: 'test_account',
            email_id: 'test_id'
          }
        }
      };

      const response = await handler.handleRequest(request);

      // アカウントが存在しない場合のエラーを確認
      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: test_account'
      });
    });

    it('should handle unified archive_email tool (single email)', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'archive_email',
          arguments: {
            account_name: 'test_account',
            email_id: 'test_id'
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: test_account'
      });
    });

    it('should handle unified archive_email tool (multiple emails)', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'archive_email',
          arguments: {
            account_name: 'test_account',
            email_id: ['test_id1', 'test_id2', 'test_id3']
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: test_account'
      });
    });

    it('should handle unified send_email tool (basic validation)', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'send_email',
          arguments: {
            account_name: 'test_account',
            to: 'test@example.com',
            subject: 'Test Email',
            text: 'This is a test email message.'
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(13);
      
      expect(response.error).toBeDefined();
      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: test_account'
      });
    });

    it('should handle send_email with missing required parameters', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'send_email',
          arguments: {
            account_name: 'test_account'
            // 必須パラメータ（to, subject）が不足
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: test_account'
      });
    });

    it('should handle send_email with missing content', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'send_email',
          arguments: {
            account_name: 'test_account',
            to: 'test@example.com',
            subject: 'Test Email'
            // textまたはhtmlが不足
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: test_account'
      });
    });

    it('should handle improved get_account_stats tool', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: {
          name: 'get_account_stats',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(16);
      
      // 改良されたレスポンス構造を確認
      const data = response.result;
      expect(data).toBeDefined();
      expect(data).toHaveProperty('accounts');
      expect(data).toHaveProperty('summary');
      expect(data.summary).toHaveProperty('totalAccounts');
      expect(data.summary).toHaveProperty('connectedAccounts');
      expect(data.summary).toHaveProperty('gmailAccounts'); // 新規追加
      expect(data.summary).toHaveProperty('imapAccounts'); // 新規追加
      expect(Array.isArray(data.accounts)).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should always return valid MCPResponse format', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 17,
        method: 'initialize',
        params: {}
      };

      const response = await handler.handleRequest(request);

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 17);
      expect(response).toSatisfy((res: MCPResponse) => {
        return res.result !== undefined || res.error !== undefined;
      });
    });

    it('should preserve request id in response', async () => {
      const testIds = [1, 'test-string', 0];

      for (const testId of testIds) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: testId,
          method: 'initialize',
          params: {}
        };

        const response = await handler.handleRequest(request);
        expect(response.id).toBe(testId);
      }
    });
  });
}); 