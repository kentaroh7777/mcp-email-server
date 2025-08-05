import { describe, test, expect } from 'vitest';
import { IMAPHandler } from '../../src/services/imap';
import { AccountManager } from '../../src/services/account-manager';

describe('IMAP Connection Debug', () => {
  test('IMAP account should connect and decrypt password successfully', async () => {
    const accountManager = new AccountManager();
    const imapAccounts = accountManager.getImapAccounts();

    if (imapAccounts.length === 0) {
      console.log('No IMAP accounts configured, skipping IMAP connection debug test.');
      return;
    }

    const imapAccount = imapAccounts[0]; // Use the first configured IMAP account
    console.log(`Attempting IMAP connection for account: ${imapAccount.name}`);

    try {
      // Pass the encryption key explicitly to IMAPHandler
      const imapHandler = new IMAPHandler([imapAccount], process.env.EMAIL_ENCRYPTION_KEY);
      console.log(`Debug: imapAccount.password = ${imapAccount.password}`);
      console.log(`Debug: process.env.EMAIL_ENCRYPTION_KEY = ${process.env.EMAIL_ENCRYPTION_KEY}`);
      
      // Attempt to get a connection, which involves decryption
      const imapConnection = await (imapHandler as any).getConnection(imapAccount.name);
      
      expect(imapConnection).toBeDefined();
      console.log(`Successfully connected to IMAP account: ${imapAccount.name}`);
      
      // Clean up connection
      imapConnection.end();

    } catch (error: any) {
      console.error(`IMAP connection debug test failed for ${imapAccount.name}: ${error.message}`);
      throw error; // Re-throw to mark test as failed
    }
  }, 60000); // 60 seconds timeout
});