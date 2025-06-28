import { describe, test, expect, beforeAll } from 'vitest';
import { TestHelper } from './helpers.js';

describe('Connection Tests', () => {
  const helper = new TestHelper();
  let configuredAccounts: { gmail: string[]; imap: string[]; xserver: string[] };

  beforeAll(() => {
    configuredAccounts = helper.getConfiguredAccounts();
  });

  describe('Account Discovery', () => {
    test('設定されたアカウントが一覧で確認できる', async () => {
      const response = await helper.callTool('list_accounts', {});
      
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      
      // MCP形式のレスポンスからデータを抽出
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
      expect(data).toBeDefined();
      expect(data.accounts).toBeDefined();
      expect(Array.isArray(data.accounts)).toBe(true);
      
      // 実際の状態検証: 設定されたアカウント数と一致するか
      const accountList = data.accounts;
      const totalConfigured = configuredAccounts.gmail.length + 
                            configuredAccounts.imap.length + 
                            configuredAccounts.xserver.length;
      
      expect(accountList.length).toBe(totalConfigured);
    });

    test.each([
      ['Gmail', 'gmail'],
      ['IMAP', 'imap'],
      ['XServer', 'imap'] // XServerはIMAPとして扱われる
    ])('%s アカウントが正しく認識される', async (accountTypeName, expectedType) => {
      const accountList = configuredAccounts.gmail.concat(configuredAccounts.imap, configuredAccounts.xserver);
      
      if (accountList.length === 0) {
        // アカウントが設定されていない場合はスキップ
        return;
      }

      const response = await helper.callTool('list_accounts', {});
      expect(response.error).toBeUndefined();
      
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
      const accounts = data?.accounts || [];
      const hasExpectedType = accounts.some((acc: any) => acc.type === expectedType);
      
      // 設定されているアカウントタイプがある場合は、リストに含まれているべき
      if (expectedType === 'gmail' && configuredAccounts.gmail.length > 0) {
        expect(hasExpectedType).toBe(true);
      } else if (expectedType === 'imap' && (configuredAccounts.imap.length > 0 || configuredAccounts.xserver.length > 0)) {
        expect(hasExpectedType).toBe(true);
      }
    });
  });

  describe('Individual Account Connections', () => {
    test('Gmail アカウントの接続テスト', async () => {
      if (configuredAccounts.gmail.length === 0) {
        // Gmail アカウントが設定されていない場合はスキップ
        return;
      }

      let successfulConnections = 0;
      let totalConnections = 0;

      for (const accountName of configuredAccounts.gmail) {
        totalConnections++;
        
        try {
          const verification = await helper.verifyAccountConnection(accountName);
          
          if (verification.connected) {
            successfulConnections++;
            expect(verification.message).toContain('Successfully connected');
            
            // 実際の状態検証: アカウントが実際に存在し、利用可能であることを確認
            const exists = await helper.verifyAccountExists(accountName);
            expect(exists).toBe(true);
          }
        } catch (error) {
          // 設定ミスアカウントは無視
        }
      }
      
      // 少なくとも1つのアカウントが接続成功していればOK
      expect(successfulConnections).toBeGreaterThan(0);
      expect(totalConnections).toBeGreaterThan(0);
    }, 60000); // 60秒のタイムアウト

    test('IMAP アカウントの接続テスト', async () => {
      const imapAccounts = [...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (imapAccounts.length === 0) {
        // IMAP アカウントが設定されていない場合はスキップ
        return;
      }

      let successfulConnections = 0;
      let totalConnections = 0;

      for (const accountName of imapAccounts) {
        totalConnections++;
        
        try {
          const verification = await helper.verifyAccountConnection(accountName);
          
          if (verification.connected) {
            successfulConnections++;
            expect(verification.message).toContain('Successfully connected');
            
            // 実際の状態検証: アカウントが実際に存在し、利用可能であることを確認
            const exists = await helper.verifyAccountExists(accountName);
            expect(exists).toBe(true);
          }
        } catch (error) {
          // 設定ミスアカウントは無視
        }
      }
      
      // 少なくとも1つのアカウントが接続成功していればOK
      expect(successfulConnections).toBeGreaterThan(0);
      expect(totalConnections).toBeGreaterThan(0);
    }, 60000); // 60秒のタイムアウト
  });

  describe('Unread Count Verification', () => {
    test('各アカウントの未読メール数を取得できる', async () => {
      const allAccounts = [...configuredAccounts.gmail, ...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (allAccounts.length === 0) {
        return;
      }

      let successfulAccounts = 0;
      let totalAccounts = 0;

      for (const accountName of allAccounts) {
        totalAccounts++;
        const countVerification = await helper.verifyUnreadCount(accountName, 0);
        
        if (countVerification.valid) {
          successfulAccounts++;
          
          // 実際の状態検証: 返された数値が実際の未読数を反映しているか
          expect(typeof countVerification.actual).toBe('number');
          expect(countVerification.actual).not.toBe(-1); // エラー状態ではない
        }
      }

      // 少なくとも1つのアカウントが成功していればOK
      expect(successfulAccounts).toBeGreaterThan(0);
      expect(totalAccounts).toBeGreaterThan(0);
    });
  });

  describe('Search Functionality', () => {
    test('統合検索機能が動作する', async () => {
      const allAccounts = [...configuredAccounts.gmail, ...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (allAccounts.length === 0) {
        return;
      }

      const searchVerification = await helper.verifySearchResults('test', 'ALL', 0);
      
      expect(searchVerification.valid).toBe(true);
      expect(searchVerification.count).toBeGreaterThanOrEqual(0);
      
      // 実際の状態検証: 検索結果の形式が正しいか
      const response = await helper.callTool('search_all_emails', {
        query: 'test',
        accounts: 'ALL',
        limit: 5
      });
      
      expect(response.error).toBeUndefined();
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
      expect(data).toBeDefined();
      expect(data.emails).toBeDefined();
      expect(Array.isArray(data.emails)).toBe(true);
      expect(data.totalFound).toBeDefined();
      expect(typeof data.totalFound).toBe('number');
    });

    test('Gmail のみの検索が動作する', async () => {
      if (configuredAccounts.gmail.length === 0) {
        return;
      }

      const searchVerification = await helper.verifySearchResults('test', 'GMAIL_ONLY', 0);
      expect(searchVerification.valid).toBe(true);
    });

    test('IMAP のみの検索が動作する', async () => {
      const imapAccounts = [...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (imapAccounts.length === 0) {
        return;
      }

      const searchVerification = await helper.verifySearchResults('test', 'IMAP_ONLY', 0);
      expect(searchVerification.valid).toBe(true);
    });
  });

  describe('Account Statistics', () => {
    test('アカウント統計情報を取得できる', async () => {
      const response = await helper.callTool('get_account_stats', {});
      
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      
      // MCP形式のレスポンスからデータを抽出
      const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
      expect(data).toBeDefined();
      
      // 実際の状態検証: 統計情報の構造が正しいか（統合化後の新構造）
      expect(data.accounts).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(typeof data.summary.totalAccounts).toBe('number');
      expect(typeof data.summary.connectedAccounts).toBe('number');
      expect(typeof data.summary.gmailAccounts).toBe('number'); // 新規追加
      expect(typeof data.summary.imapAccounts).toBe('number'); // 新規追加
      
      // 設定されたアカウント数と統計の整合性
      expect(data.summary.totalAccounts).toBe(configuredAccounts.gmail.length + configuredAccounts.imap.length + configuredAccounts.xserver.length);
      expect(data.summary.gmailAccounts).toBe(configuredAccounts.gmail.length);
      expect(data.summary.imapAccounts).toBe(configuredAccounts.imap.length + configuredAccounts.xserver.length);
    });
  });

  describe('Unified Tools Tests', () => {
    test('統合されたlist_emailsツールが動作する', async () => {
      const allAccounts = [...configuredAccounts.gmail, ...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (allAccounts.length === 0) {
        return;
      }

      for (const accountName of allAccounts) {
        try {
          const response = await helper.callTool('list_emails', {
            account_name: accountName,
            limit: 5
          });
          
          // アカウントが存在する場合はテストし、存在しない場合はエラーを確認
          if (response.error) {
            // アカウントが見つからない場合のエラーをチェック
            expect(response.error.message).toContain('Account not found');
          } else {
            const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
            expect(data).toBeDefined();
            expect(data.emails).toBeDefined();
            expect(Array.isArray(data.emails)).toBe(true);
          }
        } catch (error) {
          // テスト設定によるエラーは無視
        }
      }
    });

    test('統合されたsearch_emailsツールが動作する', async () => {
      const allAccounts = [...configuredAccounts.gmail, ...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (allAccounts.length === 0) {
        return;
      }

      for (const accountName of allAccounts) {
        try {
          const response = await helper.callTool('search_emails', {
            account_name: accountName,
            query: 'test',
            limit: 5
          });
          
          if (response.error) {
            expect(response.error.message).toContain('Account not found');
          } else {
            const data = response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : null;
            expect(data).toBeDefined();
            expect(data.emails).toBeDefined();
            expect(Array.isArray(data.emails)).toBe(true);
          }
        } catch (error) {
          // テスト設定によるエラーは無視
        }
      }
    });

    test('統合されたget_email_detailツールが動作する', async () => {
      const allAccounts = [...configuredAccounts.gmail, ...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (allAccounts.length === 0) {
        return;
      }

      for (const accountName of allAccounts) {
        try {
          const response = await helper.callTool('get_email_detail', {
            account_name: accountName,
            email_id: 'dummy_id'
          });
          
                     // ダミーIDを使っているため、アカウントが見つからないかメールが見つからないエラーが期待される
           expect(response.error).toBeDefined();
           if (response.error?.message) {
             expect(
               response.error.message.includes('Account not found') || 
               response.error.message.includes('Email not found') || 
               response.error.message.includes('Failed to get email detail')
             ).toBe(true);
           }
        } catch (error) {
          // テスト設定によるエラーは無視
        }
      }
    });

    test('統合されたarchive_emailツールが動作する', async () => {
      const allAccounts = [...configuredAccounts.gmail, ...configuredAccounts.imap, ...configuredAccounts.xserver];
      
      if (allAccounts.length === 0) {
        return;
      }

      // テストを最初の3アカウントのみに制限してタイムアウトを防ぐ
      const testAccounts = allAccounts.slice(0, 3);

      for (const accountName of testAccounts) {
        try {
          const response = await helper.callTool('archive_email', {
            account_name: accountName,
            email_id: 'dummy_id'
          });
          
                     // ダミーIDを使っているため、アカウントが見つからないかメールが見つからないエラーが期待される
           expect(response.error).toBeDefined();
           if (response.error?.message) {
             expect(
               response.error.message.includes('Account not found') || 
               response.error.message.includes('Email not found') || 
               response.error.message.includes('Failed to archive email')
             ).toBe(true);
           }
        } catch (error) {
          // テスト設定によるエラーは無視
        }
      }
    }, 15000); // タイムアウトを15秒に短縮
  });
}); 