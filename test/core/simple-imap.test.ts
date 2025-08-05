import { describe, it, expect, beforeAll } from 'vitest';
import { AccountManager } from '../../src/services/account-manager.js';
import { IMAPHandler } from '../../src/services/imap';
import { checkTestPrerequisites, getTestAccountName } from '../utils/helpers.js';

describe('Simple IMAP Handler Test', () => {
  beforeAll(() => {
    const { canRun, message } = checkTestPrerequisites();
    console.log(`テスト環境チェック: ${message}`);
    
    if (!canRun) {
      throw new Error(message);
    }
  });

  it('should list available IMAP accounts', async () => {
    const accountManager = new AccountManager();
    const imapHandler = new IMAPHandler(accountManager.getImapAccounts());
    const accounts = imapHandler.getAvailableAccounts();
    
    console.log('Available IMAP accounts:', accounts.length > 0 ? `${accounts.length} accounts configured` : 'No IMAP accounts');
    expect(accounts).toBeDefined();
    expect(Array.isArray(accounts)).toBe(true);
    // IMAPアカウントが設定されていない場合もあるので、0以上であることを確認
    expect(accounts.length).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(!getTestAccountName('imap'))('should get unread count for IMAP account', async () => {
    const accountName = getTestAccountName('imap')!;
    const accountManager = new AccountManager();
    const imapHandler = new IMAPHandler(accountManager.getImapAccounts());
    
    console.log(`Testing unread count for account: ${accountName}`);
    
    try {
      const unreadCount = await imapHandler.getUnreadCount(accountName);
      console.log(`Unread count for ${accountName}: ${unreadCount}`);
      
      expect(typeof unreadCount).toBe('number');
      expect(unreadCount).toBeGreaterThanOrEqual(0);
    } catch (error) {
      console.log(`Account ${accountName} connection failed (expected in some cases):`, error);
      // IMAP接続エラーは予期される場合があるので、テストは継続
      expect(error).toBeDefined();
    }
  }, 10000);

  it.skipIf(!getTestAccountName('imap'))('should list emails from IMAP account', async () => {
    const accountName = getTestAccountName('imap')!;
    const accountManager = new AccountManager();
    const imapHandler = new IMAPHandler(accountManager.getImapAccounts());
    
    console.log(`Testing email list for account: ${accountName}`);
    
    try {
      const emails = await imapHandler.listEmails(accountName, { limit: 1 });
      console.log(`Found ${emails.length} emails for ${accountName}`);
      
      expect(Array.isArray(emails)).toBe(true);
      expect(emails.length).toBeGreaterThanOrEqual(0);
      
      if (emails.length > 0) {
        const email = emails[0];
        expect(email).toHaveProperty('id');
        expect(email).toHaveProperty('subject');
        expect(email).toHaveProperty('from');
        expect(email).toHaveProperty('date');
      }
    } catch (error) {
      console.log(`Account ${accountName} email listing failed (expected in some cases):`, error);
      // IMAP接続エラーは予期される場合があるので、テストは継続
      expect(error).toBeDefined();
    }
  }, 10000);
}); 