import { describe, it, expect, beforeEach } from 'vitest';
import { MCPEmailProtocolHandler } from '../src/mcp-handler.js';
import type { MCPRequest, MCPResponse } from '../src/types.js';

describe('MCPEmailProtocolHandler', () => {
  let handler: MCPEmailProtocolHandler;
  
  beforeEach(() => {
    handler = new MCPEmailProtocolHandler('test-encryption-key');
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

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true, listChanged: true }
          },
          serverInfo: {
            name: 'mcp-email-server',
            version: '1.0.0'
          }
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

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result).toHaveProperty('tools');
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(0);
      
      // Check for expected tools (統合化されたツール名)
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('list_emails'); // 統合済み: Gmail + IMAP
      expect(toolNames).toContain('search_emails'); // 統合済み: Gmail + IMAP
      expect(toolNames).toContain('get_email_detail'); // 統合済み: Gmail + IMAP
      expect(toolNames).toContain('archive_email'); // 統合済み: Gmail + IMAP
      expect(toolNames).toContain('list_accounts');
      expect(toolNames).toContain('test_connection');
      expect(toolNames).toContain('get_account_stats'); // 改良済み: アカウントタイプ情報付き
    });

    it('should handle resources/list request', async () => {
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
        result: {
          resources: [
            {
              uri: 'email://accounts',
              name: 'Email Accounts',
              description: 'Access to configured email accounts',
              mimeType: 'application/json'
            }
          ]
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
          message: 'Method not found'
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

      expect(response.error).toMatchObject({
        code: -32600,
        message: 'Invalid Request'
      });
    });

    it('should reject non-object request', async () => {
      const response = await handler.handleRequest('invalid');

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
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
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
        message: 'Unknown tool: unknown_tool'
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
      
      // test_connectionは結果を返す（エラーではない）
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
      expect(data).toBeDefined();
      expect(data).toHaveProperty('status', 'failed');
      expect(data).toHaveProperty('accountType', 'imap');
      expect(data).toHaveProperty('account', 'nonexistent_account');
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
        code: -32603,
        message: 'Tool execution failed: Failed to get email detail for test_account: IMAP account test_account not found'
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

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(11);
      
      // 複数メール対応の新しいレスポンス形式を確認
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
      expect(data).toBeDefined();
      expect(data).toHaveProperty('total', 1);
      expect(data).toHaveProperty('successful', 0);
      expect(data).toHaveProperty('failed', 1);
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('errors');
      expect(Array.isArray(data.results)).toBe(true);
      expect(Array.isArray(data.errors)).toBe(true);
      expect(data.errors.length).toBe(1);
      expect(data.errors[0]).toHaveProperty('email_id', 'test_id');
      expect(data.errors[0]).toHaveProperty('status', 'error');
      expect(data.errors[0]).toHaveProperty('error');
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

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(12);
      
      // 複数メール対応のレスポンス形式を確認
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
      expect(data).toBeDefined();
      expect(data).toHaveProperty('total', 3);
      expect(data).toHaveProperty('successful', 0);
      expect(data).toHaveProperty('failed', 3);
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('errors');
      expect(Array.isArray(data.results)).toBe(true);
      expect(Array.isArray(data.errors)).toBe(true);
      expect(data.errors.length).toBe(3);
      
      // 各エラーの詳細確認
      const expectedIds = ['test_id1', 'test_id2', 'test_id3'];
      data.errors.forEach((error: any, index: number) => {
        expect(error).toHaveProperty('email_id', expectedIds[index]);
        expect(error).toHaveProperty('status', 'error');
        expect(error).toHaveProperty('error');
      });
    });

    it('should handle improved get_account_stats tool', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'get_account_stats',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(13);
      
      // 改良されたレスポンス構造を確認
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
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
        id: 14,
        method: 'initialize',
        params: {}
      };

      const response = await handler.handleRequest(request);

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 14);
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