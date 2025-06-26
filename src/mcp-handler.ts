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
          // Standard MCP response (not mcp-todoist format)
          return {
            jsonrpc: '2.0' as const,
            id: mcpRequest.id,
            result: initializeResult
          };

        case 'tools/list':
          // EXACT COPY OF OLD ARCHITECTURE TOOLS
          const unifiedTools = [
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
              description: 'Get statistics for all configured accounts',
              inputSchema: {
                type: 'object',
                properties: {},
                required: []
              }
            }
          ];

          const gmailTools = [
            {
              name: 'list_emails',
              description: 'Get email list from Gmail account',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: {
                    type: 'string',
                    enum: ['MAIN', 'WORK', 'ALL'],
                    default: 'ALL'
                  },
                  folder: { type: 'string', default: 'INBOX' },
                  limit: { type: 'number', default: 20, maximum: 100 },
                  unread_only: { type: 'boolean', default: false }
                }
              }
            },
            {
              name: 'search_emails',
              description: 'Search emails in Gmail account with optional date range',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: {
                    type: 'string',
                    enum: ['MAIN', 'WORK', 'ALL'],
                    default: 'ALL'
                  },
                  query: { type: 'string' },
                  limit: { type: 'number', default: 20, maximum: 100 },
                  date_after: { type: 'string', description: 'Search emails after this date/time (formats: YYYY/MM/DD, YYYY/MM/DD HH:mm:ss, YYYY-MM-DDTHH:mm:ss[Z|±HH:mm], or Unix timestamp). Timezone: TZ env var > EMAIL_DEFAULT_TIMEZONE env var > system timezone > Asia/Tokyo' },
                  date_before: { type: 'string', description: 'Search emails before this date/time (formats: YYYY/MM/DD, YYYY/MM/DD HH:mm:ss, YYYY-MM-DDTHH:mm:ss[Z|±HH:mm], or Unix timestamp). Timezone: TZ env var > EMAIL_DEFAULT_TIMEZONE env var > system timezone > Asia/Tokyo' }
                },
                required: ['query']
              }
            },
            {
              name: 'get_email_detail',
              description: 'Get detailed information about a specific email',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', enum: ['MAIN', 'WORK'] },
                  email_id: { type: 'string' }
                },
                required: ['account_name', 'email_id']
              }
            },
            // {
            //   name: 'get_unread_count',
            //   description: 'Get count of unread emails in a folder - DEPRECATED: 実際の未読数と異なるため非公開',
            //   inputSchema: {
            //     type: 'object',
            //     properties: {
            //       account_name: {
            //         type: 'string',
            //         enum: ['MAIN', 'WORK', 'ALL'],
            //         default: 'ALL'
            //       },
            //       folder: { type: 'string', default: 'INBOX' }
            //     }
            //   }
            // }
          ];

          const imapTools = [
            {
              name: 'list_imap_emails',
              description: 'List emails from IMAP account',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the IMAP account' },
                  folder: { type: 'string', description: 'Folder to list emails from (default: INBOX)' },
                  limit: { type: 'number', description: 'Maximum number of emails to return (default: 20)' },
                  unread_only: { type: 'boolean', description: 'Only return unread emails' }
                },
                required: ['account_name']
              }
            },
            {
              name: 'search_imap_emails',
              description: 'Search emails in IMAP account',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the IMAP account' },
                  query: { type: 'string', description: 'Search query (searches subject, from, and body)' },
                  limit: { type: 'number', description: 'Maximum number of emails to return (default: 20)' }
                },
                required: ['account_name', 'query']
              }
            },
            {
              name: 'get_imap_email_detail',
              description: 'Get detailed information about a specific email',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the IMAP account' },
                  email_id: { type: 'string', description: 'ID of the email to get details for' }
                },
                required: ['account_name', 'email_id']
              }
            },
            {
              name: 'get_imap_unread_count',
              description: 'Get count of unread emails in IMAP account',
              inputSchema: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', description: 'Name of the IMAP account' },
                  folder: { type: 'string', description: 'Folder to count unread emails in (default: INBOX)' }
                },
                required: ['account_name']
              }
            }
          ];

          // Standard MCP response (not mcp-todoist format)
          return {
            jsonrpc: '2.0' as const,
            id: mcpRequest.id,
            result: {
              tools: [...unifiedTools, ...gmailTools, ...imapTools]
            }
          };

        case 'tools/call':
          const { name, arguments: args } = mcpRequest.params || {};
          return await this.handleToolCall(name, args, mcpRequest.id);

        case 'resources/list':
          // Standard MCP response (not mcp-todoist format)
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
        // Unified tools (EXACT COPY FROM OLD ARCHITECTURE)
        case 'list_accounts':
          return await this.handleListAccounts(args, requestId);
        
        case 'test_connection':
          return await this.handleTestConnection(args, requestId);
        
        case 'search_all_emails':
          return await this.handleSearchAllEmails(args, requestId);
        
        case 'get_account_stats':
          return await this.handleGetAccountStats(args, requestId);
        
        // Gmail tools
        case 'list_emails':
          return await this.handleListEmails(args, requestId);
        
        case 'search_emails':
          return await this.handleSearchEmails(args, requestId);
        
        case 'get_email_detail':
          return await this.handleGetEmailDetail(args, requestId);
        
        case 'get_unread_count':
          return await this.handleGetUnreadCount(args, requestId);
        
        // IMAP tools
        case 'list_imap_emails':
          return await this.handleListImapEmails(args, requestId);
        
        case 'search_imap_emails':
          return await this.handleSearchImapEmails(args, requestId);
        
        case 'get_imap_email_detail':
          return await this.handleGetImapEmailDetail(args, requestId);
        
        case 'get_imap_unread_count':
          return await this.handleGetImapUnreadCount(args, requestId);

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

  // Handler methods (EXACT COPY FROM OLD ARCHITECTURE)
  private async handleListEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const actualAccountName = this.mapGmailAccountName(args.account_name);
      
      // 改善されたGmail実装を直接使用（適切なタイムアウト設定済み）
      const emails = await this.gmailHandler.listEmails(actualAccountName, args);
      
      return this.createResponse(requestId, { 
        emails,
        source: 'gmail-api',
        account: actualAccountName,
        count: emails.length
      });
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Gmail list failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async handleSearchEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const maxLimit = parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '200');
      const effectiveLimit = Math.min(args.limit || 20, maxLimit);
      
      if (args.account_name === 'ALL') {
        const availableAccounts = this.gmailHandler.getAvailableAccounts();
        const searchPromises = availableAccounts.map(account => 
          this.gmailHandler.searchEmails(account, args.query, effectiveLimit, args.date_after, args.date_before)
        );
        const results = await Promise.all(searchPromises);
        const allEmails = results.flat().sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ).slice(0, effectiveLimit);
        return this.createResponse(requestId, { emails: allEmails });
      } else {
        // Map MAIN/WORK to actual account names
        const actualAccountName = this.mapGmailAccountName(args.account_name);
        const emails = await this.gmailHandler.searchEmails(actualAccountName, args.query, effectiveLimit, args.date_after, args.date_before);
        return this.createResponse(requestId, { emails });
      }
    } catch (error) {
      throw error;
    }
  }

  private async handleGetEmailDetail(args: any, requestId: any): Promise<MCPResponse> {
    try {
      // Map MAIN/WORK to actual account names
      const actualAccountName = this.mapGmailAccountName(args.account_name);
      const emailDetail = await this.gmailHandler.getEmailDetail(actualAccountName, args.email_id);
      return this.createResponse(requestId, { email: emailDetail });
    } catch (error) {
      throw error;
    }
  }

  private mapGmailAccountName(accountName: string): string {
    // Map legacy account names to actual Gmail account names
    const availableAccounts = this.gmailHandler.getAvailableAccounts();
    
    if (accountName === 'MAIN' && availableAccounts.length > 0) {
      return availableAccounts[0]; // Use first available account as MAIN
    }
    
    if (accountName === 'WORK' && availableAccounts.length > 1) {
      return availableAccounts[1]; // Use second available account as WORK
    }
    
    // If it's already a real account name, return as is
    if (availableAccounts.includes(accountName)) {
      return accountName;
    }
    
    // Default to first available account
    return availableAccounts[0] || accountName;
  }

  private async handleGetUnreadCount(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const actualAccountName = this.mapGmailAccountName(args.account_name);
      
      // 改善されたGmail未読数取得実装を使用
      const count = await this.gmailHandler.getUnreadCount(actualAccountName, args.folder || 'INBOX');
      
      return this.createResponse(requestId, { 
        count,
        accountName: actualAccountName,
        folder: args.folder || 'INBOX',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Gmail unread count failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  // private async getAllGmailEmails(params: any): Promise<any[]> {
  //   const availableAccounts = this.gmailHandler.getAvailableAccounts();
  //   const emailPromises = availableAccounts.map(account => 
  //     this.gmailHandler.listEmails(account, params)
  //   );
  //   const results = await Promise.all(emailPromises);
  //   return results.flat().sort((a, b) => 
  //     new Date(b.date).getTime() - new Date(a.date).getTime()
  //   ).slice(0, params.limit || 20);
  // }

  private async handleListImapEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const emails = await this.imapHandler.listEmails(args.account_name, args);
      return this.createResponse(requestId, { emails });
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `IMAP list emails failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async handleSearchImapEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const maxLimit = parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '200');
      const effectiveLimit = Math.min(args.limit || 20, maxLimit);
      
      // 改善されたIMAP検索実装を使用
      const emails = await this.imapHandler.searchEmails(
        args.account_name, 
        args.query, 
        effectiveLimit
      );

      return this.createResponse(requestId, { 
        emails,
        source: 'imap',
        account: args.account_name,
        query: args.query,
        count: emails.length
      });
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `IMAP search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async handleGetImapEmailDetail(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const emailDetail = await this.imapHandler.getEmailDetail(args.account_name, args.email_id);
      return this.createResponse(requestId, { email: emailDetail });
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `IMAP get email detail failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async handleGetImapUnreadCount(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const count = await this.imapHandler.getUnreadCount(args.account_name, args.folder || 'INBOX');
      return this.createResponse(requestId, { 
        count,
        accountName: args.account_name,
        folder: args.folder || 'INBOX',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `IMAP get unread count failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  // Unified methods implementation
  private async handleListAccounts(_args: any, requestId: any): Promise<MCPResponse> {
    try {
      const accounts: any[] = [];
      
      // Gmail accounts
      const gmailAccounts = this.gmailHandler.getAvailableAccounts();
      for (const account of gmailAccounts) {
        try {
          await this.gmailHandler.getUnreadCount(account);
          accounts.push({
            name: account,
            type: 'gmail',
            status: 'connected',
            lastChecked: new Date().toISOString()
          });
        } catch (error) {
          accounts.push({
            name: account,
            type: 'gmail',
            status: 'error',
            lastChecked: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // IMAP accounts
      const imapAccounts = this.imapHandler.getAvailableAccounts();
      for (const account of imapAccounts) {
        try {
          await this.imapHandler.getUnreadCount(account);
          accounts.push({
            name: account,
            type: 'imap',
            status: 'connected',
            lastChecked: new Date().toISOString()
          });
        } catch (error) {
          accounts.push({
            name: account,
            type: 'imap',
            status: 'error',
            lastChecked: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return this.createResponse(requestId, { accounts });
    } catch (error) {
      throw error;
    }
  }

  private async handleTestConnection(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const { account_name } = args;
      
      if (!account_name) {
        return this.createErrorResponse(requestId, {
          code: -32602,
          message: 'Invalid params: account_name is required'
        });
      }
      
      // Check if it's a Gmail account
      const gmailAccounts = this.gmailHandler.getAvailableAccounts();
      if (gmailAccounts.includes(account_name)) {
        try {
          const count = await this.gmailHandler.getUnreadCount(account_name);
          return this.createResponse(requestId, {
            account: account_name,
            type: 'gmail',
            status: 'connected',
            testResult: `Successfully connected. Unread count: ${count}`,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return this.createResponse(requestId, {
            account: account_name,
            type: 'gmail',
            status: 'error',
            testResult: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Check if it's an IMAP account
      const imapAccounts = this.imapHandler.getAvailableAccounts();
      if (imapAccounts.includes(account_name)) {
        try {
          const count = await this.imapHandler.getUnreadCount(account_name);
          return this.createResponse(requestId, {
            account: account_name,
            type: 'imap',
            status: 'connected',
            testResult: `Successfully connected. Unread count: ${count}`,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return this.createResponse(requestId, {
            account: account_name,
            type: 'imap',
            status: 'error',
            testResult: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      return this.createErrorResponse(requestId, {
        code: -32602,
        message: `Account not found: ${account_name}`
      });
    } catch (error) {
      throw error;
    }
  }

  private async handleSearchAllEmails(args: any, requestId: any): Promise<MCPResponse> {
    const startTime = Date.now();
    
    // 環境変数で設定可能な全体タイムアウト（デフォルト25秒）
    const searchTimeout = parseInt(process.env.SEARCH_ALL_TIMEOUT_MS || '25000');
    
    try {
      return await Promise.race([
        this.performSearchAllEmails(args),
        new Promise<MCPResponse>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`統合検索がタイムアウトしました（${searchTimeout}ms）`));
          }, searchTimeout);
        })
      ]).then(result => {
        if ('emails' in result) {
          return this.createResponse(requestId, {
            ...result,
            responseTime: Date.now() - startTime
          });
        }
        return result;
      });
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `統合検索失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async performSearchAllEmails(args: any): Promise<any> {
    const results: any[] = [];
    const errors: string[] = [];
    
    // 環境変数からタイムアウト設定を取得
    const searchTimeout = parseInt(process.env.SEARCH_ALL_TIMEOUT_MS || '25000');
    
    // Gmail search
    if (args.accounts === 'ALL' || args.accounts === 'GMAIL_ONLY') {
      const gmailAccounts = this.gmailHandler.getAvailableAccounts();
      const gmailPromises = gmailAccounts.map(async (account) => {
        try {
          const maxLimit = parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '200');
          const effectiveLimit = Math.min(args.limit || 20, maxLimit);
          const totalAccounts = gmailAccounts.length + this.imapHandler.getAvailableAccounts().length;
          const limitPerAccount = Math.max(1, Math.floor(effectiveLimit / totalAccounts));
          
          // タイムアウト付きでGmail検索を実行
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Gmail search timeout for ${account}`)), searchTimeout)
          );
          
          const searchPromise = this.gmailHandler.searchEmails(account, args.query, limitPerAccount);
          const emails = await Promise.race([searchPromise, timeoutPromise]);
          
          return emails as any[];
        } catch (error) {
          errors.push(`Gmail ${account}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return [];
        }
      });
      
      // Promise.allSettledを使用してより堅牢に処理
      const gmailResults = await Promise.allSettled(gmailPromises);
      gmailResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          const account = gmailAccounts[index];
          errors.push(`Gmail ${account}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
        }
      });
    }
    
    // IMAP search
    if (args.accounts === 'ALL' || args.accounts === 'IMAP_ONLY') {
      const imapAccounts = this.imapHandler.getAvailableAccounts();
      const imapPromises = imapAccounts.map(async (account) => {
        try {
          const maxLimit = parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '200');
          const effectiveLimit = Math.min(args.limit || 20, maxLimit);
          const totalAccounts = this.gmailHandler.getAvailableAccounts().length + imapAccounts.length;
          const limitPerAccount = Math.max(1, Math.floor(effectiveLimit / totalAccounts));
          
          // タイムアウト付きでIMAP検索を実行
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`IMAP search timeout for ${account}`)), searchTimeout)
          );
          
          const searchPromise = this.imapHandler.searchEmails(account, args.query, limitPerAccount);
          const emails = await Promise.race([searchPromise, timeoutPromise]);
          
          return emails as any[];
        } catch (error) {
          errors.push(`IMAP ${account}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return [];
        }
      });
      
      // Promise.allSettledを使用してより堅牢に処理
      const imapResults = await Promise.allSettled(imapPromises);
      imapResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          const account = imapAccounts[index];
          errors.push(`IMAP ${account}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
        }
      });
    }
      
    // Sort results
    const sortedResults = results.sort((a, b) => {
      if (args.sortBy === 'relevance') {
        // Simple relevance score (title match priority)
        const aScore = a.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
        const bScore = b.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }).slice(0, Math.min(args.limit || 20, parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '200')));
    
    return {
      emails: sortedResults,
      totalFound: results.length,
      searchQuery: args.query,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async handleGetAccountStats(_args: any, requestId: any): Promise<MCPResponse> {
    try {
      const stats: any = {
        gmail: {},
        imap: {},
        summary: {
          totalAccounts: 0,
          connectedAccounts: 0
        }
      };
      
      // Gmail stats (connection status only)
      const gmailAccounts = this.gmailHandler.getAvailableAccounts();
      for (const account of gmailAccounts) {
        try {
          // Just test connection, don't get unread count (unreliable for Gmail)
          await this.gmailHandler.authenticate(account);
          stats.gmail[account] = {
            status: 'connected',
            lastChecked: new Date().toISOString()
          };
          stats.summary.connectedAccounts++;
        } catch (error) {
          stats.gmail[account] = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            lastChecked: new Date().toISOString()
          };
        }
        stats.summary.totalAccounts++;
      }
      
      // IMAP stats (with unread count - this is reliable)
      const imapAccounts = this.imapHandler.getAvailableAccounts();
      for (const account of imapAccounts) {
        try {
          const unreadCount = await this.imapHandler.getUnreadCount(account);
          stats.imap[account] = {
            status: 'connected',
            unreadCount,
            lastChecked: new Date().toISOString()
          };
          stats.summary.connectedAccounts++;
        } catch (error) {
          stats.imap[account] = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            lastChecked: new Date().toISOString()
          };
        }
        stats.summary.totalAccounts++;
      }
      
      return this.createResponse(requestId, stats);
    } catch (error) {
      throw error;
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
    // Convert all responses to MCP-compatible format like mcp-todoist
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      }
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