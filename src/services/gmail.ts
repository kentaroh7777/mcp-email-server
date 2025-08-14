import { google, gmail_v1 } from 'googleapis';
import { GmailAccount, EmailMessage, EmailDetail, ListEmailsParams, SendEmailParams, SendEmailResult, Tool } from '../types';
import { McpError } from '../types';

export const gmailTools: Tool[] = [
  {
    name: 'list_gmail_emails',
    description: 'List emails from Gmail account',
    inputSchema: {
      type: 'object',
      properties: {
        account_name: {
          type: 'string',
          description: 'Name of the Gmail account'
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
    name: 'search_gmail_emails',
    description: 'Search emails in Gmail account',
    inputSchema: {
      type: 'object',
      properties: {
        account_name: {
          type: 'string',
          description: 'Name of the Gmail account'
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
    name: 'get_gmail_email_detail',
    description: 'Get detailed information about a specific email',
    inputSchema: {
      type: 'object',
      properties: {
        account_name: {
          type: 'string',
          description: 'Name of the Gmail account'
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
    name: 'archive_gmail_email',
    description: 'Archive an email in Gmail account',
    inputSchema: {
      type: 'object',
      properties: {
        account_name: {
          type: 'string',
          description: 'Name of the Gmail account'
        },
        email_id: {
          type: 'string',
          description: 'ID of the email to archive'
        },
        remove_unread: {
          type: 'boolean',
          description: 'Whether to mark the email as read (default: false)'
        }
      },
      required: ['account_name', 'email_id']
    }
  },
  {
    name: 'send_gmail_email',
    description: 'Send an email from Gmail account',
    inputSchema: {
      type: 'object',
      properties: {
        account_name: {
          type: 'string',
          description: 'Name of the Gmail account'
        },
        to: {
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } }
          ],
          description: 'Recipient email address(es)'
        },
        subject: {
          type: 'string',
          description: 'Email subject'
        },
        text: {
          type: 'string',
          description: 'Plain text content of the email'
        },
        html: {
          type: 'string',
          description: 'HTML content of the email'
        },
        cc: {
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } }
          ],
          description: 'CC recipient email address(es)'
        },
        bcc: {
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } }
          ],
          description: 'BCC recipient email address(es)'
        },
        replyTo: {
          type: 'string',
          description: 'Reply-To email address'
        },
        inReplyTo: {
          type: 'string',
          description: 'Message-ID of the message this is a reply to'
        },
        references: {
          type: 'array',
          items: { type: 'string' },
          description: 'Message-IDs of messages this message references'
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string' },
              contentType: { type: 'string' }
            },
            required: ['filename', 'content']
          },
          description: 'Array of attachment objects'
        }
      },
      required: ['account_name', 'to', 'subject'],
      oneOf: [
        { required: ['text'] },
        { required: ['html'] }
      ]
    }
  }
];

export class GmailHandler {
  private accounts: GmailAccount[];

  constructor(accounts: GmailAccount[]) {
    this.accounts = accounts;
  }

  private getAccount(accountName: string): GmailAccount {
    const account = this.accounts.find(acc => acc.name === accountName);
    if (!account) {
      throw new McpError(-32000, `Gmail account not found: ${accountName}`);
    }
    return account;
  }

