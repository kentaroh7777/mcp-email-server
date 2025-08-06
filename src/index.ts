import { AccountManager } from './services/account-manager';
import { GmailHandler } from './services/gmail';
import { ImapFlowHandler } from './services/imapflow-handler';
import { MCPRequest, MCPResponse, McpError, Tool, EmailMessage } from './types';

export default class McpEmailServer {
  private accountManager: AccountManager;
  private gmailHandler: GmailHandler;
  private imapHandler: ImapFlowHandler;
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
    this.accountManager = new AccountManager();
    this.gmailHandler = new GmailHandler(this.accountManager.getGmailAccounts());
    this.imapHandler = new ImapFlowHandler(this.accountManager.getImapAccounts(), this.encryptionKey);
  }

  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    // リクエストの基本構造を検証
    if (typeof request !== 'object' || request === null || request.jsonrpc !== '2.0' || typeof request.method !== 'string' || typeof request.id === 'undefined') {
      return {
        jsonrpc: '2.0',
        id: null,
        error: new McpError(-32600, 'Invalid Request').toObject(),
      };
    }

    try {
      const { method, params } = request;
      let result;

      switch (method) {
        case 'initialize':
          result = this.getInitializeResult();
          break;
        case 'tools/list':
          result = this.getTools();
          break;
        case 'tools/call':
          result = await this.callTool(params.name, params.arguments);
          break;
        default:
          throw new McpError(-32601, `Method not found: ${method}`);
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: result,
      };
    } catch (error) {
      const mcpError = (error instanceof McpError) ? error : new McpError(-32000, (error as any).message);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: mcpError.toObject(),
      };
    }
  }

  private getInitializeResult() {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true }
      },
      serverInfo: {
        name: 'mcp-email-server',
        version: '1.0.0',
      },
    };
  }

  private getTools(): { tools: Tool[] } {
    const unifiedTools: Tool[] = [
      {
        name: 'list_emails',
        description: 'List emails from a specified account. Automatically detects account type (Gmail/IMAP).',
        inputSchema: {
          type: 'object',
          properties: {
            account_name: { type: 'string', description: 'Name of the email account' },
            limit: { type: 'number', description: 'Maximum number of emails to return (default: 20)' },
            folder: { type: 'string', description: 'Folder to list emails from (default: INBOX)' },
            unread_only: { type: 'boolean', description: 'Only return unread emails' }
          },
          required: ['account_name']
        }
      },
      {
        name: 'search_emails',
        description: 'Search emails in a specified account. Automatically detects account type (Gmail/IMAP).',
        inputSchema: {
          type: 'object',
          properties: {
            account_name: { type: 'string', description: 'Name of the email account' },
            query: { type: 'string', description: 'Search query (searches subject, from, and body)' },
            limit: { type: 'number', description: 'Maximum number of emails to return (default: 20)' }
          },
          required: ['account_name', 'query']
        }
      },
      {
        name: 'get_email_detail',
        description: 'Get detailed information about a specific email from a specified account. Automatically detects account type (Gmail/IMAP).',
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
        description: 'Archive an email in a specified account. Automatically detects account type (Gmail/IMAP).',
        inputSchema: {
          type: 'object',
          properties: {
            account_name: { type: 'string', description: 'Name of the email account' },
            email_id: { type: 'string', description: 'ID of the email to archive' },
            remove_unread: { type: 'boolean', description: 'Whether to mark the email as read (default: false)' }
          },
          required: ['account_name', 'email_id']
        }
      },
      {
        name: 'send_email',
        description: 'Send an email from a specified account. Automatically detects account type (Gmail/IMAP).',
        inputSchema: {
          type: 'object',
          properties: {
            account_name: { type: 'string', description: 'Name of the email account' },
            to: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'Recipient email address(es)'
            },
            subject: { type: 'string', description: 'Email subject' },
            text: { type: 'string', description: 'Plain text content of the email' },
            html: { type: 'string', description: 'HTML content of the email' },
            cc: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'CC recipient email address(es)' },
            bcc: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'BCC recipient email address(es)' },
            replyTo: { type: 'string', description: 'Reply-To email address' },
            inReplyTo: { type: 'string', description: 'Message-ID of the message this is a reply to' },
            references: { type: 'array', items: { type: 'string' }, description: 'Message-IDs of messages this message references' },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  content: { type: 'string' },
                  contentType: { type: 'string' }
                },
                required: ['filename', 'content']
              },
              description: 'Array of attachment objects'
            }
          },
          required: ['account_name', 'to', 'subject'],
          oneOf: [
            { required: ['text'] },
            { required: ['html'] }
          ]
        }
      }
    ];

    const commonTools: Tool[] = [
      {
        name: 'list_accounts',
        description: 'List all configured email accounts.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'test_connection',
        description: 'Test the connection for a specific email account.',
        inputSchema: {
          type: 'object',
          properties: {
            account_name: {
              type: 'string',
              description: 'Name of the account to test connection for.'
            }
          },
          required: ['account_name']
        }
      },
      {
        name: 'get_account_stats',
        description: 'Get statistics about configured email accounts.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'search_all_emails',
        description: 'Search emails across all Gmail and IMAP accounts.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (e.g., "from:sender@example.com subject:report")' },
            accounts: {
              type: 'string',
              enum: ['ALL', 'GMAIL_ONLY', 'IMAP_ONLY'],
              description: 'Which accounts to search (ALL, GMAIL_ONLY, IMAP_ONLY)',
              default: 'ALL'
            },
            limit: { type: 'number', description: 'Maximum number of results to return (default: 20)', default: 20 },
            sortBy: {
              type: 'string',
              enum: ['date', 'relevance'],
              description: 'Sort results by date or relevance (default: date)',
              default: 'date'
            }
          },
          required: ['query']
        }
      }
    ];
    return {
      tools: [...unifiedTools, ...commonTools]
    };
  }

  private async callTool(toolName: string, args: any): Promise<any> {
    // ツールが存在するかどうかを最初にチェック
    const allTools = this.getTools().tools;
    const toolExists = allTools.some(tool => tool.name === toolName);
    if (!toolExists) {
      throw new McpError(-32601, `Tool not found: ${toolName}`);
    }

    let accountName: string | undefined;
    let account: any;

    // account_nameを必要としないツール
    if (!['list_accounts', 'get_account_stats', 'search_all_emails'].includes(toolName)) {
      accountName = args.account_name;
      if (!accountName) {
        throw new McpError(-32602, 'account_name is required');
      }
      account = this.accountManager.getAccount(accountName);
      if (!account) {
        throw new McpError(-32602, `Account not found: ${accountName}`);
      }
    }

    try {
      switch (toolName) {
        case 'list_emails':
          if (account.type === 'gmail') {
            return await this.gmailHandler.listEmails(accountName!, args);
          } else if (account.type === 'imap') {
            return await this.imapHandler.listEmails(accountName!, args);
          }
          break;
        case 'search_emails':
          if (account.type === 'gmail') {
            return await this.gmailHandler.searchEmails(accountName!, args.query, args.limit);
          } else if (account.type === 'imap') {
            return await this.imapHandler.searchEmails(accountName!, args.query, args.limit);
          }
          break;
        case 'get_email_detail':
          if (account.type === 'gmail') {
            return await this.gmailHandler.getEmailDetail(accountName!, args.email_id);
          } else if (account.type === 'imap') {
            return await this.imapHandler.getEmailDetail(accountName!, args.email_id);
          }
          break;
        case 'archive_email':
          if (account.type === 'gmail') {
            return await this.gmailHandler.archiveEmail(accountName!, args.email_id, args.remove_unread);
          } else if (account.type === 'imap') {
            return await this.imapHandler.archiveEmail(accountName!, args.email_id, args.remove_unread);
          }
          break;
        case 'send_email':
          if (account.type === 'gmail') {
            const result = await this.gmailHandler.sendEmail(accountName!, args);
            return { success: result.success, messageId: result.messageId, error: result.error };
          } else if (account.type === 'imap') {
            const result = await this.imapHandler.sendEmail(accountName!, args);
            return { success: result.success, messageId: result.messageId, error: result.error };
          }
          break;
        case 'list_accounts':
          return { accounts: this.accountManager.getAllAccounts().map(acc => ({ name: acc.name, type: acc.type })) };
        case 'test_connection':
          try {
            if (account.type === 'gmail') {
              // Gmail接続テスト - 軽量なメソッドを使用
              const gmailHandler = new (await import('./services/gmail.js')).GmailHandler([account]);
              await gmailHandler.testConnection(accountName!);
              return { status: 'connected', account: accountName, accountType: account.type, testResult: 'Gmail connection test successful' };
            } else if (account.type === 'imap') {
              // IMAP接続テスト - 既存のimapHandlerインスタンスを使用
              await this.imapHandler.testConnection(accountName!);
              return { status: 'connected', account: accountName, accountType: account.type, testResult: 'IMAP connection test successful' };
            } else {
              throw new Error(`Unsupported account type: ${account.type}`);
            }
          } catch (error: any) {
            return { status: 'failed', account: accountName, accountType: account.type, testResult: `Connection test failed: ${error.message}` };
          }
        case 'get_account_stats':
          const allAccounts = this.accountManager.getAllAccounts();
          const gmailCount = allAccounts.filter(acc => acc.type === 'gmail').length;
          const imapCount = allAccounts.filter(acc => acc.type === 'imap').length;
          return {
            accounts: allAccounts.map(acc => ({ name: acc.name, type: acc.type })),
            summary: {
              totalAccounts: allAccounts.length,
              connectedAccounts: allAccounts.length, // Dummy for now
              gmailAccounts: gmailCount,
              imapAccounts: imapCount,
            }
          };
        case 'search_all_emails':
          return await this._handleSearchAllEmails(args);
        default:
          throw new McpError(-32601, `Tool not found: ${toolName}`);
      }
    } catch (error) {
      throw new McpError(-32603, `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async _handleSearchAllEmails(args: any): Promise<any> {
    // 全体的なタイムアウト制御を追加
    const overallTimeout = parseInt(process.env.SEARCH_ALL_TIMEOUT_MS || '25000', 10);
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`search_all_emails timed out after ${overallTimeout}ms`));
      }, overallTimeout);
      
      try {
        const result = await this._performSearchAllEmails(args);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private async _performSearchAllEmails(args: any): Promise<any> {
    const results: any[] = [];
    const errors: string[] = [];

    // args.accountsがundefinedの場合は'ALL'として扱う
    const accountsType = args.accounts || 'ALL';

    // Gmail search (並行処理の制限)
    if (accountsType === 'ALL' || accountsType === 'GMAIL_ONLY') {
      const gmailAccounts = this.accountManager.getGmailAccounts();
      const gmailPromises = gmailAccounts.map(async (account) => {
        try {
          const emailPromise = this.gmailHandler.searchEmails(account.name, args.query, args.limit);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Individual Gmail search timeout')), 15000)
          );
          const emails = await Promise.race([emailPromise, timeoutPromise]) as EmailMessage[];
          return emails;
        } catch (error) {
          errors.push(`Gmail ${account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return [];
        }
      });
      const gmailResults = await Promise.allSettled(gmailPromises);
      gmailResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          const account = gmailAccounts[index];
          errors.push(`Gmail ${account.name}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
        }
      });
    }

    // IMAP search (並行処理の制限)
    if (accountsType === 'ALL' || accountsType === 'IMAP_ONLY') {
      const imapAccounts = this.accountManager.getImapAccounts();
      const imapPromises = imapAccounts.map(async (account) => {
        try {
          const emailPromise = this.imapHandler.searchEmails(account.name, args.query, args.limit);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Individual ImapFlow search timeout')), 15000)
          );
          const emails = await Promise.race([emailPromise, timeoutPromise]) as EmailMessage[];
          return emails;
        } catch (error) {
          errors.push(`ImapFlow ${account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return [];
        }
      });
      const imapResults = await Promise.allSettled(imapPromises);
      imapResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          const account = imapAccounts[index];
          errors.push(`ImapFlow ${account.name}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
        }
      });
    }

    // Sort results
    const sortedResults = results.sort((a, b) => {
      if (args.sortBy === 'relevance') {
        const aScore = a.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
        const bScore = b.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }).slice(0, args.limit);

    return {
      emails: sortedResults,
      totalFound: results.length,
      searchQuery: args.query,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

// run-email-server.tsから使用されるため、ここでreadlineループは不要