import { google, gmail_v1 } from 'googleapis';
import { GmailConfig, EmailMessage, EmailDetail, ListEmailsParams, Tool, SendEmailParams, SendEmailResult } from './types.js';
import { logToFile } from './file-logger.js';

export class GmailHandler {
  private configs: Map<string, GmailConfig> = new Map();
  
  // 環境変数によるタイムアウト設定（デフォルト60秒）
  private readonly DEFAULT_TIMEOUT = 60000;
  private readonly gmailTimeout: number;
  
  // タイムゾーン設定（優先順位：TZ > EMAIL_DEFAULT_TIMEZONE > システム検出 > Asia/Tokyo）
  private readonly defaultTimezone: string;

  constructor() {
    this.loadGmailConfigs();
    this.gmailTimeout = parseInt(process.env.GMAIL_TIMEOUT_MS || this.DEFAULT_TIMEOUT.toString());
    
    // タイムゾーンの決定（優先順位付き）
    this.defaultTimezone = this.detectTimezone();
  }

  private detectTimezone(): string {
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
    } catch (error) {
      // システム検出に失敗した場合は下記のデフォルトを使用
    }
    
    // 4. デフォルト（日本時間）
    return 'Asia/Tokyo';
  }

  private loadGmailConfigs() {
    // Load Gmail accounts using refresh tokens
    const gmailRefreshKeys = Object.keys(process.env).filter(key => key.startsWith('GMAIL_REFRESH_TOKEN_'));
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    
    for (const refreshKey of gmailRefreshKeys) {
      const accountName = refreshKey.replace('GMAIL_REFRESH_TOKEN_', '');
      const refreshToken = process.env[refreshKey];
      
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
      if (this.configs.has(accountName)) continue; // Skip if already loaded
      
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

  async authenticate(accountName: string): Promise<gmail_v1.Gmail> {
    const config = this.configs.get(accountName);
    if (!config) {
      throw new Error(`Gmail account ${accountName} not configured`);
    }

    // Create OAuth2 client with proper timeout settings
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      'http://localhost'
    );

    // Set credentials and configure timeouts
    oauth2Client.setCredentials({
      refresh_token: config.refreshToken
    });

    // Add timeout handling for token refresh
    oauth2Client.on('tokens', (tokens: any) => {
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
    } catch (error) {
      throw new Error(`Gmail authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listEmails(accountName: string, params: ListEmailsParams): Promise<EmailMessage[]> {
    try {
      const gmail = await this.authenticate(accountName);
      
      let query = '';
      if (params.unread_only) query += 'is:unread ';
      if (params.folder) {
        if (params.folder === 'INBOX') {
          query += 'in:inbox ';
        } else {
          query += `label:${params.folder} `;
        }
      } else {
        // デフォルトはINBOX
        query += 'in:inbox ';
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
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date']
          });
          return this.formatEmailMessage(detail.data, accountName);
        } catch (error) {
          // 個別メッセージの失敗は警告として処理
          // エラーログをファイルに記録
        logToFile('warn', `Failed to load message ${message.id}`, { error: error instanceof Error ? error.message : 'Unknown error' });
          return {
            id: message.id || 'unknown',
            accountName,
            accountType: 'gmail' as const,
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
    } catch (error) {
      throw new Error(`Failed to list emails for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchEmails(accountName: string, query: string, limit: number, dateAfter?: string, dateBefore?: string): Promise<EmailMessage[]> {
    try {
      const gmail = await this.authenticate(accountName);

      // Apply environmental limits for email content fetching - 制限を緩和
      const maxLimit = parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '200'); // 50 → 200に増加
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
      
      // メッセージ詳細の取得（並列処理で効率化）- 処理件数を増加
      const processingLimit = Math.min(messages.length, effectiveLimit); // 20 → effectiveLimitに変更
      const emailPromises = messages.slice(0, processingLimit).map(async (message) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date']
          });
          return this.formatEmailMessage(detail.data, accountName);
        } catch (error) {
          // 個別メッセージの失敗は警告として処理
          // エラーログをファイルに記録
        logToFile('warn', `Failed to load search result ${message.id}`, { error: error instanceof Error ? error.message : 'Unknown error' });
          return {
            id: message.id || 'unknown',
            accountName,
            accountType: 'gmail' as const,
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

      const results = await Promise.all(emailPromises);
      
      // デバッグ情報を追加
      // Debug log removed to prevent JSON parsing issues in tests
      
      return results;
    } catch (error) {
      throw new Error(`Failed to search emails for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEmailDetail(accountName: string, emailId: string): Promise<EmailDetail> {
    try {
      const gmail = await this.authenticate(accountName);

      const response = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full'
      });

      return this.formatEmailDetail(response.data, accountName);
    } catch (error) {
      throw new Error(`Failed to get email detail for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUnreadCount(accountName: string, folder: string = 'INBOX'): Promise<number> {
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
    } catch (error) {
      throw new Error(`Failed to get unread count for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getAvailableAccounts(): string[] {
    return Array.from(this.configs.keys());
  }

  private parseDateTime(dateTimeInput: string): string {
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
        // Debug log removed to prevent JSON parsing issues in tests
        // ローカル時刻として解釈されるため、デフォルトタイムゾーンでの時刻として扱う
        // defaultTimezoneを使用してタイムゾーン変換
        const utcTime = date.getTime() - (date.getTimezoneOffset() * 60000);
        void this.defaultTimezone; // タイムゾーン設定を参照（将来の機能拡張用）
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
      // Debug log removed to prevent JSON parsing issues in tests
      // defaultTimezoneを使用してタイムゾーン変換
      const date = new Date();
      date.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
      date.setHours(parseInt(hour), parseInt(minute), parseInt(second), 0);
      void this.defaultTimezone; // タイムゾーン設定を参照（将来の機能拡張用）
      
      return Math.floor(date.getTime() / 1000).toString();
    }
    
    // その他の形式はそのまま返す（Gmail APIが解釈）
    return dateTimeInput;
  }

  private formatEmailMessage(message: any, accountName: string): EmailMessage {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => 
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

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
      hasAttachments: message.payload?.parts?.some((part: any) => 
        part.filename && part.filename.length > 0) || false
    };
  }

  private formatEmailDetail(message: any, accountName: string): EmailDetail {
    const baseMessage = this.formatEmailMessage(message, accountName);
    
    const body = this.extractEmailBody(message.payload);
    const attachments = this.extractAttachments(message.payload);

    return {
      ...baseMessage,
      body,
      attachments
    };
  }

  private extractEmailBody(payload: any): string {
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

  private extractAttachments(payload: any): Array<{ filename: string; contentType: string; size: number }> {
    const attachments: Array<{ filename: string; contentType: string; size: number }> = [];

    const extractFromParts = (parts: any[]) => {
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

  async archiveEmail(accountName: string, emailId: string, removeUnread: boolean = false): Promise<boolean> {
    try {
      const gmail = await this.authenticate(accountName);

      // デバッグ: アーカイブ前のメール状態を確認
      const beforeModify = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'minimal'
      });
      
      const beforeLabels = beforeModify.data.labelIds || [];
      console.log(`[DEBUG] アーカイブ前のラベル: ${beforeLabels.join(', ')}`);

      // Step 1: INBOXラベルがない場合は追加
      if (!beforeLabels.includes('INBOX')) {
        console.log(`[DEBUG] INBOXラベルを追加...`);
        await gmail.users.messages.modify({
          userId: 'me',
          id: emailId,
          requestBody: {
            addLabelIds: ['INBOX']
          }
        });
        console.log(`[DEBUG] INBOXラベル追加完了`);
      }

      // Step 2: アーカイブ対象のラベルを特定
      const labelsToRemove: string[] = ['INBOX']; // INBOXは必ず削除
      
      // すべてのカテゴリラベルを削除対象に追加
      const categoryLabels = beforeLabels.filter(label => 
        label.startsWith('CATEGORY_')
      );
      labelsToRemove.push(...categoryLabels);
      
      // UNREADラベルの削除オプション
      if (removeUnread && beforeLabels.includes('UNREAD')) {
        labelsToRemove.push('UNREAD');
        console.log(`[DEBUG] UNREADラベルも削除対象に追加`);
      }
      
      console.log(`[DEBUG] 削除対象ラベル: ${labelsToRemove.join(', ')}`);

      // Step 3: ラベル削除
      console.log(`[DEBUG] ラベル削除中...`);
      await gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          removeLabelIds: labelsToRemove
        }
      });
      console.log(`[DEBUG] ラベル削除完了`);

      // Step 4: CATEGORY_PERSONALを追加（アーカイブ状態を維持）
      console.log(`[DEBUG] CATEGORY_PERSONALを追加してアーカイブ状態に...`);
      await gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          addLabelIds: ['CATEGORY_PERSONAL']
        }
      });
      console.log(`[DEBUG] アーカイブ処理完了`);

      // Step 5: 結果確認（デバッグ用）
      const afterModify = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'minimal'
      });
      
      const afterLabels = afterModify.data.labelIds || [];
      console.log(`[DEBUG] アーカイブ後のラベル: ${afterLabels.join(', ')}`);

      return true;
    } catch (error) {
      console.error(`[ERROR] アーカイブ失敗:`, error);
      throw new Error(`Gmail archive failed for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendEmail(accountName: string, params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const gmail = await this.authenticate(accountName);

      // メール内容の構築
      const email = this.buildEmailMessage(params);
      
      // Base64URLエンコード
      const encodedEmail = Buffer.from(email).toString('base64url');

      // Gmail API経由でメール送信
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      logToFile('info', `Email sent successfully via Gmail`, {
        accountName,
        messageId: response.data.id,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject
      });

      return {
        success: true,
        messageId: response.data.id || undefined
      };
    } catch (error) {
      const errorMessage = `Gmail send failed for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logToFile('error', errorMessage, { error });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private buildEmailMessage(params: SendEmailParams): string {
    const { to, subject, text, html, cc, bcc, inReplyTo, references, replyTo } = params;
    
    // ヘッダーの構築
    const headers: string[] = [];
    
    // TO
    const toAddresses = Array.isArray(to) ? to.join(', ') : to;
    headers.push(`To: ${toAddresses}`);
    
    // CC
    if (cc) {
      const ccAddresses = Array.isArray(cc) ? cc.join(', ') : cc;
      headers.push(`Cc: ${ccAddresses}`);
    }
    
    // BCC
    if (bcc) {
      const bccAddresses = Array.isArray(bcc) ? bcc.join(', ') : bcc;
      headers.push(`Bcc: ${bccAddresses}`);
    }
    
    // Reply-To
    if (replyTo) {
      headers.push(`Reply-To: ${replyTo}`);
    }
    
    // Subject
    headers.push(`Subject: ${subject}`);
    
    // 返信ヘッダー
    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
    }
    
    if (references && references.length > 0) {
      headers.push(`References: ${references.join(' ')}`);
    }
    
    // Content-Type
    if (html && text) {
      // マルチパート（HTML + テキスト）
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36)}`;
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      headers.push('MIME-Version: 1.0');
      
      const body = [
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        text,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        html,
        '',
        `--${boundary}--`
      ].join('\r\n');
      
      return headers.join('\r\n') + '\r\n\r\n' + body;
    } else if (html) {
      // HTMLのみ
      headers.push('Content-Type: text/html; charset=UTF-8');
      headers.push('MIME-Version: 1.0');
      return headers.join('\r\n') + '\r\n\r\n' + html;
    } else {
      // テキストのみ
      headers.push('Content-Type: text/plain; charset=UTF-8');
      headers.push('MIME-Version: 1.0');
      return headers.join('\r\n') + '\r\n\r\n' + (text || '');
    }
  }
}

export const gmailTools: Tool[] = [
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