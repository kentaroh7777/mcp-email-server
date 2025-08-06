import { ImapFlow } from 'imapflow';
import { ImapAccount, EmailMessage, EmailDetail, ListEmailsParams, SendEmailParams, SendEmailResult, SMTPConfig } from '../types.js';
import * as nodemailer from 'nodemailer';
import { decrypt } from '../utils/crypto.js';

export class ImapFlowHandler {
  private accounts: ImapAccount[];
  private encryptionKey: string;
  private connectionPool: Map<string, ImapFlow> = new Map();

  constructor(accounts: ImapAccount[], encryptionKey: string) {
    this.accounts = accounts;
    this.encryptionKey = encryptionKey;
  }

  private loadSMTPConfig(accountName: string): SMTPConfig | null {
    // SMTP設定を環境変数から読み込み
    const smtpHost = process.env[`SMTP_HOST_${accountName}`];
    const smtpPort = parseInt(process.env[`SMTP_PORT_${accountName}`] || '587');
    const smtpSecure = process.env[`SMTP_SECURE_${accountName}`] === 'true';
    const smtpUser = process.env[`SMTP_USER_${accountName}`];
    const smtpPassword = process.env[`SMTP_PASSWORD_${accountName}`];
    
    if (smtpHost && smtpUser && smtpPassword) {
      return {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        password: smtpPassword
      };
    } else {
      // SMTP設定がない場合はIMAPと同じホストを推測
      const account = this.accounts.find(acc => acc.name === accountName);
      if (!account) {
        return null;
      }
      const smtpHost = account.host.replace('imap', 'smtp');
      return {
        host: smtpHost,
        port: 587,
        secure: false,
        user: account.user,
        password: account.password
      };
    }
  }

  private async getConnection(accountName: string): Promise<ImapFlow> {
    const connection = this.accounts.find(acc => acc.name === accountName);
    if (!connection) {
      throw new Error(`IMAP account ${accountName} not found`);
    }

    // Check if there's already a connection attempt in progress
    if (this.connectionPool.has(accountName)) {
      try {
        return this.connectionPool.get(accountName)!;
      } catch (error) {
        // Remove failed connection from pool and try again
        this.connectionPool.delete(accountName);
      }
    }

    // Create new connection with proper error handling
    const client = await this.createConnection(connection);
    this.connectionPool.set(accountName, client);

    try {
      return client;
    } catch (error) {
      // Remove failed connection from pool
      this.connectionPool.delete(accountName);
      throw error;
    }
  }

  private async createConnection(config: ImapAccount): Promise<ImapFlow> {
    try {
      const decryptedPassword = decrypt(config.password, this.encryptionKey);
      const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.tls,
        auth: {
          user: config.user,
          pass: decryptedPassword
        },
        logger: false // ログを無効化
      });

