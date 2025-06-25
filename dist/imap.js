import * as Imap from 'node-imap';
import { decrypt } from './crypto';
export class IMAPHandler {
    constructor(encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key') {
        this.connections = new Map();
        this.encryptionKey = encryptionKey;
    }
    addAccount(accountName, config) {
        this.connections.set(accountName, { config });
    }
    async getConnection(accountName) {
        const connection = this.connections.get(accountName);
        if (!connection) {
            throw new Error(`IMAP account ${accountName} not found`);
        }
        try {
            const decryptedPassword = decrypt(connection.config.password, this.encryptionKey);
            const imapConfig = {
                ...connection.config,
                password: decryptedPassword,
                authTimeout: 30000,
                connTimeout: 60000,
                tls: connection.config.secure,
                tlsOptions: { rejectUnauthorized: false }
            };
            const imap = new Imap(imapConfig);
            return new Promise((resolve, reject) => {
                imap.once('ready', () => {
                    resolve(imap);
                });
                imap.once('error', (err) => {
                    reject(new Error(`IMAP connection failed: ${err.message}`));
                });
                imap.once('end', () => {
                    // Connection ended
                });
                imap.connect();
            });
        }
        catch (error) {
            throw new Error(`Failed to decrypt password or connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async openBox(imap, boxName = 'INBOX') {
        return new Promise((resolve, reject) => {
            imap.openBox(boxName, true, (err) => {
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
        const imap = await this.getConnection(accountName);
        try {
            await this.openBox(imap, params.folder || 'INBOX');
            const searchCriteria = params.unread_only ? ['UNSEEN'] : ['ALL'];
            const limit = params.limit || 20;
            return new Promise((resolve, reject) => {
                imap.search(searchCriteria, (err, results) => {
                    if (err) {
                        reject(new Error(`Search failed: ${err.message}`));
                        return;
                    }
                    if (!results || results.length === 0) {
                        resolve([]);
                        return;
                    }
                    const messages = [];
                    const recentResults = results.slice(-limit);
                    const f = imap.fetch(recentResults, {
                        bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
                        struct: true
                    });
                    f.on('message', (msg, seqno) => {
                        let headers = '';
                        let hasAttachments = false;
                        let messageAttrs = null;
                        msg.on('body', (stream, _info) => {
                            let buffer = '';
                            stream.on('data', (chunk) => {
                                buffer += chunk.toString('ascii');
                            });
                            stream.once('end', () => {
                                headers = buffer;
                            });
                        });
                        msg.once('attributes', (attrs) => {
                            messageAttrs = attrs;
                            hasAttachments = this.hasAttachments(attrs.struct);
                        });
                        msg.once('end', () => {
                            const parsedHeaders = this.parseHeaders(headers);
                            const emailId = results[recentResults.indexOf(seqno)] || seqno;
                            messages.push({
                                id: emailId.toString(),
                                accountName,
                                accountType: 'imap',
                                subject: parsedHeaders.subject || '(no subject)',
                                from: parsedHeaders.from || '',
                                to: parsedHeaders.to ? [parsedHeaders.to] : [],
                                date: parsedHeaders.date || new Date().toISOString(),
                                snippet: `${parsedHeaders.subject || '(no subject)'} - ${parsedHeaders.from || ''}`,
                                isUnread: messageAttrs ? !messageAttrs.flags.includes('\\Seen') : true,
                                hasAttachments
                            });
                        });
                    });
                    f.once('error', (err) => {
                        reject(new Error(`Fetch failed: ${err.message}`));
                    });
                    f.once('end', () => {
                        resolve(messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    });
                });
            });
        }
        finally {
            imap.end();
        }
    }
    async searchEmails(accountName, query, limit = 20) {
        const imap = await this.getConnection(accountName);
        try {
            await this.openBox(imap);
            const searchCriteria = [
                'OR',
                ['SUBJECT', query],
                ['FROM', query],
                ['BODY', query]
            ];
            return new Promise((resolve, reject) => {
                imap.search(searchCriteria, (err, results) => {
                    if (err) {
                        reject(new Error(`Search failed: ${err.message}`));
                        return;
                    }
                    if (!results || results.length === 0) {
                        resolve([]);
                        return;
                    }
                    const messages = [];
                    const limitedResults = results.slice(-limit);
                    const f = imap.fetch(limitedResults, {
                        bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
                        struct: true
                    });
                    f.on('message', (msg, seqno) => {
                        let headers = '';
                        let hasAttachments = false;
                        let messageAttrs = null;
                        msg.on('body', (stream, _info) => {
                            let buffer = '';
                            stream.on('data', (chunk) => {
                                buffer += chunk.toString('ascii');
                            });
                            stream.once('end', () => {
                                headers = buffer;
                            });
                        });
                        msg.once('attributes', (attrs) => {
                            messageAttrs = attrs;
                            hasAttachments = this.hasAttachments(attrs.struct);
                        });
                        msg.once('end', () => {
                            const parsedHeaders = this.parseHeaders(headers);
                            const emailId = results[limitedResults.indexOf(seqno)] || seqno;
                            messages.push({
                                id: emailId.toString(),
                                accountName,
                                accountType: 'imap',
                                subject: parsedHeaders.subject || '(no subject)',
                                from: parsedHeaders.from || '',
                                to: parsedHeaders.to ? [parsedHeaders.to] : [],
                                date: parsedHeaders.date || new Date().toISOString(),
                                snippet: `${parsedHeaders.subject || '(no subject)'} - ${parsedHeaders.from || ''}`,
                                isUnread: messageAttrs ? !messageAttrs.flags.includes('\\Seen') : true,
                                hasAttachments
                            });
                        });
                    });
                    f.once('error', (err) => {
                        reject(new Error(`Search fetch failed: ${err.message}`));
                    });
                    f.once('end', () => {
                        resolve(messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    });
                });
            });
        }
        finally {
            imap.end();
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
                        hasAttachments = this.hasAttachments(attrs.struct);
                        attachments = this.extractAttachments(attrs.struct);
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
        const imap = await this.getConnection(accountName);
        try {
            await this.openBox(imap, folder);
            return new Promise((resolve, reject) => {
                imap.search(['UNSEEN'], (err, results) => {
                    if (err) {
                        reject(new Error(`Unread count search failed: ${err.message}`));
                    }
                    else {
                        resolve(results ? results.length : 0);
                    }
                });
            });
        }
        finally {
            imap.end();
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
        if (!Array.isArray(struct))
            return false;
        for (const part of struct) {
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
        const extractFromPart = (part) => {
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
    getAvailableAccounts() {
        return Array.from(this.connections.keys());
    }
    // Special method for xserver domain support
    addXServerAccount(accountName, domain, username, encryptedPassword) {
        const config = {
            host: `${domain}`, // xserver uses the domain directly as host
            port: 993,
            secure: true,
            user: username,
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