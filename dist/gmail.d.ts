import { gmail_v1 } from 'googleapis';
import { EmailMessage, EmailDetail, ListEmailsParams, Tool } from './types.js';
export declare class GmailHandler {
    private configs;
    constructor();
    private loadGmailConfigs;
    authenticate(accountName: string): Promise<gmail_v1.Gmail>;
    listEmails(accountName: string, params: ListEmailsParams): Promise<EmailMessage[]>;
    searchEmails(accountName: string, query: string, limit: number): Promise<EmailMessage[]>;
    getEmailDetail(accountName: string, emailId: string): Promise<EmailDetail>;
    getUnreadCount(accountName: string, folder?: string): Promise<number>;
    getAvailableAccounts(): string[];
    private formatEmailMessage;
    private formatEmailDetail;
    private extractEmailBody;
    private extractAttachments;
}
export declare const gmailTools: Tool[];
