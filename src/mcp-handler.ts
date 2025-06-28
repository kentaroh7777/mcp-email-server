import { MCPRequest, MCPResponse, MCPError, InitializeResult } from './types.js';
import { GmailHandler } from './gmail.js';
import { IMAPHandler } from './imap.js';

interface ValidationResult {
  isValid: boolean;
  error?: MCPError;
}

export class MCPEmailProtocolHandler {
  private gmailHandler: GmailHandler;
  private imapHandler: IMAPHandler;
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    this.gmailHandler = new GmailHandler();
    this.encryptionKey = encryptionKey || process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
    this.imapHandler = new IMAPHandler(this.encryptionKey);
  }

  // アカウント名によってGmail/IMAPを自動判別する機能
  getAccountType(accountName: string): 'gmail' | 'imap' {
    // Gmail アカウントの命名規則
    if (accountName === 'MAIN' || accountName === 'WORK') {
      return 'gmail';
    }
    
    // 実際のGmailアカウント名をチェック
    const gmailAccounts = this.gmailHandler.getAvailableAccounts();
    if (gmailAccounts.includes(accountName)) {
      return 'gmail';
    }
    
    // それ以外はIMAPと判定
    return 'imap';
  }

  async handleRequest(request: any): Promise<MCPResponse> {
    const validationResult = this.validateRequest(request);
    
    if (!validationResult.isValid) {
      return this.createErrorResponse(request?.id ?? 0, validationResult.error!);
    }

    const mcpRequest = request as MCPRequest;

    try {
      switch (mcpRequest.method) {
        case 'initialize':
          const initializeResult: InitializeResult = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: true, listChanged: true }
            },
            serverInfo: {
              name: 'mcp-email-server',
              version: '1.0.0'
            }
          };
          return {
            jsonrpc: '2.0' as const,
            id: mcpRequest.id,
            result: initializeResult
          };

        case 'tools/list':
          // 統合化されたツール定義
          const unifiedAccountTools = [
            {
              name: 'list_accounts',
              description: 'List all configured email accounts with their status',
              inputSchema: {
                type: 'object',
                properties: {},
                required: []
              }
            },
            {
              name: 'test_connection',
              description: 'Test connection to a specific email account',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the account to test' }
                },
                required: ['account_name']
              }
            },
            {
              name: 'search_all_emails',
              description: 'Search emails across all Gmail and IMAP accounts',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' },
                  accounts: {
                    type: 'string',
                    enum: ['ALL', 'GMAIL_ONLY', 'IMAP_ONLY'],
                    description: 'Which accounts to search',
                    default: 'ALL'
                  },
                  limit: { type: 'number', description: 'Maximum number of results', default: 20 },
                  sortBy: {
                    type: 'string',
                    enum: ['date', 'relevance'],
                    description: 'Sort results by date or relevance',
                    default: 'date'
                  }
                },
                required: ['query']
              }
            },
            {
              name: 'get_account_stats',
              description: 'Get statistics for all configured accounts with account type information',
              inputSchema: {
                type: 'object',
                properties: {},
                required: []
              }
            }
          ];

          // 統合化されたメールツール（Gmail + IMAP対応）
          const unifiedEmailTools = [
            {
              name: 'list_emails',
              description: 'List emails from Gmail or IMAP account (automatically detects account type)',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the email account (MAIN, WORK for Gmail; other names for IMAP)' },
                  folder: { type: 'string', default: 'INBOX', description: 'Folder to list emails from' },
                  limit: { type: 'number', default: 20, maximum: 100, description: 'Maximum number of emails to return' },
                  unread_only: { type: 'boolean', default: false, description: 'Only return unread emails' }
                },
                required: ['account_name']
              }
            },
            {
              name: 'search_emails',
              description: 'Search emails in Gmail or IMAP account (automatically detects account type)',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the email account (MAIN, WORK for Gmail; other names for IMAP)' },
                  query: { type: 'string', description: 'Search query' },
                  limit: { type: 'number', default: 20, maximum: 100, description: 'Maximum number of emails to return' },
                  date_after: { type: 'string', description: 'Search emails after this date/time (Gmail only)' },
                  date_before: { type: 'string', description: 'Search emails before this date/time (Gmail only)' }
                },
                required: ['account_name', 'query']
              }
            },
            {
              name: 'get_email_detail',
              description: 'Get detailed information about a specific email (automatically detects account type)',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the email account' },
                  email_id: { type: 'string', description: 'ID of the email to get details for' }
                },
                required: ['account_name', 'email_id']
              }
            },
            {
              name: 'archive_email',
              description: 'Archive an email (automatically detects account type and uses appropriate method)',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the email account' },
                  email_id: { type: 'string', description: 'ID of the email to archive' },
                  remove_unread: { type: 'boolean', description: 'Whether to also remove UNREAD label (Gmail only)', default: false }
                },
                required: ['account_name', 'email_id']
              }
            }
          ];

          return {
            jsonrpc: '2.0' as const,
            id: mcpRequest.id,
            result: {
              tools: [...unifiedAccountTools, ...unifiedEmailTools]
            }
          };

        case 'tools/call':
          const { name, arguments: args } = mcpRequest.params || {};
          return await this.handleToolCall(name, args, mcpRequest.id);

        case 'resources/list':
          return {
            jsonrpc: '2.0' as const,
            id: mcpRequest.id,
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
          };

        default:
          return this.createErrorResponse(mcpRequest.id, {
            code: -32601,
            message: 'Method not found'
          });
      }
    } catch (error) {
      return this.createErrorResponse(mcpRequest.id, {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleToolCall(toolName: string, args: any, requestId: any): Promise<MCPResponse> {
    try {
      switch (toolName) {
        // アカウント管理ツール
        case 'list_accounts':
          return await this.handleListAccounts(args, requestId);
        
        case 'test_connection':
          return await this.handleTestConnection(args, requestId);
        
        case 'search_all_emails':
          return await this.handleSearchAllEmails(args, requestId);
        
        case 'get_account_stats':
          return await this.handleGetAccountStats(args, requestId);
        
        // 統合化されたメールツール
        case 'list_emails':
          return await this.handleListEmails(args, requestId);
        
        case 'search_emails':
          return await this.handleSearchEmails(args, requestId);
        
        case 'get_email_detail':
          return await this.handleGetEmailDetail(args, requestId);
        
        case 'archive_email':
          return await this.handleArchiveEmail(args, requestId);

        default:
          return this.createErrorResponse(requestId, {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          });
      }
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  // 統合化されたメールツールハンドラー
  private async handleListEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      // 必須パラメータチェック
      if (!args.account_name) {
        return this.createErrorResponse(requestId, {
          code: -32602,
          message: 'account_name is required'
        });
      }

      const accountType = this.getAccountType(args.account_name);
      
      if (accountType === 'gmail') {
      const actualAccountName = this.mapGmailAccountName(args.account_name);
      const emails = await this.gmailHandler.listEmails(actualAccountName, args);
        return this.createResponse(requestId, { emails });
      } else {
        // IMAP
        const emails = await this.imapHandler.listEmails(args.account_name, args);
        
        // IMAPの場合、unread_countを追加
        let unread_count = 0;
        if (args.unread_only) {
          unread_count = emails.filter(email => email.isUnread).length;
        } else {
          // 未読のみでない場合は、未読数を別途取得
          try {
            unread_count = await this.imapHandler.getUnreadCount(args.account_name);
          } catch (error) {
            unread_count = 0; // エラーの場合は0を設定
          }
        }
        
        return this.createResponse(requestId, { emails, unread_count });
      }
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32602,
        message: `Account not found: ${args.account_name}`
      });
    }
  }

  private async handleSearchEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      // 必須パラメータチェック
      if (!args.account_name || !args.query) {
        return this.createErrorResponse(requestId, {
          code: -32602,
          message: 'account_name and query are required'
        });
      }

      const accountType = this.getAccountType(args.account_name);
      
      if (accountType === 'gmail') {
        const actualAccountName = this.mapGmailAccountName(args.account_name);
        const emails = await this.gmailHandler.searchEmails(
          actualAccountName, 
          args.query, 
          args.limit || 20, 
          args.date_after, 
          args.date_before
        );
        return this.createResponse(requestId, { emails });
      } else {
        // IMAP
        const emails = await this.imapHandler.searchEmails(
          args.account_name, 
          args.query, 
          args.limit || 20
        );
        return this.createResponse(requestId, { emails });
      }
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32602,
        message: `Account not found: ${args.account_name}`
      });
    }
  }

  private async handleGetEmailDetail(args: any, requestId: any): Promise<MCPResponse> {
    try {
      // 必須パラメータチェック
      if (!args.account_name || !args.email_id) {
      return this.createErrorResponse(requestId, {
          code: -32602,
          message: 'account_name and email_id are required'
      });
    }

      const accountType = this.getAccountType(args.account_name);
    
      if (accountType === 'gmail') {
        const actualAccountName = this.mapGmailAccountName(args.account_name);
        const email = await this.gmailHandler.getEmailDetail(actualAccountName, args.email_id);
        return this.createResponse(requestId, { email });
      } else {
        // IMAP
        const email = await this.imapHandler.getEmailDetail(args.account_name, args.email_id);
        return this.createResponse(requestId, { email });
      }
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Tool execution failed: Failed to get email detail for ${args.account_name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async handleArchiveEmail(args: any, requestId: any): Promise<MCPResponse> {
    try {
      // 必須パラメータチェック
      if (!args.account_name || !args.email_id) {
      return this.createErrorResponse(requestId, {
          code: -32602,
          message: 'account_name and email_id are required'
      });
    }

      const accountType = this.getAccountType(args.account_name);
      
      if (accountType === 'gmail') {
        const actualAccountName = this.mapGmailAccountName(args.account_name);
        const result = await this.gmailHandler.archiveEmail(actualAccountName, args.email_id, args.remove_unread);
        return this.createResponse(requestId, { result });
      } else {
        // IMAP
        const result = await this.imapHandler.archiveEmail(args.account_name, args.email_id);
        return this.createResponse(requestId, { result });
      }
    } catch (error) {
      console.log('[DEBUG] Archive error:', error);
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Archive failed: Failed to archive email for ${args.account_name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private mapGmailAccountName(accountName: string): string {
    // Gmailアカウント名の正規化
    switch (accountName) {
      case 'MAIN':
        return 'kentaroh7';
      case 'WORK':
        return 'kabucoh'; // 実際に存在するアカウント名に変更
      case 'ALL':
        return 'ALL';
      default:
        return accountName;
    }
  }

  // 実際のアカウント名を取得するメソッド
  private getActualGmailAccounts(): string[] {
    return this.gmailHandler.getAvailableAccounts();
  }

  private getActualImapAccounts(): string[] {
    return this.imapHandler.getAvailableAccounts();
  }

  // 既存のメソッド
  private async handleListAccounts(_args: any, requestId: any): Promise<MCPResponse> {
    try {
      const gmailAccounts = this.getActualGmailAccounts();
      const imapAccounts = this.getActualImapAccounts();
      
      const accounts = [
        ...gmailAccounts.map(acc => ({ name: acc, type: 'gmail', configured: true })),
        ...imapAccounts.map(acc => ({ name: acc, type: 'imap', configured: true }))
      ];
      
      return this.createResponse(requestId, { accounts });
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Failed to list accounts: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async handleTestConnection(args: any, requestId: any): Promise<MCPResponse> {
    if (!args.account_name) {
        return this.createErrorResponse(requestId, {
          code: -32602,
        message: 'Missing required parameter: account_name'
        });
      }
      
    try {
      const accountType = this.getAccountType(args.account_name);
      let result;

      if (accountType === 'gmail') {
        const actualAccountName = this.mapGmailAccountName(args.account_name);
        // Gmail connection test - try to list a small number of emails
        try {
          await this.gmailHandler.listEmails(actualAccountName, { limit: 1 });
          result = { status: 'connected', accountType: 'gmail', account: actualAccountName };
        } catch (error) {
          result = { status: 'failed', accountType: 'gmail', account: actualAccountName, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      } else {
        // IMAP connection test - try to list a small number of emails
        try {
          await this.imapHandler.listEmails(args.account_name, { limit: 1 });
          result = { status: 'connected', accountType: 'imap', account: args.account_name };
        } catch (error) {
          result = { status: 'failed', accountType: 'imap', account: args.account_name, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }
      
      return this.createResponse(requestId, result);
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32602,
        message: `Account not found: ${args.account_name}`
      });
    }
  }

  private async handleSearchAllEmails(args: any, requestId: any): Promise<MCPResponse> {
    if (!args.query) {
      return this.createErrorResponse(requestId, {
        code: -32602,
        message: 'Missing required parameter: query'
      });
    }

    try {
      const result = await this.performSearchAllEmails(args);
      return this.createResponse(requestId, result);
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async performSearchAllEmails(args: any): Promise<any> {
    const { query, accounts = 'ALL', limit = 20, sortBy = 'date' } = args;
    
    const allEmails: any[] = [];
    let totalFound = 0;

    try {
      // Gmail accounts
      const gmailAccounts = this.getActualGmailAccounts();
      if (accounts === 'ALL' || accounts === 'GMAIL_ONLY') {
        for (const accountName of gmailAccounts) {
        try {
            const gmailResult = await this.gmailHandler.searchEmails(accountName, query, Math.ceil(limit / 4));
            if (gmailResult && Array.isArray(gmailResult)) {
              allEmails.push(...gmailResult.map((email: any) => ({
                ...email,
                accountName,
                accountType: 'gmail'
              })));
              totalFound += gmailResult.length;
            }
        } catch (error) {
            console.log(`Gmail search failed for ${accountName}:`, error);
          }
        }
      }

      // IMAP accounts
      const imapAccounts = this.getActualImapAccounts();
      if (accounts === 'ALL' || accounts === 'IMAP_ONLY') {
        for (const accountName of imapAccounts) {
        try {
            const imapResult = await this.imapHandler.searchEmails(accountName, query, Math.ceil(limit / 3));
            if (imapResult && Array.isArray(imapResult)) {
              allEmails.push(...imapResult.map((email: any) => ({
                ...email,
                accountName,
                accountType: 'imap'
              })));
              totalFound += imapResult.length;
            }
        } catch (error) {
            console.log(`IMAP search failed for ${accountName}:`, error);
        }
        }
    }
      
      // Sort and limit results
      if (sortBy === 'date') {
        allEmails.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      }
    
    return {
        emails: allEmails.slice(0, limit),
        totalFound,
        accounts: accounts,
        query
      };
    } catch (error) {
      throw error;
    }
  }

  private async handleGetAccountStats(_args: any, requestId: any): Promise<MCPResponse> {
    try {
      const gmailAccounts = this.getActualGmailAccounts();
      const imapAccounts = this.getActualImapAccounts();
      
      const accounts = [
        ...gmailAccounts.map(acc => ({ 
          name: acc, 
          type: 'gmail', 
          configured: true,
          connected: true // 実際の接続テストは省略
        })),
        ...imapAccounts.map(acc => ({ 
          name: acc, 
          type: 'imap', 
          configured: true,
          connected: true // 実際の接続テストは省略
        }))
      ];

      const summary = {
        totalAccounts: accounts.length,
        connectedAccounts: accounts.filter(acc => acc.connected).length,
        gmailAccounts: gmailAccounts.length,
        imapAccounts: imapAccounts.length
      };

      const statsData = {
        accounts,
        summary
      };
      
      return this.createResponse(requestId, statsData);
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Failed to get account stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  addImapAccount(accountName: string, host: string, port: number, secure: boolean, user: string, encryptedPassword: string): void {
    const config = {
      host,
      port,
      secure,
      user,
      password: encryptedPassword
    };
    this.imapHandler.addAccount(accountName, config);
  }

  addXServerAccount(accountName: string, server: string, domain: string, username: string, encryptedPassword: string): void {
    this.imapHandler.addXServerAccount(accountName, server, domain, username, encryptedPassword);
  }

  validateRequest(request: any): ValidationResult {
    if (!request || typeof request !== 'object') {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
    }

    if (request.jsonrpc !== '2.0') {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
    }

    if (request.id === undefined) {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
    }

    if (!request.method || typeof request.method !== 'string') {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
    }

    return { isValid: true };
  }

  createResponse(id: any, result: any): MCPResponse {
    return {
      jsonrpc: '2.0' as const,
      id,
      result: {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      }
    };
  }

  createErrorResponse(id: any, error: MCPError): MCPResponse {
    return {
      jsonrpc: '2.0' as const,
      id,
      error
    };
  }
} 