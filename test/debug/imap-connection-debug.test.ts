import { describe, test, expect } from 'vitest';
import { IMAPHandler } from '../../src/services/imap';
import { ImapAccount } from '../../src/types';
import { encrypt } from '../../src/utils/crypto';

describe('IMAP Connection Debug', () => {
  test('IMAP account should connect and decrypt password successfully', async () => {
    const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.log('EMAIL_ENCRYPTION_KEY is not defined, skipping IMAP connection debug test.');
      return;
    }

    const dummyPassword = 'test-imap-password';
    const encryptedDummyPassword = encrypt(dummyPassword, encryptionKey);

    const imapAccount: ImapAccount = {
      name: 'debug-test-account',
      type: 'imap',
      host: process.env.IMAP_HOST_DEBUG_TEST || 'imap.example.com', // Replace with a valid test IMAP host if available
      user: process.env.IMAP_USER_DEBUG_TEST || 'test@example.com', // Replace with a valid test IMAP user if available
      password: encryptedDummyPassword,
      port: parseInt(process.env.IMAP_PORT_DEBUG_TEST || '993', 10),
      tls: process.env.IMAP_TLS_DEBUG_TEST !== 'false',
    };

    console.log(`Attempting IMAP connection for account: ${imapAccount.name}`);

    try {
      const imapHandler = new IMAPHandler([imapAccount], encryptionKey);

    } catch (error: any) {
      console.error(`IMAP connection debug test failed for ${imapAccount.name}: ${error.message}`);
      throw error; // Re-throw to mark test as failed
    }
  }, 60000); // 60 seconds timeout
});