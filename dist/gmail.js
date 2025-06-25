import { google } from 'googleapis';
export class GmailHandler {
    constructor() {
        this.configs = new Map();
        this.loadGmailConfigs();
    }
    loadGmailConfigs() {
        const accountNames = ['MAIN', 'WORK'];
        for (const accountName of accountNames) {
            const clientId = process.env[`EMAIL_GMAIL_${accountName}_CLIENT_ID`];
            const clientSecret = process.env[`EMAIL_GMAIL_${accountName}_CLIENT_SECRET`];
            const refreshToken = process.env[`EMAIL_GMAIL_${accountName}_REFRESH_TOKEN`];
            const displayName = process.env[`EMAIL_GMAIL_${accountName}_DISPLAY_NAME`];
            if (clientId && clientSecret && refreshToken) {
                this.configs.set(accountName, {
                    clientId,
                    clientSecret,
                    refreshToken,
                    displayName: displayName || accountName
                });
            }
        }
    }
    async authenticate(accountName) {
        const config = this.configs.get(accountName);
        if (!config) {
            throw new Error(`Gmail account ${accountName} not configured`);
        }
        const oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, 'http://localhost');
        oauth2Client.setCredentials({
            refresh_token: config.refreshToken
        });
        oauth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                // Token refresh handled automatically
            }
        });
        return google.gmail({ version: 'v1', auth: oauth2Client });
    }
    async listEmails(accountName, params) {
        try {
            const gmail = await this.authenticate(accountName);
            let query = '';
            if (params.unread_only)
                query += 'is:unread ';
            if (params.folder && params.folder !== 'INBOX') {
                query += `label:${params.folder} `;
            }
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: query.trim() || undefined,
                maxResults: params.limit || 20
            });
            const messages = response.data.messages || [];
            const emailPromises = messages.map(async (message) => {
                const detail = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'To', 'Date']
                });
                return this.formatEmailMessage(detail.data, accountName);
            });
            return await Promise.all(emailPromises);
        }
        catch (error) {
            throw new Error(`Failed to list emails for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async searchEmails(accountName, query, limit) {
        try {
            const gmail = await this.authenticate(accountName);
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: limit
            });
            const messages = response.data.messages || [];
            const emailPromises = messages.map(async (message) => {
                const detail = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'To', 'Date']
                });
                return this.formatEmailMessage(detail.data, accountName);
            });
            return await Promise.all(emailPromises);
        }
        catch (error) {
            throw new Error(`Failed to search emails for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getEmailDetail(accountName, emailId) {
        try {
            const gmail = await this.authenticate(accountName);
            const response = await gmail.users.messages.get({
                userId: 'me',
                id: emailId,
                format: 'full'
            });
            return this.formatEmailDetail(response.data, accountName);
        }
        catch (error) {
            throw new Error(`Failed to get email detail for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getUnreadCount(accountName, folder = 'INBOX') {
        try {
            const gmail = await this.authenticate(accountName);
            let query = 'is:unread';
            if (folder !== 'INBOX') {
                query += ` label:${folder}`;
            }
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: query
            });
            return response.data.resultSizeEstimate || 0;
        }
        catch (error) {
            throw new Error(`Failed to get unread count for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getAvailableAccounts() {
        return Array.from(this.configs.keys());
    }
    formatEmailMessage(message, accountName) {
        const headers = message.payload?.headers || [];
        const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        return {
            id: message.id,
            accountName,
            accountType: 'gmail',
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: [getHeader('To')].filter(Boolean),
            date: getHeader('Date'),
            snippet: message.snippet || '',
            isUnread: message.labelIds?.includes('UNREAD') || false,
            hasAttachments: message.payload?.parts?.some((part) => part.filename && part.filename.length > 0) || false
        };
    }
    formatEmailDetail(message, accountName) {
        const baseMessage = this.formatEmailMessage(message, accountName);
        const body = this.extractEmailBody(message.payload);
        const attachments = this.extractAttachments(message.payload);
        return {
            ...baseMessage,
            body,
            attachments
        };
    }
    extractEmailBody(payload) {
        if (payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
        if (payload.parts) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
                    if (part.body?.data) {
                        return Buffer.from(part.body.data, 'base64').toString('utf-8');
                    }
                }
            }
        }
        return '';
    }
    extractAttachments(payload) {
        const attachments = [];
        const extractFromParts = (parts) => {
            for (const part of parts) {
                if (part.filename && part.filename.length > 0) {
                    attachments.push({
                        filename: part.filename,
                        contentType: part.mimeType,
                        size: part.body?.size || 0
                    });
                }
                if (part.parts) {
                    extractFromParts(part.parts);
                }
            }
        };
        if (payload.parts) {
            extractFromParts(payload.parts);
        }
        return attachments;
    }
}
export const gmailTools = [
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
                limit: { type: 'number', default: 20, maximum: 100 },
                folder: { type: 'string', default: 'INBOX' },
                unread_only: { type: 'boolean', default: false }
            }
        }
    },
    {
        name: 'search_emails',
        description: 'Search emails in Gmail account',
        inputSchema: {
            type: 'object',
            properties: {
                account_name: {
                    type: 'string',
                    enum: ['MAIN', 'WORK', 'ALL'],
                    default: 'ALL'
                },
                query: { type: 'string' },
                limit: { type: 'number', default: 20, maximum: 100 }
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
                account_name: {
                    type: 'string',
                    enum: ['MAIN', 'WORK']
                },
                email_id: { type: 'string' }
            },
            required: ['account_name', 'email_id']
        }
    },
    {
        name: 'get_unread_count',
        description: 'Get count of unread emails in a folder',
        inputSchema: {
            type: 'object',
            properties: {
                account_name: {
                    type: 'string',
                    enum: ['MAIN', 'WORK', 'ALL'],
                    default: 'ALL'
                },
                folder: { type: 'string', default: 'INBOX' }
            }
        }
    }
];
//# sourceMappingURL=gmail.js.map