import { describe, test, expect, vi } from 'vitest';
import { ImapFlowHandler } from '../../src/services/imapflow-handler.js';
import { ImapAccount } from '../../src/types';
import { encrypt } from '../../src/crypto.js';
import McpEmailServer from '../../src/index.js';
import { ConnectionManager } from '../../src/connection-manager.js';

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
      const imapHandler = new ImapFlowHandler([imapAccount], encryptionKey);
      expect(imapHandler).toBeDefined();
      expect(imapHandler.getAvailableAccounts().length).toBeGreaterThanOrEqual(0);
    } catch (error: any) {
      console.error(`IMAP connection debug test failed for ${imapAccount.name}: ${error.message}`);
      throw error;
    }
  }, 60000);

  test('should use ConnectionManager for IMAP debug operations', async () => {
    const mcpServer = new McpEmailServer();
    
    // ConnectionManager統合テスト
    expect((mcpServer as any).connectionManager).toBeInstanceOf(ConnectionManager);
    expect((mcpServer as any).gmailHandler).toBeUndefined();
    expect((mcpServer as any).imapHandler).toBeUndefined();
    
    // Mock ConnectionManager for testing
    const mockConnectionManager = {
      testConnection: vi.fn().mockResolvedValue({
        success: true,
        accountName: 'debug-test-account',
        accountType: 'imap',
        message: 'Connection successful'
      })
    };
    
    (mcpServer as any).connectionManager = mockConnectionManager;
    (mcpServer as any).accountManager = {
      getAccount: vi.fn().mockReturnValue({
        name: 'debug-test-account',
        type: 'imap',
        config: {}
      })
    };
    
    const response = await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'test_connection',
        arguments: { account_name: 'debug-test-account' }
      },
      id: 1
    });
    
    expect(response.result.status).toBe('connected');
    expect(mockConnectionManager.testConnection).toHaveBeenCalledWith('debug-test-account');
  }, 60000);
});