  async authenticate(accountName: string): Promise<gmail_v1.Gmail> {
    const account = this.getAccount(accountName);

    const oauth2Client = new google.auth.OAuth2(
      account.clientId,
      account.clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({
      refresh_token: account.refreshToken
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });

    return gmail;
  }

  async testConnection(accountName: string): Promise<void> {
    try {
      const gmail = await this.authenticate(accountName);
      // 軽量なプロファイル取得で接続をテスト
      await gmail.users.getProfile({ userId: 'me' });
    } catch (error: any) {
      throw new McpError(-32000, `Authentication failed for Gmail account: ${accountName}`);
    }
  }

  getAvailableAccounts(): string[] {
    return this.accounts.map(acc => acc.name);
  }

  async listEmails(accountName: string, params: ListEmailsParams): Promise<EmailMessage[]> {
    try {
      const gmail = await this.authenticate(accountName);
      const query = params.unread_only ? 'is:unread' : 'in:inbox';
      const limit = Math.min(params.limit || 20, 100);
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: limit
      });

      if (!response.data.messages) {
        return [];
      }

      const emails: EmailMessage[] = [];
      
      for (const message of response.data.messages.slice(0, limit)) {
        try {
          const messageDetail = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date']
          });

          const headers = messageDetail.data.payload?.headers || [];
          const fromHeader = headers.find(h => h.name === 'From');
          const subjectHeader = headers.find(h => h.name === 'Subject');
          const dateHeader = headers.find(h => h.name === 'Date');

          emails.push({
            id: message.id!,
            accountName,
            accountType: 'gmail',
            subject: subjectHeader?.value || '(件名なし)',
            from: fromHeader?.value || '(送信者不明)',
            to: [],
            date: dateHeader?.value || '',
            snippet: messageDetail.data.snippet || '',
            isUnread: messageDetail.data.labelIds?.includes('UNREAD') || false,
            hasAttachments: false
          });
        } catch (detailError) {
          // Skip error messages silently
        }
      }

      return emails;
      
    } catch (error: any) {
      if (error.response?.data?.error === 'invalid_grant') {
        throw new McpError(-32001, `Authentication failed for Gmail account: ${accountName}`,
        {
          accountName: accountName,
          accountType: 'gmail',
          errorDetail: "Refresh token is expired or revoked.",
          suggestion: `Please re-authenticate this account by running the following command in the mcp-email-server directory: 'node scripts/gmail-desktop-auth.mjs ${accountName}'`
        });
      }
      throw error;
    }
  }

  async searchEmails(accountName: string, args: any): Promise<EmailMessage[]> {
    try {
      const gmail = await this.authenticate(accountName);
      const text: string | undefined = typeof args?.text === 'string' ? args.text : (typeof args?.query === 'string' ? args.query : undefined);
      const sinceArg: string | undefined = typeof args?.since === 'string' ? args.since : undefined;
      const beforeArg: string | undefined = typeof args?.before === 'string' ? args.before : undefined;
      const limit: number = Math.max(1, Math.min(parseInt(args?.limit ?? '20', 10) || 20, 100));
      const matchFields: string[] = Array.isArray(args?.matchFields) && args.matchFields.length ? args.matchFields : ['subject','from'];
      const decodeMime: boolean = args?.decodeMime !== false;

      const qParts: string[] = [];
      qParts.push('in:anywhere');
      if (sinceArg) {
        const d = new Date(sinceArg + 'T00:00:00Z');
        if (!isNaN(d.getTime())) {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth()+1).padStart(2, '0');
          const da = String(d.getUTCDate()).padStart(2, '0');
          qParts.push(`after:${y}/${m}/${da}`);
        }
      }
      if (beforeArg) {
        const d = new Date(beforeArg + 'T00:00:00Z');
        if (!isNaN(d.getTime())) {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth()+1).padStart(2, '0');
          const da = String(d.getUTCDate()).padStart(2, '0');
          qParts.push(`before:${y}/${m}/${da}`);
        }
      }
      if (text && text.trim()) qParts.push(text.trim());

      const q = qParts.join(' ');
      const response = await gmail.users.messages.list({ userId: 'me', q, maxResults: limit });
      if (!response.data.messages) return [];

      const decodeMimeWord = (str?: string): string => {
        if (!str) return '';
        try {
          return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_m, cs, enc, data) => {
            const charset = String(cs).toLowerCase();
            const encoding = String(enc).toUpperCase();
            if (encoding === 'B') {
              const buf = Buffer.from(data.replace(/\s+/g, ''), 'base64');
              if (charset.includes('utf-8')) return buf.toString('utf8');
              return buf.toString();
            } else {
              const txt = data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_s: string, h: string) => String.fromCharCode(parseInt(h, 16)));
              return txt;
            }
          });
        } catch {
          return str;
        }
      };

      const messages: EmailMessage[] = [];
      for (const message of response.data.messages.slice(0, limit)) {
        try {
          const messageDetail = await gmail.users.messages.get({ userId: 'me', id: message.id!, format: 'metadata', metadataHeaders: ['From','Subject','Date'] });
          const headers = messageDetail.data.payload?.headers || [];
          const fromHeader = headers.find(h => h.name === 'From');
          const subjectHeader = headers.find(h => h.name === 'Subject');
          const dateHeader = headers.find(h => h.name === 'Date');
          const m: EmailMessage = {
            id: message.id!,
            accountName,
            accountType: 'gmail',
            subject: subjectHeader?.value || '(件名なし)',
            from: fromHeader?.value || '(送信者不明)',
            to: [],
            date: dateHeader?.value || '',
            snippet: messageDetail.data.snippet || '',
            isUnread: messageDetail.data.labelIds?.includes('UNREAD') || false,
            hasAttachments: false
          };
          messages.push(m);
        } catch {}
      }

      const needle = (text || '').toLowerCase();
      const filtered = !needle ? messages : messages.filter(m => {
        const subj = (decodeMime ? decodeMimeWord(m.subject) : m.subject).toLowerCase();
        const from = (decodeMime ? decodeMimeWord(m.from) : m.from).toLowerCase();
        const body = (decodeMime ? decodeMimeWord(m.snippet) : m.snippet).toLowerCase();
        const checks: boolean[] = [];
        if (matchFields.includes('subject')) checks.push(subj.includes(needle));
        if (matchFields.includes('from')) checks.push(from.includes(needle));
        if (matchFields.includes('body')) checks.push(body.includes(needle));
        return checks.some(Boolean);
      });

      return filtered;
    } catch (error) {
      throw error;
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

      const message = response.data;
      const headers = message.payload?.headers || [];
      
      const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';
      
      let body = '';
      let hasAttachments = false;
      const attachments: any[] = [];

      // Function to decode base64url to string
      const decodeBase64Url = (data: string) => {
        return Buffer.from(data, 'base64').toString('utf8');
      };

      // Function to get parts recursively
      const getParts = (parts: gmail_v1.Schema$MessagePart[]) => {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = decodeBase64Url(part.body.data);
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            // Prefer HTML body if available, but for now just take the first one
            if (!body) { // Only set if plain text body not found yet
              body = decodeBase64Url(part.body.data);
            }
          } else if (part.filename && part.body?.attachmentId) {
            hasAttachments = true;
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              attachmentId: part.body.attachmentId,
              size: part.body.size
            });
          }

          if (part.parts) {
            getParts(part.parts);
          }
        }
      };

      if (message.payload?.parts) {
        getParts(message.payload.parts);
      } else if (message.payload?.body?.data) {
        // Handle cases where there are no parts (e.g., simple text emails)
        body = decodeBase64Url(message.payload.body.data);
      }

      const detail: EmailDetail = {
        id: emailId,
        accountName,
        accountType: 'gmail',
        subject: getHeader('Subject') || '(件名なし)',
        from: getHeader('From') || '(送信者不明)',
        to: getHeader('To').split(',').map(addr => addr.trim()).filter(addr => addr),
        date: getHeader('Date') || '',
        snippet: message.snippet || '',
        body: body,
        attachments: attachments.map(att => ({
          filename: att.filename,
          contentType: att.mimeType,
          size: att.size
        })),
        isUnread: message.labelIds?.includes('UNREAD') || false,
        hasAttachments: hasAttachments
      };

      return detail;
    } catch (error) {
      throw error;
    }
  }

  async archiveEmail(accountName: string, emailIds: string | string[], removeUnread: boolean = false): Promise<void> {
    try {
      const gmail = await this.authenticate(accountName);
      const ids = Array.isArray(emailIds) ? emailIds : [emailIds];
      
      for (const emailId of ids) {
        const labelsToRemove = ['INBOX'];
        if (removeUnread) {
          labelsToRemove.push('UNREAD');
        }
        
        await gmail.users.messages.modify({
          userId: 'me',
          id: emailId,
          requestBody: {
            removeLabelIds: labelsToRemove
          }
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async sendEmail(accountName: string, params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const gmail = await this.authenticate(accountName);
      
      const recipients = Array.isArray(params.to) ? params.to : [params.to];
      const ccList = params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : [];
      const bccList = params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : [];
      
      let emailLines = [
        `To: ${recipients.join(', ')}`,
        `Subject: ${params.subject}`
      ];
      
      if (ccList.length > 0) {
        emailLines.push(`Cc: ${ccList.join(', ')}`);
      }
      
      if (bccList.length > 0) {
        emailLines.push(`Bcc: ${bccList.join(', ')}`);
      }
      
      if (params.replyTo) {
        emailLines.push(`Reply-To: ${params.replyTo}`);
      }
      
      if (params.inReplyTo) {
        emailLines.push(`In-Reply-To: ${params.inReplyTo}`);
      }
      
      if (params.references && params.references.length > 0) {
        emailLines.push(`References: ${params.references.join(' ')}`);
      }
      
      emailLines.push('MIME-Version: 1.0');
      emailLines.push('Content-Type: text/plain; charset="UTF-8"');
      emailLines.push('');
      emailLines.push(params.text || '');
      
      const rawMessage = emailLines.join('\n');
      const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+\$/, '');
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });
      
      return {
        success: true,
        messageId: response.data.id || ''
      };
    } catch (error) {
      throw error;
    }
  }
}