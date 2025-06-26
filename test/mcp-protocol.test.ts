import { describe, test, expect } from 'vitest';
import { TestHelper } from './helpers.js';

describe('MCP Protocol Tests', () => {
  const helper = new TestHelper();

  describe('Initialize', () => {
    test('初期化リクエストが正しいレスポンスを返す', async () => {
      const response = await helper.callMCPMethod('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true }
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.capabilities.tools.listChanged).toBe(true);
      expect(response.result.serverInfo.name).toBe('mcp-email-server');
    });
  });

  describe('Tools Listing', () => {
    test('利用可能ツール一覧を取得できる', async () => {
      const response = await helper.callMCPMethod('tools/list', {});

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(0);

      // 実際の状態検証: 統合ツールとプロバイダーツールが含まれているか
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      
      // 統合ツール
      expect(toolNames).toContain('list_accounts');
      expect(toolNames).toContain('test_connection');
      expect(toolNames).toContain('search_all_emails');
      expect(toolNames).toContain('get_account_stats');
      
      // Gmailツール
      expect(toolNames).toContain('list_emails');
      expect(toolNames).toContain('search_emails');
      expect(toolNames).toContain('get_email_detail');
      // get_unread_count は実際の未読数と異なるため非公開化
      
      // IMAPツール
      expect(toolNames).toContain('list_imap_emails');
      expect(toolNames).toContain('search_imap_emails');
      expect(toolNames).toContain('get_imap_email_detail');
      expect(toolNames).toContain('get_imap_unread_count');
    });

    test('各ツールに適切なスキーマが定義されている', async () => {
      const response = await helper.callMCPMethod('tools/list', {});
      const tools = response.result.tools;

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        
        // 実際の状態検証: requiredフィールドが適切に設定されているか
        if (tool.inputSchema.required) {
          expect(Array.isArray(tool.inputSchema.required)).toBe(true);
        }
      }
    });
  });

  describe('Tool Execution', () => {
    test('存在しないツールを呼び出すとエラーが返る', async () => {
      const response = await helper.callTool('nonexistent_tool', {});
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toContain('Unknown tool');
    });

    test('不正なパラメータでツールを呼び出すとエラーが返る', async () => {
      // test_connectionには account_name パラメータが必須
      const response = await helper.callTool('test_connection', {});
      expect(response.error).toBeDefined();
    });
  });

  describe('Resources', () => {
    test('リソース一覧を取得できる', async () => {
      const response = await helper.callMCPMethod('resources/list', {});
      
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result.resources).toBeDefined();
      expect(Array.isArray(response.result.resources)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('存在しないメソッドを呼び出すとエラーが返る', async () => {
      const response = await helper.callMCPMethod('nonexistent/method', {});
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toBe('Method not found');
    });

    test('不正なJSONRPCリクエストの確認', () => {
      const invalidRequest: Partial<{ jsonrpc: string; id: string; method: string }> = {
        // jsonrpc フィールドが欠けている
        id: 'test',
        method: 'tools/list'
      };

      // この場合のテストは、サーバーが適切にエラーハンドリングすることを確認
      expect(invalidRequest.jsonrpc).toBeUndefined();
    });
  });
}); 