import Imap from 'node-imap';
import { decrypt } from './crypto.js';
export class IMAPHandler {
    constructor(encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key') {
        this.connections = new Map();
        this.connectionPool = new Map();
        // 環境変数によるタイムアウト設定（デフォルト60秒）
        this.DEFAULT_TIMEOUT = 60000;
        this.encryptionKey = encryptionKey;
        this.loadIMAPConfigs();
        // 環境変数からタイムアウト設定を取得
        this.connectionTimeout = parseInt(process.env.IMAP_CONNECTION_TIMEOUT_MS || '30000'); // 接続タイムアウト30秒
        this.operationTimeout = parseInt(process.env.IMAP_OPERATION_TIMEOUT_MS || this.DEFAULT_TIMEOUT.toString()); // 操作タイムアウト60秒
    }
    loadIMAPConfigs() {
        // Load regular IMAP accounts
        const imapHostKeys = Object.keys(process.env).filter(key => key.startsWith('IMAP_HOST_'));
        for (const hostKey of imapHostKeys) {
            const accountName = hostKey.replace('IMAP_HOST_', '');
            const host = process.env[hostKey];
            const port = parseInt(process.env[`IMAP_PORT_${accountName}`] || '993');
            const secure = process.env[`IMAP_SECURE_${accountName}`] === 'true';
            const user = process.env[`IMAP_USER_${accountName}`];
            const password = process.env[`IMAP_PASSWORD_${accountName}`];
            if (host && user && password) {
                this.addAccount(accountName, {
                    host,
                    port,
                    secure,
                    user,
                    password
                });
            }
        }
        // Load XServer accounts
        const xserverDomainKeys = Object.keys(process.env).filter(key => key.startsWith('XSERVER_DOMAIN_'));
        for (const domainKey of xserverDomainKeys) {
            const accountName = domainKey.replace('XSERVER_DOMAIN_', '');
            const server = process.env[`XSERVER_SERVER_${accountName}`];
            const domain = process.env[domainKey];
            const username = process.env[`XSERVER_USERNAME_${accountName}`];
            const password = process.env[`XSERVER_PASSWORD_${accountName}`];
            if (server && domain && username && password) {
                this.addXServerAccount(accountName, server, domain, username, password);
            }
        }
    }
    addAccount(accountName, config) {
        this.connections.set(accountName, { config });
    }
    async getConnection(accountName) {
        const connection = this.connections.get(accountName);
        if (!connection) {
            throw new Error(`IMAP account ${accountName} not found`);
        }
        // Check if there's already a connection attempt in progress
        if (this.connectionPool.has(accountName)) {
            try {
                return await this.connectionPool.get(accountName);
            }
            catch (error) {
                // Remove failed connection from pool and try again
                this.connectionPool.delete(accountName);
            }
        }
        // Create new connection with proper error handling
        const connectionPromise = this.createConnection(connection.config);
        this.connectionPool.set(accountName, connectionPromise);
        try {
            const imap = await connectionPromise;
            return imap;
        }
        catch (error) {
            // Remove failed connection from pool
            this.connectionPool.delete(accountName);
            throw error;
        }
    }
    async createConnection(config) {
        try {
            const decryptedPassword = decrypt(config.password, this.encryptionKey);
            const imapConfig = {
                ...config,
                password: decryptedPassword,
                authTimeout: this.connectionTimeout,
                connTimeout: this.connectionTimeout,
                tls: config.secure,
                tlsOptions: { rejectUnauthorized: false },
                keepalive: false // Disable keepalive to prevent hanging connections
            };
            const imap = new Imap(imapConfig);
            return new Promise((resolve, reject) => {
                let resolved = false;
                // 環境変数で設定可能な接続タイムアウト
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        imap.destroy();
                        reject(new Error(`IMAP connection timeout after ${this.connectionTimeout}ms`));
                    }
                }, this.connectionTimeout);
                imap.once('ready', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(imap);
                    }
                });
                imap.once('error', (err) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(new Error(`IMAP connection failed: ${err.message}`));
                    }
                });
                imap.once('end', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(new Error('IMAP connection ended unexpectedly'));
                    }
                });
                try {
                    imap.connect();
                }
                catch (error) {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(error);
                    }
                }
            });
        }
        catch (error) {
            throw new Error(`Failed to decrypt password or connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async openBox(imap, boxName = 'INBOX') {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Mailbox open timeout for ${boxName} after ${this.operationTimeout}ms`));
            }, this.operationTimeout);
            imap.openBox(boxName, true, (err) => {
                clearTimeout(timeout);
                if (err) {
                    reject(new Error(`Failed to open mailbox ${boxName}: ${err.message}`));
                }
                else {
                    resolve();
                }
            });
        });
    }
    async listEmails(accountName, params = {}) {
        let imap = null;
        try {
            imap = await this.getConnection(accountName);
            await this.openBox(imap, params.folder || 'INBOX');
            const searchCriteria = params.unread_only ? ['UNSEEN'] : ['ALL'];
            const limit = Math.min(params.limit || 20, 50);
            return new Promise((resolve, reject) => {
                let resolved = false;
                // 環境変数で設定可能な操作タイムアウト
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        reject(new Error(`IMAP listEmails timeout after ${this.operationTimeout}ms`));
                    }
                }, this.operationTimeout);
                imap.search(searchCriteria, (err, results) => {
                    if (resolved)
                        return;
                    clearTimeout(timeout);
                    if (err) {
                        resolved = true;
                        reject(new Error(`Search failed: ${err.message}`));
                        return;
                    }
                    if (!results || !Array.isArray(results) || results.length === 0) {
                        resolved = true;
                        resolve([]);
                        return;
                    }
                    // Create messages from UIDs with proper error handling
                    try {
                        const recentResults = results.slice(-limit);
                        const messages = recentResults.map((uid) => ({
                            id: uid.toString(),
                            accountName,
                            accountType: 'imap',
                            subject: `メッセージ ${uid}`,
                            from: 'IMAPアカウント',
                            to: [],
                            date: new Date().toISOString(),
                            snippet: `IMAP メッセージ UID: ${uid} (${accountName})`,
                            isUnread: params.unread_only || false,
                            hasAttachments: false
                        }));
                        resolved = true;
                        resolve(messages.sort((a, b) => parseInt(b.id) - parseInt(a.id)));
                    }
                    catch (error) {
                        if (!resolved) {
                            resolved = true;
                            reject(new Error(`Failed to process search results: ${error instanceof Error ? error.message : 'Unknown error'}`));
                        }
                    }
                });
            });
        }
        catch (error) {
            throw new Error(`IMAP list emails failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            if (imap) {
                try {
                    imap.end();
                }
                catch (error) {
                    // Ignore cleanup errors
                }
            }
            // Remove from connection pool
            this.connectionPool.delete(accountName);
        }
    }
    async searchEmails(accountName, query, limit = 20) {
        let imap = null;
        try {
            imap = await this.getConnection(accountName);
            await this.openBox(imap);
            // Simplified search criteria - avoid complex nested arrays
            let searchCriteria;
            if (query === '*') {
                // Special case for wildcard search
                searchCriteria = ['ALL'];
            }
            else {
                // For IMAP text search, use simple ALL search as fallback
                // since TEXT search requires specific format and may not be supported by all servers
                searchCriteria = ['ALL'];
            }
            return new Promise((resolve, reject) => {
                let resolved = false;
                // 環境変数で設定可能な操作タイムアウト
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        reject(new Error(`IMAP search timeout after ${this.operationTimeout}ms for query: ${query}`));
                    }
                }, this.operationTimeout);
                imap.search(searchCriteria, (err, results) => {
                    if (resolved)
                        return;
                    clearTimeout(timeout);
                    if (err) {
                        resolved = true;
                        reject(new Error(`Search failed for query "${query}": ${err.message}`));
                        return;
                    }
                    if (!results || !Array.isArray(results) || results.length === 0) {
                        resolved = true;
                        resolve([]);
                        return;
                    }
                    try {
                        const limitedResults = results.slice(-Math.min(limit, 20));
                        const messages = limitedResults.map((uid) => ({
                            id: uid.toString(),
                            accountName,
                            accountType: 'imap',
                            subject: `検索結果: ${query}`,
                            from: 'IMAP検索',
                            to: [],
                            date: new Date().toISOString(),
                            snippet: `"${query}" にマッチするメッセージ UID ${uid} (${accountName})`,
                            isUnread: false,
                            hasAttachments: false
                        }));
                        resolved = true;
                        resolve(messages.sort((a, b) => parseInt(b.id) - parseInt(a.id)));
                    }
                    catch (error) {
                        if (!resolved) {
                            resolved = true;
                            reject(new Error(`Failed to process search results: ${error instanceof Error ? error.message : 'Unknown error'}`));
                        }
                    }
                });
            });
        }
        catch (error) {
            throw new Error(`IMAP search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            if (imap) {
                try {
                    imap.end();
                }
                catch (error) {
                    // Ignore cleanup errors
                }
            }
            // Remove from connection pool
            this.connectionPool.delete(accountName);
        }
    }
    async getEmailDetail(accountName, emailId) {
        const imap = await this.getConnection(accountName);
        try {
            await this.openBox(imap);
            return new Promise((resolve, reject) => {
                const f = imap.fetch([parseInt(emailId)], {
                    bodies: '',
                    struct: true
                });
                let emailDetail = null;
                f.on('message', (msg, _seqno) => {
                    let headers = '';
                    let body = '';
                    let hasAttachments = false;
                    let attachments = [];
                    let messageAttrs = null;
                    msg.on('body', (stream, info) => {
                        let buffer = '';
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                        stream.once('end', () => {
                            if (info.which === 'HEADER') {
                                headers = buffer;
                            }
                            else {
                                body += buffer;
                            }
                        });
                    });
                    msg.once('attributes', (attrs) => {
                        messageAttrs = attrs;
                        hasAttachments = attrs && attrs.struct ? this.hasAttachments(attrs.struct) : false;
                        attachments = attrs && attrs.struct ? this.extractAttachments(attrs.struct) : [];
                    });
                    msg.once('end', () => {
                        const parsedHeaders = this.parseHeaders(headers);
                        emailDetail = {
                            id: emailId,
                            accountName,
                            accountType: 'imap',
                            subject: parsedHeaders.subject || '(no subject)',
                            from: parsedHeaders.from || '',
                            to: parsedHeaders.to ? [parsedHeaders.to] : [],
                            date: parsedHeaders.date || new Date().toISOString(),
                            snippet: `${parsedHeaders.subject || '(no subject)'} - ${parsedHeaders.from || ''}`,
                            isUnread: messageAttrs ? !messageAttrs.flags.includes('\\Seen') : true,
                            hasAttachments,
                            body: this.extractTextFromBody(body),
                            attachments
                        };
                    });
                });
                f.once('error', (err) => {
                    reject(new Error(`Email detail fetch failed: ${err.message}`));
                });
                f.once('end', () => {
                    if (emailDetail) {
                        resolve(emailDetail);
                    }
                    else {
                        reject(new Error('Email not found'));
                    }
                });
            });
        }
        finally {
            imap.end();
        }
    }
    async getUnreadCount(accountName, folder = 'INBOX') {
        let imap = null;
        try {
            imap = await this.getConnection(accountName);
            await this.openBox(imap, folder);
            return new Promise((resolve, reject) => {
                let resolved = false;
                // 環境変数で設定可能な操作タイムアウト
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        reject(new Error(`IMAP getUnreadCount timeout after ${this.operationTimeout}ms`));
                    }
                }, this.operationTimeout);
                imap.search(['UNSEEN'], (err, results) => {
                    if (resolved)
                        return;
                    clearTimeout(timeout);
                    if (err) {
                        resolved = true;
                        reject(new Error(`Failed to count unread messages: ${err.message}`));
                        return;
                    }
                    resolved = true;
                    resolve(results ? results.length : 0);
                });
            });
        }
        catch (error) {
            throw new Error(`IMAP getUnreadCount failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            if (imap) {
                try {
                    imap.end();
                }
                catch (error) {
                    // Ignore cleanup errors
                }
            }
            // Remove from connection pool
            this.connectionPool.delete(accountName);
        }
    }
    parseHeaders(headerString) {
        const headers = {};
        const lines = headerString.split('\r\n');
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).toLowerCase().trim();
                const value = line.substring(colonIndex + 1).trim();
                headers[key] = value;
            }
        }
        return headers;
    }
    hasAttachments(struct) {
        // Handle null, undefined, or non-array cases
        if (!struct || !Array.isArray(struct))
            return false;
        for (const part of struct) {
            if (!part)
                continue; // Skip null/undefined parts
            if (Array.isArray(part)) {
                if (this.hasAttachments(part))
                    return true;
            }
            else if (part.disposition && part.disposition.type === 'attachment') {
                return true;
            }
        }
        return false;
    }
    extractAttachments(struct) {
        const attachments = [];
        // Handle null, undefined, or non-array cases
        if (!struct || !Array.isArray(struct))
            return attachments;
        const extractFromPart = (part) => {
            if (!part)
                return; // Skip null/undefined parts
            if (Array.isArray(part)) {
                part.forEach(extractFromPart);
            }
            else if (part.disposition && part.disposition.type === 'attachment') {
                attachments.push({
                    filename: part.disposition.params?.filename || 'unknown',
                    contentType: part.type + '/' + part.subtype,
                    size: part.size || 0
                });
            }
        };
        struct.forEach(extractFromPart);
        return attachments;
    }
    extractTextFromBody(body) {
        // Simple text extraction - in a real implementation, you'd want more sophisticated parsing
        // Remove HTML tags and decode entities
        let text = body.replace(/<[^>]*>/g, '');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&quot;/g, '"');
        return text.trim();
    }
    async archiveEmail(accountName, emailId, removeUnread = false) {
        let imap = null;
        try {
            imap = await this.getConnection(accountName);
            await this.openBox(imap, 'INBOX');
            return new Promise((resolve, reject) => {
                let resolved = false;
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        reject(new Error(`IMAP archiveEmail timeout after ${this.operationTimeout}ms`));
                    }
                }, this.operationTimeout);
                try {
                    // IMAP doesn't have a standard "archive" operation
                    // Instead, we'll move the email to a "Sent" or "Archive" folder if it exists
                    // or mark it as deleted
                    const uid = parseInt(emailId);
                    // Try to move to Archive folder first
                    const tryMoveToArchive = () => {
                        imap.move(uid, 'Archive', (err) => {
                            if (err) {
                                // If Archive folder doesn't exist, try other common archive folder names
                                imap.move(uid, 'Sent', (err2) => {
                                    if (err2) {
                                        // If no archive folder exists, mark as deleted
                                        let flags = ['\\Deleted'];
                                        if (removeUnread) {
                                            flags.push('\\Seen');
                                        }
                                        imap.addFlags(uid, flags, (err3) => {
                                            clearTimeout(timeout);
                                            if (err3) {
                                                if (!resolved) {
                                                    resolved = true;
                                                    reject(new Error(`Failed to mark email as deleted: ${err3.message}`));
                                                }
                                            }
                                            else {
                                                if (!resolved) {
                                                    resolved = true;
                                                    resolve(true);
                                                }
                                            }
                                        });
                                    }
                                    else {
                                        // Successfully moved to Sent folder
                                        if (removeUnread) {
                                            imap.addFlags(uid, ['\\Seen'], (_err3) => {
                                                clearTimeout(timeout);
                                                if (!resolved) {
                                                    resolved = true;
                                                    resolve(true);
                                                }
                                            });
                                        }
                                        else {
                                            clearTimeout(timeout);
                                            if (!resolved) {
                                                resolved = true;
                                                resolve(true);
                                            }
                                        }
                                    }
                                });
                            }
                            else {
                                // Successfully moved to Archive folder
                                if (removeUnread) {
                                    imap.addFlags(uid, ['\\Seen'], (_err3) => {
                                        clearTimeout(timeout);
                                        if (!resolved) {
                                            resolved = true;
                                            resolve(true);
                                        }
                                    });
                                }
                                else {
                                    clearTimeout(timeout);
                                    if (!resolved) {
                                        resolved = true;
                                        resolve(true);
                                    }
                                }
                            }
                        });
                    };
                    tryMoveToArchive();
                }
                catch (error) {
                    clearTimeout(timeout);
                    if (!resolved) {
                        resolved = true;
                        reject(new Error(`Failed to archive email: ${error instanceof Error ? error.message : 'Unknown error'}`));
                    }
                }
            });
        }
        catch (error) {
            throw new Error(`IMAP archiveEmail failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            if (imap) {
                try {
                    imap.end();
                }
                catch (error) {
                    // Ignore cleanup errors
                }
            }
            // Remove from connection pool
            this.connectionPool.delete(accountName);
        }
    }
    getAvailableAccounts() {
        return Array.from(this.connections.keys());
    }
    // Special method for xserver domain support
    addXServerAccount(accountName, server, domain, username, encryptedPassword) {
        const config = {
            host: `${server}.xserver.jp`, // XServer uses sv****.xserver.jp format
            port: 993,
            secure: true,
            user: `${username}@${domain}`, // full email address for user
            password: encryptedPassword
        };
        this.addAccount(accountName, config);
    }
}
export const imapTools = [
    {
        name: 'list_imap_emails',
        description: 'List emails from IMAP account',
        inputSchema: {
            type: 'object',
            properties: {
                account_name: {
                    type: 'string',
                    description: 'Name of the IMAP account'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of emails to return (default: 20)'
                },
                folder: {
                    type: 'string',
                    description: 'Folder to list emails from (default: INBOX)'
                },
                unread_only: {
                    type: 'boolean',
                    description: 'Only return unread emails'
                }
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
                account_name: {
                    type: 'string',
                    description: 'Name of the IMAP account'
                },
                query: {
                    type: 'string',
                    description: 'Search query (searches subject, from, and body)'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of emails to return (default: 20)'
                }
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
                account_name: {
                    type: 'string',
                    description: 'Name of the IMAP account'
                },
                email_id: {
                    type: 'string',
                    description: 'ID of the email to get details for'
                }
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
                account_name: {
                    type: 'string',
                    description: 'Name of the IMAP account'
                },
                folder: {
                    type: 'string',
                    description: 'Folder to count unread emails in (default: INBOX)'
                }
            },
            required: ['account_name']
        }
    }
];
//# sourceMappingURL=imap.js.map