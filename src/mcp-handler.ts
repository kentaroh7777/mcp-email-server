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
          return this.createResponse(mcpRequest.id, initializeResult);

        case 'tools/list':
          return this.createResponse(mcpRequest.id, {
            tools: [
              // Gmail tools
              {
                name: 'gmail_list_emails',
                description: 'List emails from Gmail account',
                inputSchema: {
                  type: 'object',
                  properties: {
                    account_name: { type: 'string', description: 'Gmail account name' },
                    limit: { type: 'number', description: 'Maximum number of emails to return', default: 20 },
                    folder: { type: 'string', description: 'Folder to search in', default: 'INBOX' },
                    unread_only: { type: 'boolean', description: 'Only return unread emails', default: false }
                  },
                  required: ['account_name']
                }
              },
              {
                name: 'gmail_search_emails',
                description: 'Search emails in Gmail account',
                inputSchema: {
                  type: 'object',
                  properties: {
                    account_name: { type: 'string', description: 'Gmail account name' },
                    query: { type: 'string', description: 'Search query' },
                    limit: { type: 'number', description: 'Maximum number of results', default: 20 }
                  },
                  required: ['account_name', 'query']
                }
              },
              {
                name: 'gmail_get_email_detail',
                description: 'Get detailed information about a specific email',
                inputSchema: {
                  type: 'object',
                  properties: {
                    account_name: { type: 'string', description: 'Gmail account name' },
                    email_id: { type: 'string', description: 'Email ID' }
                  },
                  required: ['account_name', 'email_id']
                }
              },
              {
                name: 'gmail_get_unread_count',
                description: 'Get count of unread emails',
                inputSchema: {
                  type: 'object',
                  properties: {
                    account_name: { type: 'string', description: 'Gmail account name' },
                    folder: { type: 'string', description: 'Folder to check', default: 'INBOX' }
                  },
                  required: ['account_name']
                }
              },
              // IMAP tools
              {
                name: 'imap_list_emails',
                description: 'List emails from IMAP account',
                inputSchema: {
                  type: 'object',
                  properties: {
                    account_name: { type: 'string', description: 'IMAP account name' },
                    limit: { type: 'number', description: 'Maximum number of emails to return', default: 20 },
                    folder: { type: 'string', description: 'Folder to search in', default: 'INBOX' },
                    unread_only: { type: 'boolean', description: 'Only return unread emails', default: false }
                  },
                  required: ['account_name']
                }
              },
              {
                name: 'imap_search_emails',
                description: 'Search emails in IMAP account',
                inputSchema: {
                  type: 'object',
                  properties: {
                    account_name: { type: 'string', description: 'IMAP account name' },
                    query: { type: 'string', description: 'Search query' },
                    limit: { type: 'number', description: 'Maximum number of results', default: 20 }
                  },
                  required: ['account_name', 'query']
                }
              },
              {
                name: 'imap_get_unread_count',
                description: 'Get count of unread emails from IMAP account',
                inputSchema: {
                  type: 'object',
                  properties: {
                    account_name: { type: 'string', description: 'IMAP account name' },
                    folder: { type: 'string', description: 'Folder to check', default: 'INBOX' }
                  },
                  required: ['account_name']
                }
              },
              // General tools
              {
                name: 'list_accounts',
                description: 'List all configured email accounts',
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
                    account_name: { type: 'string', description: 'Account name to test' }
                  },
                  required: ['account_name']
                }
              },
              // EXACT COPY OF TODOIST_GET_TASKS FOR TESTING
              {
                name: 'todoist_get_tasks2',
                description: 'Get tasks from Todoist',
                inputSchema: {
                  type: 'object',
                  properties: {
                    project_id: { type: 'string', description: 'Project ID to filter tasks' },
                    filter: { type: 'string', description: 'Filter expression' },
                    limit: { type: 'number', description: 'Maximum number of tasks to return' }
                  }
                }
              }
            ]
          });

        case 'tools/call':
          const { name, arguments: args } = mcpRequest.params || {};
          return await this.handleToolCall(name, args, mcpRequest.id);

        case 'resources/list':
          return this.createResponse(mcpRequest.id, {
            resources: [
              {
                uri: 'email://accounts',
                name: 'Email Accounts',
                description: 'Access to configured email accounts',
                mimeType: 'application/json'
              }
            ]
          });

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
        // Gmail tools
        case 'gmail_list_emails':
          const gmailEmails = await this.gmailHandler.listEmails(args.account_name, args);
          return this.createResponse(requestId, { emails: gmailEmails });

        case 'gmail_search_emails':
          const searchResults = await this.gmailHandler.searchEmails(args.account_name, args.query, args.limit || 20);
          return this.createResponse(requestId, { emails: searchResults });

        case 'gmail_get_email_detail':
          const emailDetail = await this.gmailHandler.getEmailDetail(args.account_name, args.email_id);
          return this.createResponse(requestId, { email: emailDetail });

        case 'gmail_get_unread_count':
          const unreadCount = await this.gmailHandler.getUnreadCount(args.account_name, args.folder || 'INBOX');
          return this.createResponse(requestId, { count: unreadCount });

        // IMAP tools
        case 'imap_list_emails':
          const imapEmails = await this.imapHandler.listEmails(args.account_name, args);
          return this.createResponse(requestId, { emails: imapEmails });

        case 'imap_search_emails':
          const imapSearchResults = await this.imapHandler.searchEmails(args.account_name, args.query, args.limit || 20);
          return this.createResponse(requestId, { emails: imapSearchResults });

        case 'imap_get_unread_count':
          const imapUnreadCount = await this.imapHandler.getUnreadCount(args.account_name, args.folder || 'INBOX');
          return this.createResponse(requestId, { count: imapUnreadCount });

        // General tools
        case 'list_accounts':
          const gmailAccounts = this.gmailHandler.getAvailableAccounts().map(name => ({ name, type: 'gmail' }));
          const imapAccounts = this.imapHandler.getAvailableAccounts().map(name => ({ name, type: 'imap' }));
          return this.createResponse(requestId, { accounts: [...gmailAccounts, ...imapAccounts] });

        case 'test_connection':
          const { account_name } = args;
          
          // Try Gmail first
          const gmailAccountsList = this.gmailHandler.getAvailableAccounts();
          if (gmailAccountsList.includes(account_name)) {
            try {
              const count = await this.gmailHandler.getUnreadCount(account_name);
              return this.createResponse(requestId, {
                account: account_name,
                type: 'gmail',
                status: 'connected',
                unreadCount: count
              });
            } catch (error) {
              return this.createResponse(requestId, {
                account: account_name,
                type: 'gmail',
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          
          // Try IMAP
          const imapAccountsList = this.imapHandler.getAvailableAccounts();
          if (imapAccountsList.includes(account_name)) {
            try {
              const count = await this.imapHandler.getUnreadCount(account_name);
              return this.createResponse(requestId, {
                account: account_name,
                type: 'imap',
                status: 'connected',
                unreadCount: count
              });
            } catch (error) {
              return this.createResponse(requestId, {
                account: account_name,
                type: 'imap',
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          
          return this.createErrorResponse(requestId, {
            code: -32602,
            message: `Account not found: ${account_name}`
          });

        // EXACT COPY OF TODOIST_GET_TASKS FOR TESTING
        case 'todoist_get_tasks2':
          // Mock tasks data exactly like Todoist would return
          const mockTasks = [
            {
              "id": "2995104339",
              "order": 1,
              "content": "Buy Milk",
              "description": "",
              "project_id": "2203306141",
              "section_id": null,
              "completed": false,
              "label_ids": [],
              "parent_id": null,
              "priority": 1,
              "comment_count": 0,
              "creator_id": "2671355",
              "created_at": "2019-12-11T22:36:50.000000Z",
              "due": {
                "date": "2019-12-11",
                "string": "today",
                "lang": "en",
                "is_recurring": false
              },
              "url": "https://todoist.com/showTask?id=2995104339"
            }
          ];
          
          // Return EXACTLY the same format as mcp-todoist
          return this.createResponse(requestId, {
            content: [
              {
                type: 'text',
                text: JSON.stringify(mockTasks, null, 2)
              }
            ]
          });

        default:
          return this.createErrorResponse(requestId, {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          });
      }
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {
          toolName,
          args: JSON.stringify(args),
          errorType: error instanceof Error ? error.constructor.name : typeof error
        }
      });
    }
  }

  // Public methods for account management
  addImapAccount(accountName: string, host: string, port: number, secure: boolean, user: string, encryptedPassword: string): void {
    this.imapHandler.addAccount(accountName, { host, port, secure, user, password: encryptedPassword });
  }

  addXServerAccount(accountName: string, server: string, domain: string, username: string, encryptedPassword: string): void {
    this.imapHandler.addXServerAccount(accountName, server, domain, username, encryptedPassword);
  }

  validateRequest(request: any): ValidationResult {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
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

    if (!('id' in request)) {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
    }

    if (!request.method) {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
    }

    return {
      isValid: true
    };
  }

  createResponse(id: any, result: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  createErrorResponse(id: any, error: MCPError): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: id === null ? 0 : id,
      error
    };
  }
} 