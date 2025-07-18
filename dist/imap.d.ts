import { IMAPConfig, EmailMessage, EmailDetail, ListEmailsParams, Tool, SendEmailParams, SendEmailResult } from './types.js';
export declare class IMAPHandler {
    private encryptionKey;
    private connections;
    private connectionPool;
    private smtpConfigs;
    private readonly DEFAULT_TIMEOUT;
    private readonly connectionTimeout;
    private readonly operationTimeout;
    constructor(encryptionKey?: string);
    private loadIMAPConfigs;
    private loadSMTPConfig;
    private loadXServerSMTPConfig;
    addAccount(accountName: string, config: IMAPConfig): void;
    private getConnection;
    private createConnection;
    private openBox;
    listEmails(accountName: string, params?: ListEmailsParams): Promise<EmailMessage[]>;
    searchEmails(accountName: string, query: string, limit?: number): Promise<EmailMessage[]>;
    getEmailDetail(accountName: string, emailId: string): Promise<EmailDetail>;
    getUnreadCount(accountName: string, folder?: string): Promise<number>;
    private parseHeaders;
    private hasAttachments;
    private extractAttachments;
    private extractTextFromBody;
    archiveEmail(accountName: string, emailId: string, removeUnread?: boolean): Promise<boolean>;
    getAvailableAccounts(): string[];
    addXServerAccount(accountName: string, server: string, domain: string, username: string, encryptedPassword: string): void;
    sendEmail(accountName: string, params: SendEmailParams): Promise<SendEmailResult>;
}
export declare const imapTools: Tool[];
