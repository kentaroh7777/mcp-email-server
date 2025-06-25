import { MCPRequest, MCPResponse } from './types';
export declare class MCPEmailServer {
    private gmailHandler;
    private imapHandler;
    private encryptionKey;
    constructor();
    handleRequest(request: MCPRequest): Promise<MCPResponse>;
    private handleInitialize;
    private handleToolsList;
    private handleToolsCall;
    private handleResourcesList;
    private handleListEmails;
    private handleSearchEmails;
    private handleGetEmailDetail;
    private handleGetUnreadCount;
    private getAllGmailEmails;
    private createResponse;
    private handleListImapEmails;
    private handleSearchImapEmails;
    private handleGetImapEmailDetail;
    private handleGetImapUnreadCount;
    addImapAccount(accountName: string, host: string, port: number, secure: boolean, user: string, encryptedPassword: string): void;
    addXServerAccount(accountName: string, domain: string, username: string, encryptedPassword: string): void;
    private handleListAccounts;
    private handleTestConnection;
    private handleSearchAllEmails;
    private handleGetAccountStats;
}
