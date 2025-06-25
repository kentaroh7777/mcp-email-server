import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { GmailHandler, gmailTools } from './gmail';
import { IMAPHandler, imapTools } from './imap';
dotenv.config();
export class MCPEmailServer {
    constructor() {
        this.gmailHandler = new GmailHandler();
        this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
        this.imapHandler = new IMAPHandler(this.encryptionKey);
    }
    async handleRequest(request) {
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
        }
        catch (error) {
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
    handleInitialize(request) {
        const result = {
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
    handleToolsList(request) {
        const tools = [
            ...gmailTools,
            ...imapTools
        ];
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: { tools }
        };
    }
    async handleToolsCall(request) {
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
        }
        catch (error) {
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
    handleResourcesList(request) {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: { resources: [] }
        };
    }
    async handleListEmails(args, requestId) {
        try {
            if (args.account_name === 'ALL') {
                const allEmails = await this.getAllGmailEmails(args);
                return this.createResponse(requestId, { emails: allEmails });
            }
            else {
                const emails = await this.gmailHandler.listEmails(args.account_name, args);
                return this.createResponse(requestId, { emails });
            }
        }
        catch (error) {
            throw error;
        }
    }
    async handleSearchEmails(args, requestId) {
        try {
            if (args.account_name === 'ALL') {
                const availableAccounts = this.gmailHandler.getAvailableAccounts();
                const searchPromises = availableAccounts.map(account => this.gmailHandler.searchEmails(account, args.query, args.limit || 20));
                const results = await Promise.all(searchPromises);
                const allEmails = results.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, args.limit || 20);
                return this.createResponse(requestId, { emails: allEmails });
            }
            else {
                const emails = await this.gmailHandler.searchEmails(args.account_name, args.query, args.limit || 20);
                return this.createResponse(requestId, { emails });
            }
        }
        catch (error) {
            throw error;
        }
    }
    async handleGetEmailDetail(args, requestId) {
        try {
            const emailDetail = await this.gmailHandler.getEmailDetail(args.account_name, args.email_id);
            return this.createResponse(requestId, { email: emailDetail });
        }
        catch (error) {
            throw error;
        }
    }
    async handleGetUnreadCount(args, requestId) {
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
            }
            else {
                const count = await this.gmailHandler.getUnreadCount(args.account_name, args.folder || 'INBOX');
                return this.createResponse(requestId, { count });
            }
        }
        catch (error) {
            throw error;
        }
    }
    async getAllGmailEmails(params) {
        const availableAccounts = this.gmailHandler.getAvailableAccounts();
        const emailPromises = availableAccounts.map(account => this.gmailHandler.listEmails(account, params));
        const results = await Promise.all(emailPromises);
        return results.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, params.limit || 20);
    }
    createResponse(id, result) {
        return {
            jsonrpc: '2.0',
            id,
            result
        };
    }
    async handleListImapEmails(args, requestId) {
        try {
            const emails = await this.imapHandler.listEmails(args.account_name, args);
            return this.createResponse(requestId, { emails });
        }
        catch (error) {
            throw error;
        }
    }
    async handleSearchImapEmails(args, requestId) {
        try {
            const emails = await this.imapHandler.searchEmails(args.account_name, args.query, args.limit || 20);
            return this.createResponse(requestId, { emails });
        }
        catch (error) {
            throw error;
        }
    }
    async handleGetImapEmailDetail(args, requestId) {
        try {
            const emailDetail = await this.imapHandler.getEmailDetail(args.account_name, args.email_id);
            return this.createResponse(requestId, { email: emailDetail });
        }
        catch (error) {
            throw error;
        }
    }
    async handleGetImapUnreadCount(args, requestId) {
        try {
            const count = await this.imapHandler.getUnreadCount(args.account_name, args.folder || 'INBOX');
            return this.createResponse(requestId, { count });
        }
        catch (error) {
            throw error;
        }
    }
    // Public methods for account management
    addImapAccount(accountName, host, port, secure, user, encryptedPassword) {
        this.imapHandler.addAccount(accountName, { host, port, secure, user, password: encryptedPassword });
    }
    addXServerAccount(accountName, domain, username, encryptedPassword) {
        this.imapHandler.addXServerAccount(accountName, domain, username, encryptedPassword);
    }
}
const server = new MCPEmailServer();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});
rl.on('line', async (line) => {
    try {
        const request = JSON.parse(line.trim());
        const response = await server.handleRequest(request);
        console.log(JSON.stringify(response));
    }
    catch (error) {
        const errorResponse = {
            jsonrpc: '2.0',
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
//# sourceMappingURL=index.js.map