      await client.connect();
      return client;
    } catch (error) {
      throw new Error(`Failed to create IMAP connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async openBox(client: ImapFlow, boxName: string = 'INBOX'): Promise<void> {
    try {
      await client.mailboxOpen(boxName);
    } catch (error) {
      throw error;
    }
  }

  async listEmails(accountName: string, params: ListEmailsParams): Promise<EmailMessage[]> {
    let client: ImapFlow | null = null;
    try {
      client = await this.getConnection(accountName);
      await this.openBox(client);
      
      let searchQuery: any = {};
      if (params.unread_only) {
        searchQuery = { seen: false };
      }
      
      const searchResults = await client.search(searchQuery);
      if (!searchResults || searchResults.length === 0) {
        return [];
      }
      
      const limitedResults = searchResults.slice(-Math.min(params.limit || 20, 20));
      const messages: EmailMessage[] = [];
      
      // ImapFlowではsearchで取得したsequence numberを使ってfetchAllを実行
      // UIDが必要な場合は、fetchAllの結果からuidプロパティを取得
      const fetchedMessages = await client.fetchAll(limitedResults, {
        envelope: true,
        bodyStructure: false
      });
      
      for (const msg of fetchedMessages) {
        const envelope = msg.envelope;
        const emailMessage: EmailMessage = {
          id: msg.uid.toString(),
          accountName,
          accountType: 'imap' as const,
          subject: envelope?.subject || '(件名なし)',
          from: envelope?.from?.[0]?.address || '(送信者不明)',
          to: envelope?.to?.map(addr => addr.address).filter((addr): addr is string => addr !== undefined) || [],
          date: envelope?.date?.toISOString() || new Date().toISOString(),
          snippet: envelope?.subject || '(件名なし)',
          isUnread: !msg.flags?.has('\\Seen'),
          hasAttachments: false
        };
        messages.push(emailMessage);
      }
      
      return messages.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    } catch (error) {
      throw new Error(`IMAP list failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      this.connectionPool.delete(accountName);
    }
  }

  async searchEmails(accountName: string, query: string, limit: number = 20): Promise<EmailMessage[]> {
    let client: ImapFlow | null = null;
    try {
      client = await this.getConnection(accountName);
      await this.openBox(client);
      let searchQuery: any = {};
      if (query === '*') {
        searchQuery = {};
      } else {
        searchQuery = { text: query };
      }
      const searchResults = await client.search(searchQuery);
      if (!searchResults || searchResults.length === 0) {
        return [];
      }
      const limitedResults = searchResults.slice(-Math.min(limit, 20));
      const messages: EmailMessage[] = [];
      
      // ImapFlowではsearchで取得したsequence numberを使ってfetchAllを実行
      const fetchedMessages = await client.fetchAll(limitedResults, {
        envelope: true,
        bodyStructure: false
      });
      for (const msg of fetchedMessages) {
        const envelope = msg.envelope;
        const emailMessage: EmailMessage = {
          id: msg.uid.toString(),
          accountName,
          accountType: 'imap' as const,
          subject: envelope?.subject || '(件名なし)',
          from: envelope?.from?.[0]?.address || '(送信者不明)',
          to: envelope?.to?.map(addr => addr.address).filter((addr): addr is string => addr !== undefined) || [],
          date: envelope?.date?.toISOString() || new Date().toISOString(),
          snippet: envelope?.subject || '(件名なし)',
          isUnread: !msg.flags?.has('\\Seen'),
          hasAttachments: false
        };
        messages.push(emailMessage);
      }
      return messages.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    } catch (error) {
      throw new Error(`IMAP search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      this.connectionPool.delete(accountName);
    }
  }

  async getEmailDetail(accountName: string, emailId: string): Promise<EmailDetail> {
    let client: ImapFlow | null = null;
    try {
      client = await this.getConnection(accountName);
      await this.openBox(client);
      
      const uid = parseInt(emailId);
      
      // UIDでメッセージを検索してsequence numberを取得
      const searchResults = await client.search({ uid: `${uid}:${uid}` });
      
      if (!searchResults || searchResults.length === 0) {
        throw new Error('Email not found');
      }
      
      // 最初のsequence numberを使用してメッセージを取得
      const sequenceNumber = searchResults[0];
      
      const msg = await client.fetchOne(sequenceNumber, {
        envelope: true,
        bodyStructure: true,
        source: true
      });
      
      if (!msg) {
        throw new Error('Email not found');
      }
      
      const envelope = msg.envelope;
      
      // sourceから本文を抽出
      let bodyText = '';
      if (msg.source) {
        const sourceString = msg.source.toString('utf8');
        
        // メールの本文部分を抽出（ヘッダー部分をスキップ）
        const headerEndIndex = sourceString.indexOf('\r\n\r\n');
        if (headerEndIndex !== -1) {
          bodyText = sourceString.substring(headerEndIndex + 4);
        }
      }

      const emailDetail: EmailDetail = {
        id: msg.uid.toString(),
        accountName,
        accountType: 'imap' as const,
        subject: envelope?.subject || '(件名なし)',
        from: envelope?.from?.[0]?.address || '(送信者不明)',
        to: envelope?.to?.map((addr: any) => addr.address).filter((addr: any): addr is string => addr !== undefined) || [],
        date: envelope?.date?.toISOString() || new Date().toISOString(),
        snippet: envelope?.subject || '(件名なし)',
        isUnread: !msg.flags?.has('\\Seen'),
        hasAttachments: false,
        body: bodyText,
        attachments: []
      };
      
      return emailDetail;
    } catch (error) {
      throw new Error(`IMAP get detail failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      this.connectionPool.delete(accountName);
    }
  }

  async getUnreadCount(accountName: string, folder: string = 'INBOX'): Promise<number> {
    let client: ImapFlow | null = null;
    
    try {
      client = await this.getConnection(accountName);
      await this.openBox(client, folder);

      const searchResults = await client.search({ seen: false });
      return searchResults ? searchResults.length : 0;
      
    } catch (error) {
      throw new Error(`IMAP getUnreadCount failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      this.connectionPool.delete(accountName);
    }
  }

  async archiveEmail(accountName: string, emailId: string, removeUnread: boolean = false): Promise<boolean> {
    let client: ImapFlow | null = null;
    
    try {
      client = await this.getConnection(accountName);
      await this.openBox(client);

      const uid = parseInt(emailId);
      
      // フラグを設定
      const flags = ['\\Seen'];
      if (removeUnread) {
        flags.push('\\Seen');
      }

      await client.messageFlagsSet([uid], flags, { uid: true });
      return true;
      
    } catch (error) {
      return false;
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      this.connectionPool.delete(accountName);
    }
  }

  getAvailableAccounts(): string[] {
    return this.accounts.map(acc => acc.name);
  }

  async testConnection(accountName: string): Promise<void> {
    let client: ImapFlow | null = null;
    try {
      client = await this.getConnection(accountName);
      // 軽量な接続テストのため、INBOXを開く
      await this.openBox(client);
    } catch (error: any) {
      throw new Error(`IMAP connection test failed for account ${accountName}: ${error.message}`);
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (e) {
          // Ignore logout errors
        }
        this.connectionPool.delete(accountName);
      }
    }
  }

  async sendEmail(accountName: string, params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const smtpConfig = this.loadSMTPConfig(accountName);
      if (!smtpConfig) {
        return {
          success: false,
          error: 'SMTP configuration not found'
        };
      }

      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.password
        }
      });

      const mailOptions = {
        from: smtpConfig.user,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html
      };

      const info = await transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 