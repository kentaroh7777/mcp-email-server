import { loadAccounts } from '../config/account-loader';
import { Account, GmailAccount, ImapAccount } from '../types';

export class AccountManager {
  private accounts: Account[];

  constructor() {
    this.accounts = loadAccounts();
  }

  public getAllAccounts(): Account[] {
    return this.accounts;
  }

  public getGmailAccounts(): GmailAccount[] {
    return this.accounts.filter(acc => acc.type === 'gmail') as GmailAccount[];
  }

  public getImapAccounts(): ImapAccount[] {
    return this.accounts.filter(acc => acc.type === 'imap') as ImapAccount[];
  }

  public getAccount(name: string): Account | undefined {
    return this.accounts.find(acc => acc.name === name);
  }
}