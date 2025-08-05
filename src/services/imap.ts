import Imap from 'node-imap';
import nodemailer from 'nodemailer';
import { ImapAccount, EmailMessage, EmailDetail, ListEmailsParams, Tool, SendEmailParams, SendEmailResult, SMTPConfig } from '../types.js';
import { decrypt } from '../utils/crypto.js';

export class IMAPHandler {
  private encryptionKey: string;
  private connections: Map<string, { config: ImapAccount; imap?: any }> = new Map();
  private connectionPool: Map<string, Promise<any>> = new Map();
  private smtpConfigs: Map<string, SMTPConfig> = new Map();
  
  // 環境変数によるタイムアウト設定（デフォルト60秒）
  private readonly DEFAULT_TIMEOUT = 60000;
  // private readonly imapTimeout: number; // 未使用のため一時的にコメントアウト
  private readonly connectionTimeout: number;
  private readonly operationTimeout: number;

  constructor(accounts: ImapAccount[], encryptionKey: string = process.env.EMAIL_ENCRYPTION_KEY || 'default-key') {
    this.encryptionKey = encryptionKey;
    this.loadIMAPConfigs(accounts);
    
    // 環境変数からタイムアウト設定を取得
    this.connectionTimeout = parseInt(process.env.IMAP_CONNECTION_TIMEOUT_MS || '30000'); // 接続タイムアウト30秒
    this.operationTimeout = parseInt(process.env.IMAP_OPERATION_TIMEOUT_MS || this.DEFAULT_TIMEOUT.toString()); // 操作タイムアウト60秒
  }
  
  private loadIMAPConfigs(accounts: ImapAccount[]) {
    for (const account of accounts) {
      this.addAccount(account.name, account);
      this.loadSMTPConfig(account);
    }
  }

  private loadSMTPConfig(account: ImapAccount): void {
    // SMTP設定を環境変数から読み込み
    const smtpHost = process.env[`SMTP_HOST_${account.name}`];
    const smtpPort = parseInt(process.env[`SMTP_PORT_${account.name}`] || '587');
    const smtpSecure = process.env[`SMTP_SECURE_${account.name}`] === 'true';
    const smtpUser = process.env[`SMTP_USER_${account.name}`];
    const smtpPassword = process.env[`SMTP_PASSWORD_${account.name}`];
    
    if (smtpHost && smtpUser && smtpPassword) {
      this.smtpConfigs.set(account.name, {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        password: smtpPassword
      });
    } else {
      // SMTP設定がない場合はIMAPと同じホストを推測
      const smtpHost = account.host.replace('imap', 'smtp');
      this.smtpConfigs.set(account.name, {
        host: smtpHost,
        port: 587,
        secure: false,
        user: account.user,
        password: account.password
      });
    }
  }

  addAccount(accountName: string, config: ImapAccount): void {
    this.connections.set(accountName, { config });
  }

