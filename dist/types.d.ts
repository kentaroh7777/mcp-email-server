export interface MCPRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: any;
}
export interface MCPResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: MCPError;
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
export interface EmailAccount {
    id: string;
    name: string;
    type: 'gmail' | 'imap';
    config: GmailConfig | IMAPConfig;
}
export interface InitializeResult {
    protocolVersion: string;
    capabilities: {
        tools?: {
            listChanged?: boolean;
        };
        resources?: {
            subscribe?: boolean;
            listChanged?: boolean;
        };
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
    };
}
export interface EmailMessage {
    id: string;
    accountName: string;
    accountType: 'gmail' | 'imap';
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
