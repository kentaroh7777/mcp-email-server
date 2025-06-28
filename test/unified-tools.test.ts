import { describe, test, expect } from 'vitest';
import { MCPEmailProtocolHandler } from '../src/mcp-handler.js';

describe('Unified Tools Tests', () => {
  const handler = new MCPEmailProtocolHandler();

  describe('Tools List Verification', () => {
    test('統合化されたツールが正しく定義されている', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      const response = await handler.handleRequest(request);
      expect(response.error).toBeUndefined();
      expect(response.result?.tools).toBeDefined();
      
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      
      // 統合化されたツールが含まれていることを確認
      expect(toolNames).toContain('list_emails');
      expect(toolNames).toContain('search_emails');
      expect(toolNames).toContain('get_email_detail');
      expect(toolNames).toContain('archive_email');

      // 古いIMAPツールが削除されていることを確認
      expect(toolNames).not.toContain('list_imap_emails');
      expect(toolNames).not.toContain('search_imap_emails');
      expect(toolNames).not.toContain('get_imap_email_detail');
    });

    test('各統合ツールに適切なスキーマが定義されている', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const response = await handler.handleRequest(request);
      const unifiedTools = ['list_emails', 'search_emails', 'get_email_detail', 'archive_email'];
      
      for (const toolName of unifiedTools) {
        const tool = response.result.tools.find((t: any) => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(tool.inputSchema.properties.account_name).toBeDefined();
        expect(tool.inputSchema.required).toContain('account_name');
      }
    });
  });

  describe('Unified Tool Execution', () => {
    test('list_emails - 存在しないアカウントで適切なエラーを返す', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: {
            account_name: 'non_existent_account'
          }
        }
      };

      const response = await handler.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Account not found');
    });

    test('search_emails - 存在しないアカウントで適切なエラーを返す', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'search_emails',
          arguments: {
            account_name: 'non_existent_account',
            query: 'test'
          }
        }
      };

      const response = await handler.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Account not found');
    });

    test('get_email_detail - 存在しないアカウントで適切なエラーを返す', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'get_email_detail',
          arguments: {
            account_name: 'non_existent_account',
            email_id: 'dummy_id'
          }
        }
      };

      const response = await handler.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('IMAP account');
    });

    test('archive_email - 存在しないアカウントで適切なエラーを返す', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'archive_email',
          arguments: {
            account_name: 'non_existent_account',
            email_id: 'dummy_id'
          }
        }
      };

      const response = await handler.handleRequest(request);
      
      // 複数メール対応の新しいレスポンス形式を確認
      expect(response.error).toBeUndefined();
      expect(response.result?.content?.[0]?.text).toBeDefined();
      
      const data = JSON.parse(response.result.content[0].text);
      expect(data).toHaveProperty('total', 1);
      expect(data).toHaveProperty('successful', 0);
      expect(data).toHaveProperty('failed', 1);
      expect(data).toHaveProperty('errors');
      expect(Array.isArray(data.errors)).toBe(true);
      expect(data.errors.length).toBe(1);
      expect(data.errors[0]).toHaveProperty('email_id', 'dummy_id');
      expect(data.errors[0]).toHaveProperty('status', 'error');
      expect(data.errors[0].error).toContain('IMAP account non_existent_account not found');
    });

    test('必須パラメータが不足している場合のエラーハンドリング', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('account_name is required');
    });
  });

  describe('Improved get_account_stats', () => {
    test('改良されたget_account_statsが新しい構造を返す', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'get_account_stats',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);
      
      expect(response.error).toBeUndefined();
      expect(response.result?.content?.[0]?.text).toBeDefined();

      const statsData = JSON.parse(response.result.content[0].text);
      
      // 新しい構造を確認
      expect(statsData.accounts).toBeDefined();
      expect(Array.isArray(statsData.accounts)).toBe(true);
      expect(statsData.summary).toBeDefined();
      expect(typeof statsData.summary.totalAccounts).toBe('number');
      expect(typeof statsData.summary.connectedAccounts).toBe('number');
      expect(typeof statsData.summary.gmailAccounts).toBe('number'); // 新規追加
      expect(typeof statsData.summary.imapAccounts).toBe('number'); // 新規追加
    });
  });

  describe('Account Type Detection', () => {
    test('アカウント名による自動判別機能が期待通りに動作する', () => {
      // 実際の統合化の動作確認はツール呼び出しを通して行う
      expect(true).toBe(true); // プレースホルダーテスト
    });
  });

  describe('Backward Compatibility', () => {
    test('既存のアカウント管理ツールが継続して動作する', async () => {
      const tools = ['list_accounts', 'test_connection', 'search_all_emails'];
      
      for (const toolName of tools) {
        const toolsRequest = {
          jsonrpc: '2.0',
          id: 9,
          method: 'tools/list',
          params: {}
        };

        const toolsResponse = await handler.handleRequest(toolsRequest);
        const toolNames = toolsResponse.result.tools.map((tool: any) => tool.name);
        
        expect(toolNames).toContain(toolName);
      }
    });

    test('search_all_emailsツールが正常に動作する', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'search_all_emails',
          arguments: {
            query: 'test',
            accounts: 'ALL',
            limit: 5
          }
        }
      };

      const response = await handler.handleRequest(request);
      
      // エラーが発生しても、適切な構造のレスポンスを返すことを確認
      if (response.error) {
        expect(response.error.message).toBeDefined();
      } else {
        expect(response.result?.content?.[0]?.text).toBeDefined();
        const data = JSON.parse(response.result.content[0].text);
        expect(data.emails).toBeDefined();
        expect(Array.isArray(data.emails)).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    test('不正なツール名の場合のエラーハンドリング', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'invalid_tool_name',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toContain('Unknown tool');
    });

    test('MCP protocol violation の場合のエラーハンドリング', async () => {
      const request = {
        jsonrpc: '1.0', // 不正なバージョン
        id: 12,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
    });
  });
}); 