  private async getConnection(accountName: string): Promise<Imap> {
    const connection = this.connections.get(accountName);
    if (!connection) {
      throw new Error(`IMAP account ${accountName} not found`);
    }

    // Check if there's already a connection attempt in progress
    if (this.connectionPool.has(accountName)) {
      try {
        return await this.connectionPool.get(accountName)!;
      } catch (error) {
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
    } catch (error) {
      // Remove failed connection from pool
      this.connectionPool.delete(accountName);
      throw error;
    }
  }

  private async createConnection(config: ImapAccount): Promise<any> {
    try {
      const decryptedPassword = decrypt(config.password, this.encryptionKey);
      console.log(`Attempting to decrypt password for ${config.name}. Encrypted: ${config.password}, Key: ${this.encryptionKey}`);
      console.log(`Decrypted password: ${decryptedPassword}`);
      const imapConfig = {
        ...config,
        password: decryptedPassword,
        authTimeout: this.connectionTimeout,
        connTimeout: this.connectionTimeout,
        tls: config.tls,
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

        imap.once('error', (err: any) => {
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
        } catch (error) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(error);
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to decrypt password or connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async openBox(imap: any, boxName: string = 'INBOX', readOnly: boolean = true): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Mailbox open timeout for ${boxName} after ${this.operationTimeout}ms`));
      }, this.operationTimeout);

      imap.openBox(boxName, readOnly, (err: any) => {
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

  async listEmails(accountName: string, params: ListEmailsParams = {}): Promise<EmailMessage[]> {
    let imap: Imap | null = null;
    
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

        imap!.search(searchCriteria, (err: any, results: any) => {
          if (resolved) return;
          
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
            const messages: EmailMessage[] = recentResults.map((uid) => ({
              id: uid.toString(),
              accountName,
              accountType: 'imap' as const,
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
          } catch (error) {
            if (!resolved) {
              resolved = true;
              reject(new Error(`Failed to process search results: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          }
        });
      });
    } catch (error) {
      throw new Error(`IMAP list emails failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (imap) {
        try {
          imap.end();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      // Remove from connection pool
      this.connectionPool.delete(accountName);
    }
  }

  async searchEmails(accountName: string, query: string, limit: number = 20): Promise<EmailMessage[]> {
    let imap: Imap | null = null;
    
    try {
      imap = await this.getConnection(accountName);
      await this.openBox(imap);

      // Simplified search criteria - avoid complex nested arrays
      let searchCriteria: any[];
      
      if (query === '*') {
        // Special case for wildcard search
        searchCriteria = ['ALL'];
      } else {
        // Use TEXT search for the query
        searchCriteria = ['TEXT', query];
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

        imap!.search(searchCriteria, (err: any, results: any) => {
          if (resolved) return;
          
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
            const messages: EmailMessage[] = [];

            // Fetch details for each message
            const fetchPromises = limitedResults.map(uid => {
              return new Promise<EmailMessage>(async (resolveFetch, rejectFetch) => {
                const f = imap!.fetch(uid, { bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)'], struct: true });
                f.on('message', (msg: any, _seqno: number) => {
                  let headers = '';
                  msg.on('body', (stream: any, _info: any) => {
                    stream.on('data', (chunk: any) => {
                      headers += chunk.toString('utf8');
                    });
                    stream.once('end', () => {
                      const parsedHeaders = this.parseHeaders(headers);
                      resolveFetch({
                        id: uid.toString(),
                        accountName,
                        accountType: 'imap' as const,
                        subject: parsedHeaders.subject || '(件名なし)',
                        from: parsedHeaders.from || '(送信者不明)',
                        to: parsedHeaders.to ? [parsedHeaders.to] : [],
                        date: parsedHeaders.date || new Date().toISOString(),
                        snippet: parsedHeaders.subject || '(件名なし)',
                        isUnread: false, // IMAP search doesn't directly provide unread status
                        hasAttachments: false // Not fetching full structure for search
                      });
                    });
                  });
                  msg.once('error', (err: any) => {
                    rejectFetch(new Error(`Failed to fetch message ${uid} details: ${err.message}`));
                  });
                });
                f.once('error', (err: any) => {
                  rejectFetch(new Error(`Fetch stream error for message ${uid}: ${err.message}`));
                });
              });
            });

            Promise.allSettled(fetchPromises).then(settledResults => {
              settledResults.forEach(settledResult => {
                if (settledResult.status === 'fulfilled') {
                  messages.push(settledResult.value);
                } else {
                  console.error(`Failed to get email detail for search result: ${settledResult.reason}`);
                }
              });
              resolved = true;
              resolve(messages.sort((a, b) => parseInt(b.id) - parseInt(a.id)));
            });
          } catch (error) {
            if (!resolved) {
              resolved = true;
              reject(new Error(`Failed to process search results: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          }
        });
      });
    } catch (error) {
      throw new Error(`IMAP search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (imap) {
        try {
          imap.end();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      // Remove from connection pool
      this.connectionPool.delete(accountName);
    }
  }

  async getEmailDetail(accountName: string, emailId: string): Promise<EmailDetail> {
    const imap = await this.getConnection(accountName);
    
    try {
      await this.openBox(imap);

      return new Promise((resolve, reject) => {
        const f = imap.fetch([parseInt(emailId)], {
          bodies: '',
          struct: true
        });

        let emailDetail: EmailDetail | null = null;

        f.on('message', (msg: any, _seqno: any) => {
          let headers = '';
          let body = '';
          let hasAttachments = false;
          let attachments: any[] = [];
          let messageAttrs: any = null;

          msg.on('body', (stream: any, _info: any) => {
            let buffer = '';
            stream.on('data', (chunk: any) => {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', () => {
              if (_info.which === 'HEADER') {
                headers = buffer;
              } else {
                body += buffer;
              }
            });
          });

          msg.once('attributes', (attrs: any) => {
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

        f.once('error', (err: any) => {
          reject(new Error(`Email detail fetch failed: ${err.message}`));
        });

        f.once('end', () => {
          if (emailDetail) {
            resolve(emailDetail);
          } else {
            reject(new Error('Email not found'));
          }
        });
      });
    } finally {
      imap.end();
    }
  }

  async getUnreadCount(accountName: string, folder: string = 'INBOX'): Promise<number> {
    let imap: Imap | null = null;
    
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

        imap!.search(['UNSEEN'], (err: any, results: any) => {
          if (resolved) return;
          
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
    } catch (error) {
      throw new Error(`IMAP getUnreadCount failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    finally {
      if (imap) {
        try {
          imap.end();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      // Remove from connection pool
      this.connectionPool.delete(accountName);
    }
  }

  private parseHeaders(headerString: string): any {
    const headers: any = {};
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

  private hasAttachments(struct: any[]): boolean {
    // Handle null, undefined, or non-array cases
    if (!struct || !Array.isArray(struct)) return false;
    
    for (const part of struct) {
      if (!part) continue; // Skip null/undefined parts
      
      if (Array.isArray(part)) {
        if (this.hasAttachments(part)) return true;
      } else if (part.disposition && part.disposition.type === 'attachment') {
        return true;
      }
    }
    
    return false;
  }

  private extractAttachments(struct: any[]): any[] {
    const attachments: any[] = [];
    
    // Handle null, undefined, or non-array cases
    if (!struct || !Array.isArray(struct)) return attachments;
    
    const extractFromPart = (part: any) => {
      if (!part) return; // Skip null/undefined parts
      
      if (Array.isArray(part)) {
        part.forEach(extractFromPart);
      } else if (part.disposition && part.disposition.type === 'attachment') {
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

  private extractTextFromBody(body: string): string {
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

  async archiveEmail(accountName: string, emailId: string, removeUnread: boolean = false): Promise<boolean> {
    let imap: Imap | null = null;
    
    try {
      imap = await this.getConnection(accountName);
      await this.openBox(imap, 'INBOX', false); // 読み書きモードでオープン

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
          
          // XServerのIMAPサーバーではmove操作が不安定なため、削除フラグのみを使用
          // これは一般的なアーカイブ手法で、多くのメールクライアントで使用されています
          let flags = ['\\Deleted'];
          if (removeUnread) {
            flags.push('\\Seen');
          }
          
          imap!.addFlags(uid, flags, (err: any) => {
            clearTimeout(timeout);
            if (err) {
              if (!resolved) {
                resolved = true;
                reject(new Error(`Failed to archive email (mark as deleted): ${err.message}`));
              }
            } else {
              if (!resolved) {
                resolved = true;
                resolve(true);
              }
            }
          });


        } catch (error) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            reject(new Error(`Failed to archive email: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        }
      });
    } catch (error) {
      throw new Error(`IMAP archiveEmail failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    finally {
      if (imap) {
        try {
          imap.end();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      // Remove from connection pool
      this.connectionPool.delete(accountName);
    }
  }

  getAvailableAccounts(): string[] {
    return Array.from(this.connections.keys());
  }

  async sendEmail(accountName: string, params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const smtpConfig = this.smtpConfigs.get(accountName);
      if (!smtpConfig) {
        return {
          success: false,
          error: `SMTP configuration not found for account: ${accountName}`
        };
      }

      // パスワードの復号
      const decryptedPassword = decrypt(smtpConfig.password, this.encryptionKey);
      
      // nodemailerのトランスポーターを作成
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: decryptedPassword
        },
        connectionTimeout: this.connectionTimeout,
        greetingTimeout: this.operationTimeout,
        socketTimeout: this.operationTimeout
      });

      // メール送信オプションの構築
      const mailOptions: any = {
        from: smtpConfig.user,
        to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(', ') : params.cc) : undefined,
        bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc) : undefined,
        attachments: params.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        }))
      };

      // 返信ヘッダーの追加
      if (params.replyTo) {
        mailOptions.replyTo = params.replyTo;
      }
      
      if (params.inReplyTo) {
        mailOptions.inReplyTo = params.inReplyTo;
      }
      
      if (params.references && params.references.length > 0) {
        mailOptions.references = params.references;
      }

      // メール送信
      const info = await transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      return {
        success: false,
        error: `SMTP send failed for ${accountName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const imapTools: Tool[] = [
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