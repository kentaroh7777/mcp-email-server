import { gmail_v1 } from 'googleapis';
import { EmailMessage, EmailDetail, ListEmailsParams, Tool } from './types.js';
export declare class GmailHandler {
    private configs;
    private readonly DEFAULT_TIMEOUT;
    private readonly gmailTimeout;
    private readonly defaultTimezone;
    constructor();
    private detectTimezone;
    private loadGmailConfigs;
    authenticate(accountName: string): Promise<gmail_v1.Gmail>;
    listEmails(accountName: string, params: ListEmailsParams): Promise<EmailMessage[]>;
    searchEmails(accountName: string, query: string, limit: number, dateAfter?: string, dateBefore?: string): Promise<EmailMessage[]>;
    getEmailDetail(accountName: string, emailId: string): Promise<EmailDetail>;
    getUnreadCount(accountName: string, folder?: string): Promise<number>;
    getAvailableAccounts(): string[];
    private parseDateTime;
    private formatEmailMessage;
    private formatEmailDetail;
    private extractEmailBody;
    private extractAttachments;
    archiveEmail(accountName: string, emailId: string, removeUnread?: boolean): Promise<boolean>;
}
export declare const gmailTools: Tool[];
