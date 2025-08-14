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

  public async listFolders(accountName: string): Promise<string[]> {
    let client: ImapFlow | null = null;
    const folders: string[] = [];
    try {
      client = await this.getConnection(accountName);
      // @ts-ignore ImapFlow async iterator for listing mailboxes
      for await (const box of (client as any).list()) {
        const name: string = (box as any).path || (box as any).name || '';
        if (name) folders.push(name);
      }
      return folders;
    } catch (error) {
      throw new Error(`IMAP list folders failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (client) {
        try { await client.logout(); } catch {}
      }
      this.connectionPool.delete(accountName);
    }
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

  async searchEmails(accountName: string, args: any): Promise<EmailMessage[]> {
    let client: ImapFlow | null = null;
    try {
      client = await this.getConnection(accountName);
      // フォルダ横断検索に備えて最初は開かない（各ボックスで開く）
      // Build IMAP search query supporting SINCE/BEFORE and after:/before: aliases with multiple date formats
      const buildSearchQuery = (raw: string): any => {
        const search: any = {};

        if (!raw || raw.trim() === '*' ) {
          return search;
        }

        const original = raw;
        let remaining = raw;

        const tryParseIso = (s: string): Date | null => {
          // Accept YYYY-MM-DD or YYYY/MM/DD
          const norm = s.replace(/\//g, '-');
          const m = norm.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
          if (!m) return null;
          const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
          return isNaN(d.getTime()) ? null : d;
        };

        const tryParseImapDate = (s: string): Date | null => {
          // Support formats like 1-Jul-2025 or 01-Aug-2025
          const m = s.match(/^([0-9]{1,2})-([A-Za-z]{3})-([0-9]{2,4})$/);
          if (!m) return null;
          const day = m[1].padStart(2, '0');
          const mon = m[2].toLowerCase();
          const year = m[3].length === 2 ? `20${m[3]}` : m[3];
          const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
          const mm = months[mon];
          if (!mm) return null;
          const d = new Date(`${year}-${mm}-${day}T00:00:00Z`);
          return isNaN(d.getTime()) ? null : d;
        };

        const setSince = (d: Date) => { search.since = d; };
        const setBefore = (d: Date) => { search.before = d; };

        // Extract after:/before: (ISO formats)
        remaining = remaining.replace(/\bafter:([0-9]{4}[\/\-][0-9]{2}[\/\-][0-9]{2})/ig, (_m, g1) => {
          const d = tryParseIso(g1);
          if (d) setSince(d);
          return '';
        });
        remaining = remaining.replace(/\bbefore:([0-9]{4}[\/\-][0-9]{2}[\/\-][0-9]{2})/ig, (_m, g1) => {
          const d = tryParseIso(g1);
          if (d) setBefore(d);
          return '';
        });

        // Extract IMAP style SINCE/BEFORE dd-MMM-yyyy
        remaining = remaining.replace(/\bSINCE\s+([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})/ig, (_m, g1) => {
          const d = tryParseImapDate(g1);
          if (d) setSince(d);
          return '';
        });
        remaining = remaining.replace(/\bBEFORE\s+([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})/ig, (_m, g1) => {
          const d = tryParseImapDate(g1);
          if (d) setBefore(d);
          return '';
        });

        // Cleanup remaining tokens and set text if any
        const text = remaining
          .replace(/[()]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) {
          search.text = text;
        }

        // Fallback: if parsing removed everything and no fields set, keep original as text
        if (!search.since && !search.before && !search.text && original && original.trim()) {
          search.text = original.trim();
        }
        return search;
      };

      // Normalize inputs
      const text: string | undefined = typeof args?.text === 'string' ? args.text : (typeof args?.query === 'string' ? args.query : undefined);
      const sinceArg: string | undefined = typeof args?.since === 'string' ? args.since : undefined;
      const beforeArg: string | undefined = typeof args?.before === 'string' ? args.before : undefined;
      const limit: number = Math.max(1, Math.min(parseInt(args?.limit ?? '20', 10) || 20, 500));
      const matchFields: string[] = Array.isArray(args?.matchFields) && args.matchFields.length ? args.matchFields : ['subject', 'from'];
      const decodeMime: boolean = args?.decodeMime !== false;

      let searchQuery: any = {};
      if (sinceArg) {
        const d = new Date(sinceArg + 'T00:00:00Z');
        if (!isNaN(d.getTime())) searchQuery.since = d;
      }
      if (beforeArg) {
        const d = new Date(beforeArg + 'T00:00:00Z');
        if (!isNaN(d.getTime())) searchQuery.before = d;
      }
      // If legacy mixed query exists, parse it for dates as well
      if (!sinceArg && !beforeArg && typeof text === 'string') {
        const parsed = buildSearchQuery(text);
        if (parsed.since) searchQuery.since = parsed.since;
        if (parsed.before) searchQuery.before = parsed.before;
      }

      // 検索対象フォルダの決定
      let targetBoxes: string[] = [];
      const argFolders: string[] | undefined = Array.isArray(args?.folders) && args.folders.length
        ? (args.folders as string[])
            .map(f => String(f))
            .filter(Boolean)
        : undefined;

      if (argFolders) {
        // フォルダ指定があればそれを優先
        const seen: Record<string, boolean> = {};
        for (const f of argFolders) {
          const key = f;
          if (!seen[key]) { seen[key] = true; targetBoxes.push(f); }
        }
      } else {
        // 未指定なら広域（INBOX＋アーカイブ候補＋動的検出）
        targetBoxes = ['INBOX'];
        ['INBOX.Archive', 'Archive', 'アーカイブ', '[Gmail]/All Mail', 'All Mail', 'AllMail']
          .forEach((b) => { if (!targetBoxes.includes(b)) targetBoxes.push(b); });

        try {
          // ImapFlow v1: list() は Promise<ListResponse[]>
          const listResp: any = await (client as any).list();
          if (Array.isArray(listResp)) {
            for (const box of listResp) {
              const name: string = (box as any).path || (box as any).name || '';
              const lower = name.toLowerCase();
              if (
                lower.includes('archive') ||
                lower.includes('アーカイブ') ||
                lower.includes('all mail') ||
                lower.includes('allmail')
              ) {
                if (!targetBoxes.includes(name)) targetBoxes.push(name);
              }
            }
          }
        } catch {
          // フォルダ一覧取得失敗時は既定の候補のみで続行
        }
      }

      const collected: EmailMessage[] = [];
      const perBoxLimit = Math.min(Math.max(limit, 20), 500);

      for (const boxName of targetBoxes) {
        try {
          await this.openBox(client, boxName);
        } catch {
          continue;
        }

        // Build server-side search. Prefer date-only on server for stability; add broad text if provided
        const serverQuery: any = { ...searchQuery };
        if (text && text.trim()) {
          // some servers support text; keep it broad, final filtering is local
          serverQuery.text = text.trim();
        }

        const searchResults = await client.search(serverQuery);
        if (!searchResults || searchResults.length === 0) {
          continue;
        }
        const limitedResults = searchResults.slice(-perBoxLimit);

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
            folder: boxName,
            subject: envelope?.subject || '(件名なし)',
            from: envelope?.from?.[0]?.address || '(送信者不明)',
            to: envelope?.to?.map(addr => addr.address).filter((addr): addr is string => addr !== undefined) || [],
            date: envelope?.date?.toISOString() || new Date().toISOString(),
            snippet: envelope?.subject || '(件名なし)',
            isUnread: !msg.flags?.has('\\Seen'),
            hasAttachments: false
          };
          collected.push(emailMessage);
        }
      }

      if (collected.length === 0) {
        return [];
      }

      // MIMEデコード（簡易）：UTF-8のみ積極対応。その他は原文維持
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
              // QP variant
              const txt = data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_s: string, h: string) => String.fromCharCode(parseInt(h, 16)));
              return txt;
            }
          });
        } catch {
          return str;
        }
      };

      // ローカル絞り込み
      const filtered = collected.filter((m) => {
        // date guard by since/before already server-side; double-check client-side
        const t = new Date(m.date).getTime();
        if (searchQuery.since && t < new Date(searchQuery.since).getTime()) return false;
        if (searchQuery.before && t >= new Date(searchQuery.before).getTime()) return false;
        if (text && text.trim()) {
          const needle = text.toLowerCase();
          const subj = (decodeMime ? decodeMimeWord(m.subject) : m.subject).toLowerCase();
          const from = (decodeMime ? decodeMimeWord(m.from) : m.from).toLowerCase();
          const body = (decodeMime ? decodeMimeWord(m.snippet) : m.snippet).toLowerCase();
          const checks: boolean[] = [];
          if (matchFields.includes('subject')) checks.push(subj.includes(needle));
          if (matchFields.includes('from')) checks.push(from.includes(needle));
          if (matchFields.includes('body')) checks.push(body.includes(needle));
          return checks.some(Boolean);
        }
        return true;
      });

      // 日付降順で並べ替え、要求件数に制限
      const sorted = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return sorted.slice(0, limit);
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
      const uid = parseInt(emailId);

      // 広範囲に探索：INBOX + 既知のアーカイブ候補 + リストから推測
      const candidateBoxes: string[] = ['INBOX', 'INBOX.Archive', 'Archive', 'アーカイブ', '[Gmail]/All Mail', 'All Mail', 'AllMail'];
      try {
        const listResp: any = await (client as any).list();
        if (Array.isArray(listResp)) {
          for (const box of listResp) {
            const name: string = (box as any).path || (box as any).name || '';
            if (name && !candidateBoxes.includes(name)) {
              const lower = name.toLowerCase();
              if (lower.includes('inbox') || lower.includes('archive') || lower.includes('アーカイブ') || lower.includes('all mail') || lower.includes('allmail')) {
                candidateBoxes.push(name);
              }
            }
          }
        }
      } catch {}

      let foundMsg: any = null;
      let foundBox: string | undefined;
      for (const box of candidateBoxes) {
        try {
          await this.openBox(client, box);
        } catch {
          continue;
        }
        const searchResults = await client.search({ uid: `${uid}:${uid}` });
        if (searchResults && searchResults.length > 0) {
          const sequenceNumber = searchResults[0];
          foundMsg = await client.fetchOne(sequenceNumber, {
            envelope: true,
            bodyStructure: true,
            source: true
          });
          if (foundMsg) {
            foundBox = box;
            break;
          }
        }
      }
      
      const msg = foundMsg;
      
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
        folder: foundBox,
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