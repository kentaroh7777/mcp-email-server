import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { GmailHandler, gmailTools } from './gmail.js';
import { IMAPHandler, imapTools } from './imap.js';
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
                        account_name: {
                            type: 'string',
                            description: 'Name of the account to test'
                        }
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
                        query: {
                            type: 'string',
                            description: 'Search query'
                        },
                        accounts: {
                            type: 'string',
                            enum: ['ALL', 'GMAIL_ONLY', 'IMAP_ONLY'],
                            description: 'Which accounts to search',
                            default: 'ALL'
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results',
                            default: 20
                        },
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
        const tools = [
            ...unifiedTools,
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
                // Unified tools
                case 'list_accounts':
                    return await this.handleListAccounts(args, request.id);
                case 'test_connection':
                    return await this.handleTestConnection(args, request.id);
                case 'search_all_emails':
                    return await this.handleSearchAllEmails(args, request.id);
                case 'get_account_stats':
                    return await this.handleGetAccountStats(args, request.id);
                // Gmail tools
                case 'list_emails':
                    return await this.handleListEmails(args, request.id);
                case 'search_emails':
                    return await this.handleSearchEmails(args, request.id);
                case 'get_email_detail':
                    return await this.handleGetEmailDetail(args, request.id);
                case 'get_unread_count':
                    return await this.handleGetUnreadCount(args, request.id);
                // IMAP tools
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
    addXServerAccount(accountName, server, domain, username, encryptedPassword) {
        this.imapHandler.addXServerAccount(accountName, server, domain, username, encryptedPassword);
    }
    // Unified methods implementation
    async handleListAccounts(_args, requestId) {
        try {
            const accounts = [];
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
                }
                catch (error) {
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
                }
                catch (error) {
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
        }
        catch (error) {
            throw error;
        }
    }
    async handleTestConnection(args, requestId) {
        try {
            const { account_name } = args;
            if (!account_name) {
                return {
                    jsonrpc: '2.0',
                    id: requestId,
                    error: {
                        code: -32602,
                        message: 'Invalid params: account_name is required'
                    }
                };
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
                }
                catch (error) {
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
                }
                catch (error) {
                    return this.createResponse(requestId, {
                        account: account_name,
                        type: 'imap',
                        status: 'error',
                        testResult: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            return this.createResponse(requestId, {
                account: account_name,
                status: 'not_found',
                testResult: 'Account not found in configuration',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            throw error;
        }
    }
    async handleSearchAllEmails(args, requestId) {
        const startTime = Date.now();
        try {
            const results = [];
            const errors = [];
            // Gmail search
            if (args.accounts === 'ALL' || args.accounts === 'GMAIL_ONLY') {
                const gmailAccounts = this.gmailHandler.getAvailableAccounts();
                const gmailPromises = gmailAccounts.map(async (account) => {
                    try {
                        const emails = await this.gmailHandler.searchEmails(account, args.query, Math.floor((args.limit || 20) / (gmailAccounts.length + this.imapHandler.getAvailableAccounts().length)));
                        return emails;
                    }
                    catch (error) {
                        errors.push(`Gmail ${account}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        return [];
                    }
                });
                const gmailResults = await Promise.all(gmailPromises);
                results.push(...gmailResults.flat());
            }
            // IMAP search
            if (args.accounts === 'ALL' || args.accounts === 'IMAP_ONLY') {
                const imapAccounts = this.imapHandler.getAvailableAccounts();
                const imapPromises = imapAccounts.map(async (account) => {
                    try {
                        const emails = await this.imapHandler.searchEmails(account, args.query, Math.floor((args.limit || 20) / (this.gmailHandler.getAvailableAccounts().length + imapAccounts.length)));
                        return emails;
                    }
                    catch (error) {
                        errors.push(`IMAP ${account}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        return [];
                    }
                });
                const imapResults = await Promise.all(imapPromises);
                results.push(...imapResults.flat());
            }
            // Sort results
            const sortedResults = results.sort((a, b) => {
                if (args.sortBy === 'relevance') {
                    // Simple relevance score (title match priority)
                    const aScore = a.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
                    const bScore = b.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
                    if (aScore !== bScore)
                        return bScore - aScore;
                }
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            }).slice(0, args.limit || 20);
            return this.createResponse(requestId, {
                emails: sortedResults,
                totalFound: results.length,
                searchQuery: args.query,
                responseTime: Date.now() - startTime,
                errors: errors.length > 0 ? errors : undefined
            });
        }
        catch (error) {
            throw error;
        }
    }
    async handleGetAccountStats(_args, requestId) {
        try {
            const stats = {
                gmail: {},
                imap: {},
                summary: {
                    totalAccounts: 0,
                    connectedAccounts: 0,
                    totalUnreadEmails: 0
                }
            };
            // Gmail stats
            const gmailAccounts = this.gmailHandler.getAvailableAccounts();
            for (const account of gmailAccounts) {
                try {
                    const unreadCount = await this.gmailHandler.getUnreadCount(account);
                    stats.gmail[account] = {
                        status: 'connected',
                        unreadCount,
                        lastChecked: new Date().toISOString()
                    };
                    stats.summary.connectedAccounts++;
                    stats.summary.totalUnreadEmails += unreadCount;
                }
                catch (error) {
                    stats.gmail[account] = {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        lastChecked: new Date().toISOString()
                    };
                }
                stats.summary.totalAccounts++;
            }
            // IMAP stats
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
                    stats.summary.totalUnreadEmails += unreadCount;
                }
                catch (error) {
                    stats.imap[account] = {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        lastChecked: new Date().toISOString()
                    };
                }
                stats.summary.totalAccounts++;
            }
            return this.createResponse(requestId, stats);
        }
        catch (error) {
            throw error;
        }
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