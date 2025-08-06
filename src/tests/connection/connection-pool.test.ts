import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConnectionManager } from '../../connection-manager.js'
import { AccountManager } from '../../services/account-manager.js'

// モック設定
vi.mock('../../services/gmail.js')
vi.mock('../../services/imapflow-handler.js')

// ConnectionLoggerのモック設定
vi.mock('../../connection-logger.js', () => {
  return {
    ConnectionLogger: {
      getInstance: vi.fn(() => ({
        logPoolStatus: vi.fn(),
        logConnectionEvent: vi.fn(),
        logConnectionError: vi.fn()
      }))
    }
  };
})

describe('Connection Pool Management', () => {
  let connectionManager: ConnectionManager;
  let accountManager: AccountManager;

  beforeEach(() => {
    accountManager = new AccountManager();
    connectionManager = new ConnectionManager(accountManager);
  });

  it('should maintain separate pools for Gmail and IMAP', async () => {
    // Gmail/IMAP接続プールの分離確認
    vi.spyOn(accountManager, 'getAccount')
      .mockReturnValueOnce({ 
        name: 'gmail1', 
        type: 'gmail', 
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token'
      })
      .mockReturnValueOnce({ 
        name: 'imap1', 
        type: 'imap', 
        host: 'imap.example.com',
        port: 993,
        tls: true,
        user: 'test@example.com',
        password: 'password'
      });

    await connectionManager.getGmailHandler('gmail1');
    await connectionManager.getImapHandler('imap1');

    const status = connectionManager.getPoolStatus();
    expect(status.gmail.active).toBe(1);
    expect(status.imap.active).toBe(1);
    expect(status.gmail.accounts).toContain('gmail1');
    expect(status.imap.accounts).toContain('imap1');
  });

  it('should handle concurrent connection requests safely', async () => {
    // 並行接続リクエストの安全な処理
    vi.spyOn(accountManager, 'getAccount').mockReturnValue({
      name: 'test_account',
      type: 'gmail',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token'
    });

    const promises = [
      connectionManager.getGmailHandler('test_account'),
      connectionManager.getGmailHandler('test_account'),
      connectionManager.getGmailHandler('test_account')
    ];

    const handlers = await Promise.all(promises);
    expect(handlers[0]).toBe(handlers[1]);
    expect(handlers[1]).toBe(handlers[2]);

    const status = connectionManager.getPoolStatus();
    expect(status.gmail.active).toBe(1); // 1つのハンドラーのみ作成
  });

  it('should handle mixed concurrent requests for different account types', async () => {
    // 異なるアカウントタイプでの並行リクエスト処理
    vi.spyOn(accountManager, 'getAccount')
      .mockImplementation((name: string) => {
        if (name === 'gmail_account') {
          return {
            name: 'gmail_account',
            type: 'gmail',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            refreshToken: 'test-refresh-token'
          };
        } else if (name === 'imap_account') {
          return {
            name: 'imap_account',
            type: 'imap',
            host: 'imap.example.com',
            port: 993,
            tls: true,
            user: 'test@example.com',
            password: 'password'
          };
        }
        return undefined;
      });

    const promises = [
      connectionManager.getGmailHandler('gmail_account'),
      connectionManager.getImapHandler('imap_account'),
      connectionManager.getGmailHandler('gmail_account'), // 再利用
      connectionManager.getImapHandler('imap_account')    // 再利用
    ];

    const handlers = await Promise.all(promises);
    
    // 同じアカウントのハンドラーは同じインスタンス
    expect(handlers[0]).toBe(handlers[2]); // Gmail handlers
    expect(handlers[1]).toBe(handlers[3]); // IMAP handlers

    const status = connectionManager.getPoolStatus();
    expect(status.gmail.active).toBe(1);
    expect(status.imap.active).toBe(1);
  });

  it('should handle multiple accounts of the same type', async () => {
    // 同一タイプの複数アカウント管理
    vi.spyOn(accountManager, 'getAccount')
      .mockImplementation((name: string) => {
        if (name === 'gmail1') {
          return {
            name: 'gmail1',
            type: 'gmail',
            clientId: 'test-client-id-1',
            clientSecret: 'test-client-secret-1',
            refreshToken: 'test-refresh-token-1'
          };
        } else if (name === 'gmail2') {
          return {
            name: 'gmail2',
            type: 'gmail',
            clientId: 'test-client-id-2',
            clientSecret: 'test-client-secret-2',
            refreshToken: 'test-refresh-token-2'
          };
        }
        return undefined;
      });

    await connectionManager.getGmailHandler('gmail1');
    await connectionManager.getGmailHandler('gmail2');

    const status = connectionManager.getPoolStatus();
    expect(status.gmail.active).toBe(2);
    expect(status.gmail.accounts).toContain('gmail1');
    expect(status.gmail.accounts).toContain('gmail2');
  });

  it('should properly cleanup pools and reset counts', async () => {
    // プールクリーンアップと数値リセットの確認
    vi.spyOn(accountManager, 'getAccount')
      .mockImplementation((name: string) => {
        if (name.startsWith('gmail')) {
          return {
            name,
            type: 'gmail',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            refreshToken: 'test-refresh-token'
          };
        } else if (name.startsWith('imap')) {
          return {
            name,
            type: 'imap',
            host: 'imap.example.com',
            port: 993,
            tls: true,
            user: 'test@example.com',
            password: 'password'
          };
        }
        return undefined;
      });

    // 複数の接続を作成
    await connectionManager.getGmailHandler('gmail1');
    await connectionManager.getGmailHandler('gmail2');
    await connectionManager.getImapHandler('imap1');

    const statusBefore = connectionManager.getPoolStatus();
    expect(statusBefore.gmail.active).toBe(2);
    expect(statusBefore.imap.active).toBe(1);

    // クリーンアップ実行
    await connectionManager.cleanup();

    const statusAfter = connectionManager.getPoolStatus();
    expect(statusAfter.gmail.active).toBe(0);
    expect(statusAfter.imap.active).toBe(0);
    expect(statusAfter.gmail.accounts).toHaveLength(0);
    expect(statusAfter.imap.accounts).toHaveLength(0);
  });

  it('should handle pool reinitialization after cleanup', async () => {
    // クリーンアップ後のプール再初期化
    vi.spyOn(accountManager, 'getAccount').mockReturnValue({
      name: 'test_account',
      type: 'gmail',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token'
    });

    // 最初の接続作成とクリーンアップ
    await connectionManager.getGmailHandler('test_account');
    expect(connectionManager.getPoolStatus().gmail.active).toBe(1);
    
    await connectionManager.cleanup();
    expect(connectionManager.getPoolStatus().gmail.active).toBe(0);

    // 再度接続作成
    await connectionManager.getGmailHandler('test_account');
    expect(connectionManager.getPoolStatus().gmail.active).toBe(1);
  });

  it('should return unique instances for different account names', async () => {
    // 異なるアカウント名での一意インスタンス確認
    vi.spyOn(accountManager, 'getAccount')
      .mockImplementation((name: string) => ({
        name,
        type: 'gmail',
        clientId: `client-id-${name}`,
        clientSecret: `client-secret-${name}`,
        refreshToken: `refresh-token-${name}`
      }));

    const handler1 = await connectionManager.getGmailHandler('account1');
    const handler2 = await connectionManager.getGmailHandler('account2');
    const handler3 = await connectionManager.getGmailHandler('account1'); // 再利用

    expect(handler1).not.toBe(handler2); // 異なるアカウントは異なるインスタンス
    expect(handler1).toBe(handler3);     // 同じアカウントは同じインスタンス

    const status = connectionManager.getPoolStatus();
    expect(status.gmail.active).toBe(2); // account1, account2
    expect(status.gmail.accounts).toContain('account1');
    expect(status.gmail.accounts).toContain('account2');
  });
});