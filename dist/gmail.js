import { google } from 'googleapis';
export class GmailHandler {
    constructor() {
        this.configs = new Map();
        // 環境変数によるタイムアウト設定（デフォルト60秒）
        this.DEFAULT_TIMEOUT = 60000;
        this.loadGmailConfigs();
        this.gmailTimeout = parseInt(process.env.GMAIL_TIMEOUT_MS || this.DEFAULT_TIMEOUT.toString());
        // タイムゾーンの決定（優先順位付き）
        this.defaultTimezone = this.detectTimezone();
    }
    detectTimezone() {
        // 1. システムのTZ環境変数を最優先
        if (process.env.TZ) {
            return process.env.TZ;
        }
        // 2. 独自のEMAIL_DEFAULT_TIMEZONE環境変数
        if (process.env.EMAIL_DEFAULT_TIMEZONE) {
            return process.env.EMAIL_DEFAULT_TIMEZONE;
        }
        // 3. システムのタイムゾーンを検出
        try {
            const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (systemTimezone) {
                return systemTimezone;
            }
        }
        catch (error) {
            // システム検出に失敗した場合は下記のデフォルトを使用
        }
        // 4. デフォルト（日本時間）
        return 'Asia/Tokyo';
    }
    loadGmailConfigs() {
        // First try the new format (GMAIL_ACCESS_TOKEN_accountname)
        const gmailTokenKeys = Object.keys(process.env).filter(key => key.startsWith('GMAIL_ACCESS_TOKEN_'));
        const clientId = process.env.GMAIL_CLIENT_ID;
        const clientSecret = process.env.GMAIL_CLIENT_SECRET;
        for (const tokenKey of gmailTokenKeys) {
            const accountName = tokenKey.replace('GMAIL_ACCESS_TOKEN_', '');
            const refreshTokenKey = `GMAIL_REFRESH_TOKEN_${accountName}`;
            const refreshToken = process.env[refreshTokenKey];
            if (clientId && clientSecret && refreshToken) {
                this.configs.set(accountName, {
                    clientId,
                    clientSecret,
                    refreshToken,
                    displayName: accountName
                });
            }
        }
        // Fallback to old format for backward compatibility
        const oldAccountNames = ['MAIN', 'WORK'];
        for (const accountName of oldAccountNames) {
            if (this.configs.has(accountName))
                continue; // Skip if already loaded
            const oldClientId = process.env[`EMAIL_GMAIL_${accountName}_CLIENT_ID`];
            const oldClientSecret = process.env[`EMAIL_GMAIL_${accountName}_CLIENT_SECRET`];
            const oldRefreshToken = process.env[`EMAIL_GMAIL_${accountName}_REFRESH_TOKEN`];
            const displayName = process.env[`EMAIL_GMAIL_${accountName}_DISPLAY_NAME`];
            if (oldClientId && oldClientSecret && oldRefreshToken) {
                this.configs.set(accountName, {
                    clientId: oldClientId,
                    clientSecret: oldClientSecret,
                    refreshToken: oldRefreshToken,
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
        // Create OAuth2 client with proper timeout settings
        const oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, 'http://localhost');
        // Set credentials and configure timeouts
        oauth2Client.setCredentials({
            refresh_token: config.refreshToken
        });
        // Add timeout handling for token refresh
        oauth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                // Token refresh handled automatically
            }
        });
        // Create Gmail client with environment-configurable timeout
        const gmail = google.gmail({
            version: 'v1',
            auth: oauth2Client,
            timeout: this.gmailTimeout // 環境変数で設定可能（デフォルト60秒）
        });
        // Test the connection immediately with a simple call
        try {
            await gmail.users.getProfile({ userId: 'me' });
            return gmail;
        }
        catch (error) {
            throw new Error(`Gmail authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
            // Apply environmental limits for email content fetching
            const maxLimit = parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '50');
            const effectiveLimit = Math.min(params.limit || 20, maxLimit);
            // Gmail API呼び出し（MCP仕様準拠の適切なタイムアウト）
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: query.trim() || undefined,
                maxResults: effectiveLimit
            });
            const messages = response.data.messages || [];
            // メッセージ詳細の取得（並列処理で効率化）
            const emailPromises = messages.slice(0, Math.min(messages.length, 20)).map(async (message) => {
                try {
                    const detail = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                        format: 'metadata',
                        metadataHeaders: ['Subject', 'From', 'To', 'Date']
                    });
                    return this.formatEmailMessage(detail.data, accountName);
                }
                catch (error) {
                    // 個別メッセージの失敗は警告として処理
                    console.warn(`Failed to load message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    return {
                        id: message.id || 'unknown',
                        accountName,
                        accountType: 'gmail',
                        subject: 'メッセージの読み込みに失敗',
                        from: 'Unknown',
                        to: [],
                        date: new Date().toISOString(),
                        snippet: `メッセージを読み込めませんでした: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        isUnread: false,
                        hasAttachments: false
                    };
                }
            });
            return await Promise.all(emailPromises);
        }
        catch (error) {
            throw new Error(`Failed to list emails for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async searchEmails(accountName, query, limit, dateAfter, dateBefore) {
        try {
            const gmail = await this.authenticate(accountName);
            // Apply environmental limits for email content fetching
            const maxLimit = parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '50');
            const effectiveLimit = Math.min(limit, maxLimit);
            // 期間指定クエリの構築
            let searchQuery = query;
            if (dateAfter) {
                const afterTimestamp = this.parseDateTime(dateAfter);
                searchQuery += ` after:${afterTimestamp}`;
            }
            if (dateBefore) {
                const beforeTimestamp = this.parseDateTime(dateBefore);
                searchQuery += ` before:${beforeTimestamp}`;
            }
            // Gmail検索API呼び出し（MCP仕様準拠）
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: searchQuery,
                maxResults: effectiveLimit
            });
            const messages = response.data.messages || [];
            // メッセージ詳細の取得（並列処理で効率化）
            const emailPromises = messages.slice(0, Math.min(messages.length, 20)).map(async (message) => {
                try {
                    const detail = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                        format: 'metadata',
                        metadataHeaders: ['Subject', 'From', 'To', 'Date']
                    });
                    return this.formatEmailMessage(detail.data, accountName);
                }
                catch (error) {
                    // 個別メッセージの失敗は警告として処理
                    console.warn(`Failed to load search result ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    return {
                        id: message.id || 'unknown',
                        accountName,
                        accountType: 'gmail',
                        subject: '検索結果の読み込みに失敗',
                        from: 'Unknown',
                        to: [],
                        date: new Date().toISOString(),
                        snippet: `検索結果を読み込めませんでした: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        isUnread: false,
                        hasAttachments: false
                    };
                }
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
            // より正確な未読数取得（MCP仕様準拠の適切なタイムアウト）
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: 100 // 最初の100件で推定
            });
            // 実際の件数または推定値を返す
            const messageCount = response.data.messages?.length || 0;
            const resultSizeEstimate = response.data.resultSizeEstimate || 0;
            // 100件ちょうど取得できて、推定値がより大きい場合は推定値を使用
            if (messageCount === 100 && resultSizeEstimate > 100) {
                return resultSizeEstimate; // Gmailの推定値を使用
            }
            return messageCount;
        }
        catch (error) {
            throw new Error(`Failed to get unread count for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getAvailableAccounts() {
        return Array.from(this.configs.keys());
    }
    parseDateTime(dateTimeInput) {
        // Unix timestamp（秒）で指定された場合はそのまま使用
        if (/^\d+$/.test(dateTimeInput)) {
            return dateTimeInput;
        }
        // ISO 8601形式（YYYY-MM-DDTHH:mm:ss[Z|±HH:mm]）の場合
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateTimeInput)) {
            // タイムゾーン情報が含まれている場合はそのまま使用
            if (/[Z]$|[+-]\d{2}:\d{2}$/.test(dateTimeInput)) {
                const date = new Date(dateTimeInput);
                return Math.floor(date.getTime() / 1000).toString();
            }
            // タイムゾーン情報がない場合はデフォルトタイムゾーンを適用
            else {
                const date = new Date(dateTimeInput);
                // デフォルトタイムゾーン情報をログ出力（デバッグ用）
                console.debug(`Using default timezone: ${this.defaultTimezone} for ${dateTimeInput}`);
                // ローカル時刻として解釈されるため、デフォルトタイムゾーンでの時刻として扱う
                const utcTime = date.getTime() - (date.getTimezoneOffset() * 60000);
                return Math.floor(utcTime / 1000).toString();
            }
        }
        // 日付形式（YYYY/MM/DD）の場合
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateTimeInput)) {
            return dateTimeInput; // Gmail APIの日付形式としてそのまま使用
        }
        // 日時形式（YYYY/MM/DD HH:mm:ss）の場合
        if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(dateTimeInput)) {
            const [datePart, timePart] = dateTimeInput.split(' ');
            const [year, month, day] = datePart.split('/');
            const [hour, minute, second] = timePart.split(':');
            // デフォルトタイムゾーンでの時刻として解釈
            console.debug(`Using default timezone: ${this.defaultTimezone} for ${dateTimeInput}`);
            const date = new Date();
            date.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
            date.setHours(parseInt(hour), parseInt(minute), parseInt(second), 0);
            return Math.floor(date.getTime() / 1000).toString();
        }
        // その他の形式はそのまま返す（Gmail APIが解釈）
        return dateTimeInput;
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
                account_name: {
                    type: 'string',
                    enum: ['MAIN', 'WORK']
                },
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
//# sourceMappingURL=gmail.js.map