export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: MCPError;
}

export interface MCPErrorData {
  [key: string]: any;
}

export class McpError extends Error {
  public code: number;
  public data?: MCPErrorData;

  constructor(code: number, message: string, data?: MCPErrorData) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.data = data;
  }

  toObject() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  displayName: string;
}

export interface IMAPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export type Account = GmailAccount | ImapAccount;

export interface GmailAccount {
  name: string;
  type: 'gmail';
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface ImapAccount {
  name: string;
  type: 'imap';
  host: string;
  port: number;
  tls: boolean;
  user: string;
  password: string;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    oneOf?: any[]; // Add oneOf for top-level schema
  };
}

export interface EmailMessage {
  id: string;
  accountName: string;
  accountType: 'gmail' | 'imap';
  // メールが存在するフォルダ/ボックス名（IMAPで有効）。Gmailでは省略可。
  folder?: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  isUnread: boolean;
  hasAttachments: boolean;
}

export interface EmailDetail extends EmailMessage {
  body: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

export interface ListEmailsParams {
  limit?: number;
  folder?: string;
  unread_only?: boolean;
}

export interface SendEmailParams {
  accountName: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  // 返信機能用
  inReplyTo?: string;      // 返信元メールのMessage-ID
  references?: string[];   // 会話スレッドのMessage-IDリスト
  replyTo?: string;        // Reply-Toヘッダー
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}