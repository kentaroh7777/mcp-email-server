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
      
      // Check for expected tools (NEW ARCHITECTURE NAMES)
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('list_emails');
      expect(toolNames).toContain('list_imap_emails');
      expect(toolNames).toContain('list_accounts');
      expect(toolNames).toContain('test_connection');
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

      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Account not found: nonexistent_account'
      });
    });
  });

  describe('Response Format', () => {
    it('should always return valid MCPResponse format', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 8,
        method: 'initialize',
        params: {}
      };

      const response = await handler.handleRequest(request);

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 8);
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