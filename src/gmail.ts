import { google, gmail_v1 } from 'googleapis';
import { GmailConfig, EmailMessage, EmailDetail, ListEmailsParams, Tool, SendEmailParams, SendEmailResult } from './types.js';
import * as dotenv from 'dotenv';

export class GmailHandler {
  private configs: Map<string, any> = new Map();

  constructor() {
    // 環境変数を確実に読み込み
    dotenv.config();
    this.loadGmailConfigs();
  }

  private loadGmailConfigs() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    
    // kentaroh7アカウント
    const refreshTokenKentaroh7 = process.env.GMAIL_REFRESH_TOKEN_kentaroh7;
    if (clientId && clientSecret && refreshTokenKentaroh7) {
      this.configs.set('kentaroh7', {
        clientId,
        clientSecret,
        refreshToken: refreshTokenKentaroh7,
        displayName: 'kentaroh7'
      });
    }

    // MAINアカウント
    const refreshTokenMain = process.env.GMAIL_REFRESH_TOKEN_MAIN;
    if (clientId && clientSecret && refreshTokenMain) {
      this.configs.set('MAIN', {
        clientId,
        clientSecret,
        refreshToken: refreshTokenMain,
        displayName: 'MAIN'
      });
    }

    // WORKアカウント
    const refreshTokenWork = process.env.GMAIL_REFRESH_TOKEN_WORK;
    if (clientId && clientSecret && refreshTokenWork) {
      this.configs.set('WORK', {
        clientId,
        clientSecret,
        refreshToken: refreshTokenWork,
        displayName: 'WORK'
      });
    }
  }

  async authenticate(accountName: string): Promise<gmail_v1.Gmail> {
    const config = this.configs.get(accountName);
    if (!config) {
      throw new Error(`Gmail account ${accountName} not configured`);
    }

    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({
      refresh_token: config.refreshToken
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });

    return gmail;
  }

  getAvailableAccounts(): string[] {
    return Array.from(this.configs.keys());
  }

  async testConnection(accountName: string): Promise<boolean> {
    try {
      const gmail = await this.authenticate(accountName);
      const result = await gmail.users.getProfile({ userId: 'me' });
      return true;
    } catch (error) {
      return false;
    }
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
      
    } catch (error) {
      throw error;
    }
  }

  async searchEmails(accountName: string, query: string, limit: number = 20): Promise<EmailMessage[]> {
    try {
      const gmail = await this.authenticate(accountName);
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.min(limit, 100)
      });

      if (!response.data.messages) {
        return [];
      }

      const emails: EmailMessage[] = [];
      for (const message of response.data.messages) {
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
      
      const detail: EmailDetail = {
        id: emailId,
        accountName,
        accountType: 'gmail',
        subject: getHeader('Subject') || '(件名なし)',
        from: getHeader('From') || '(送信者不明)',
        to: getHeader('To').split(',').map(addr => addr.trim()).filter(addr => addr),
        date: getHeader('Date') || '',
        snippet: message.snippet || '',
        body: '',
        attachments: [],
        isUnread: message.labelIds?.includes('UNREAD') || false,
        hasAttachments: false
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
      const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
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