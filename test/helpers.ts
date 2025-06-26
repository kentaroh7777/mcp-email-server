import { MCPEmailServer } from '../src/index.js';
import { MCPRequest, MCPResponse } from '../src/types.js';

export class TestHelper {
  private server: MCPEmailServer;

  constructor() {
    this.server = new MCPEmailServer();
  }

  // MCP-todoist形式のレスポンスから実際のデータを抽出
  private extractMCPData(response: MCPResponse): any {
    if (response.error) return null;
    if (!response.result) return null;
    
    // mcp-todoist形式: {content: [{type: 'text', text: JSON.stringify(data)}]}
    if (response.result.content && Array.isArray(response.result.content)) {
      const textContent = response.result.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.text) {
        try {
          return JSON.parse(textContent.text);
        } catch (e) {
          console.error('Failed to parse MCP content:', e);
          return null;
        }
      }
    }
    
    return response.result;
  }

  // 実際の状態検証のためのヘルパーメソッド
  async verifyAccountExists(accountName: string): Promise<boolean> {
    const response = await this.callTool('list_accounts', {});
    if (response.error) return false;
    
    const data = this.extractMCPData(response);
    const accounts = data?.accounts || [];
    return accounts.some((acc: any) => acc.name === accountName);
  }

  async verifyAccountConnection(accountName: string): Promise<{ connected: boolean; message: string }> {
    const response = await this.callTool('test_connection', { account_name: accountName });
    if (response.error) {
      return { connected: false, message: response.error.message };
    }
    
    const data = this.extractMCPData(response);
    return {
      connected: data?.status === 'connected',
      message: data?.testResult || 'Unknown status'
    };
  }

  async verifyUnreadCount(accountName: string, expectedMinimum: number = 0): Promise<{ valid: boolean; actual: number }> {
    // アカウントタイプを判定して正しいツールを使用
    const accounts = this.getConfiguredAccounts();
    let toolName: string;
    
    if (accounts.gmail.includes(accountName)) {
      toolName = 'get_unread_count'; // Gmailツール
    } else if (accounts.imap.includes(accountName) || accounts.xserver.includes(accountName)) {
      toolName = 'get_imap_unread_count'; // IMAPツール
    } else {
      return { valid: false, actual: -1 };
    }
    
    const response = await this.callTool(toolName, { account_name: accountName });
    if (response.error) {
      return { valid: false, actual: -1 };
    }
    
    // MCP形式のレスポンスからデータを抽出
    const data = this.extractMCPData(response);
    let count = -1;
    if (data && typeof data === 'object') {
      if ('count' in data) {
        count = data.count;
      } else if ('unreadCount' in data) {
        count = data.unreadCount;
      }
    }
    
    return {
      valid: count >= expectedMinimum,
      actual: count
    };
  }

  async verifySearchResults(query: string, accounts: string = 'ALL', expectedMinimum: number = 0): Promise<{ valid: boolean; count: number; errors: string[] }> {
    const response = await this.callTool('search_all_emails', {
      query,
      accounts,
      limit: 10
    });
    
    if (response.error) {
      return { valid: false, count: 0, errors: [response.error.message] };
    }
    
    const data = this.extractMCPData(response);
    return {
      valid: (data?.emails?.length || 0) >= expectedMinimum,
      count: data?.emails?.length || 0,
      errors: data?.errors || []
    };
  }

  // MCP リクエストを送信するヘルパーメソッド
  async callTool(name: string, args: any): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: `test-${Date.now()}`,
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    return await this.server.handleRequest(request);
  }

  // MCP メソッドを直接呼び出すヘルパーメソッド
  async callMCPMethod(method: string, params: any): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: `test-${Date.now()}`,
      method,
      params
    };

    return await this.server.handleRequest(request);
  }

  // 環境設定の検証
  getConfiguredAccounts(): { gmail: string[]; imap: string[]; xserver: string[] } {
    const gmail: string[] = [];
    const imap: string[] = [];
    const xserver: string[] = [];

    Object.keys(process.env).forEach(key => {
      if (key.startsWith('GMAIL_ACCESS_TOKEN_')) {
        const accountName = key.replace('GMAIL_ACCESS_TOKEN_', '');
        gmail.push(accountName);
      } else if (key.startsWith('IMAP_HOST_')) {
        const accountName = key.replace('IMAP_HOST_', '');
        imap.push(accountName);
      } else if (key.startsWith('XSERVER_DOMAIN_')) {
        const accountName = key.replace('XSERVER_DOMAIN_', '');
        xserver.push(accountName);
      }
    });

    return { gmail, imap, xserver };
  }

  // 暗号化キーの検証
  isEncryptionKeyValid(): boolean {
    const key = process.env.EMAIL_ENCRYPTION_KEY;
    return !!(key && key !== 'your-encryption-key-here' && key !== 'your-very-secure-encryption-key-change-this');
  }

  // 必須ファイルの検証
  async verifyRequiredFiles(): Promise<{ exists: boolean; missing: string[] }> {
    const fs = await import('fs');
    const requiredFiles = [
      'src/index.ts',
      'src/gmail.ts',
      'src/imap.ts',
      'src/crypto.ts',
      'src/types.ts',
      'package.json',
      'tsconfig.json',
      '.env.example'
    ];

    const missing: string[] = [];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        missing.push(file);
      }
    }

    return {
      exists: missing.length === 0,
      missing
    };
  }
} 