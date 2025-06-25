import { IMAPConfig, EmailMessage, EmailDetail, ListEmailsParams, Tool } from './types';
export declare class IMAPHandler {
    private encryptionKey;
    private connections;
    constructor(encryptionKey?: string);
    private loadIMAPConfigs;
    addAccount(accountName: string, config: IMAPConfig): void;
    private getConnection;
    private openBox;
    listEmails(accountName: string, params?: ListEmailsParams): Promise<EmailMessage[]>;
    searchEmails(accountName: string, query: string, limit?: number): Promise<EmailMessage[]>;
    getEmailDetail(accountName: string, emailId: string): Promise<EmailDetail>;
    getUnreadCount(accountName: string, folder?: string): Promise<number>;
    private parseHeaders;
    private hasAttachments;
    private extractAttachments;
    private extractTextFromBody;
    getAvailableAccounts(): string[];
    addXServerAccount(accountName: string, domain: string, username: string, encryptedPassword: string): void;
}
export declare const imapTools: Tool[];
