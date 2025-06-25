import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { MCPRequest, MCPResponse, InitializeResult, Tool, EmailMessage } from './types';
import { GmailHandler, gmailTools } from './gmail';
import { IMAPHandler, imapTools } from './imap';

dotenv.config();

export class MCPEmailServer {
  private gmailHandler: GmailHandler;
  private imapHandler: IMAPHandler;
  private encryptionKey: string;

  constructor() {
    this.gmailHandler = new GmailHandler();
    this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
    this.imapHandler = new IMAPHandler(this.encryptionKey);
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        
        case 'tools/list':
          return this.handleToolsList(request);
        
        case 'tools/call':
          return await this.handleToolsCall(request);
        
        case 'resources/list':
          return this.handleResourcesList(request);
        
        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    const result: InitializeResult = {
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
      jsonrpc: '2.0',
      id: request.id,
      result
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    const tools: Tool[] = [
      ...gmailTools,
      ...imapTools
    ];

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { tools }
    };
  }

  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    try {
      const { name, arguments: args } = request.params || {};
      
      switch (name) {
        case 'list_emails':
          return await this.handleListEmails(args, request.id);
        
        case 'search_emails':
          return await this.handleSearchEmails(args, request.id);
        
        case 'get_email_detail':
          return await this.handleGetEmailDetail(args, request.id);
        
        case 'get_unread_count':
          return await this.handleGetUnreadCount(args, request.id);
        
        case 'list_imap_emails':
          return await this.handleListImapEmails(args, request.id);
        
        case 'search_imap_emails':
          return await this.handleSearchImapEmails(args, request.id);
        
        case 'get_imap_email_detail':
          return await this.handleGetImapEmailDetail(args, request.id);
        
        case 'get_imap_unread_count':
          return await this.handleGetImapUnreadCount(args, request.id);
        
        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private handleResourcesList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { resources: [] }
    };
  }

  private async handleListEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      if (args.account_name === 'ALL') {
        const allEmails = await this.getAllGmailEmails(args);
        return this.createResponse(requestId, { emails: allEmails });
      } else {
        const emails = await this.gmailHandler.listEmails(args.account_name, args);
        return this.createResponse(requestId, { emails });
      }
    } catch (error) {
      throw error;
    }
  }

  private async handleSearchEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      if (args.account_name === 'ALL') {
        const availableAccounts = this.gmailHandler.getAvailableAccounts();
        const searchPromises = availableAccounts.map(account => 
          this.gmailHandler.searchEmails(account, args.query, args.limit || 20)
        );
        const results = await Promise.all(searchPromises);
        const allEmails = results.flat().sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ).slice(0, args.limit || 20);
        return this.createResponse(requestId, { emails: allEmails });
      } else {
        const emails = await this.gmailHandler.searchEmails(args.account_name, args.query, args.limit || 20);
        return this.createResponse(requestId, { emails });
      }
    } catch (error) {
      throw error;
    }
  }

  private async handleGetEmailDetail(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const emailDetail = await this.gmailHandler.getEmailDetail(args.account_name, args.email_id);
      return this.createResponse(requestId, { email: emailDetail });
    } catch (error) {
      throw error;
    }
  }

  private async handleGetUnreadCount(args: any, requestId: any): Promise<MCPResponse> {
    try {
      if (args.account_name === 'ALL') {
        const availableAccounts = this.gmailHandler.getAvailableAccounts();
        const countPromises = availableAccounts.map(async (account) => {
          const count = await this.gmailHandler.getUnreadCount(account, args.folder || 'INBOX');
          return { account, count };
        });
        const results = await Promise.all(countPromises);
        const totalCount = results.reduce((sum, result) => sum + result.count, 0);
        return this.createResponse(requestId, { 
          totalCount,
          accountCounts: results
        });
      } else {
        const count = await this.gmailHandler.getUnreadCount(args.account_name, args.folder || 'INBOX');
        return this.createResponse(requestId, { count });
      }
    } catch (error) {
      throw error;
    }
  }

  private async getAllGmailEmails(params: any): Promise<EmailMessage[]> {
    const availableAccounts = this.gmailHandler.getAvailableAccounts();
    const emailPromises = availableAccounts.map(account => 
      this.gmailHandler.listEmails(account, params)
    );
    const results = await Promise.all(emailPromises);
    return results.flat().sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ).slice(0, params.limit || 20);
  }

  private createResponse(id: any, result: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  private async handleListImapEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const emails = await this.imapHandler.listEmails(args.account_name, args);
      return this.createResponse(requestId, { emails });
    } catch (error) {
      throw error;
    }
  }

  private async handleSearchImapEmails(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const emails = await this.imapHandler.searchEmails(args.account_name, args.query, args.limit || 20);
      return this.createResponse(requestId, { emails });
    } catch (error) {
      throw error;
    }
  }

  private async handleGetImapEmailDetail(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const emailDetail = await this.imapHandler.getEmailDetail(args.account_name, args.email_id);
      return this.createResponse(requestId, { email: emailDetail });
    } catch (error) {
      throw error;
    }
  }

  private async handleGetImapUnreadCount(args: any, requestId: any): Promise<MCPResponse> {
    try {
      const count = await this.imapHandler.getUnreadCount(args.account_name, args.folder || 'INBOX');
      return this.createResponse(requestId, { count });
    } catch (error) {
      throw error;
    }
  }

  // Public methods for account management
  addImapAccount(accountName: string, host: string, port: number, secure: boolean, user: string, encryptedPassword: string): void {
    this.imapHandler.addAccount(accountName, { host, port, secure, user, password: encryptedPassword });
  }

  addXServerAccount(accountName: string, domain: string, username: string, encryptedPassword: string): void {
    this.imapHandler.addXServerAccount(accountName, domain, username, encryptedPassword);
  }
}

const server = new MCPEmailServer();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line: string) => {
  try {
    const request = JSON.parse(line.trim());
    const response = await server.handleRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0' as const,
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
});

process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rl.close();
  process.exit(0);
});