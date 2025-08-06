// 設計書Line 89-111, 104-111対応 - ConnectionManager実装
// 設計書の詳細を反映した実装コード

import { GmailHandler } from './services/gmail.js';
import { ImapFlowHandler } from './services/imapflow-handler.js';
import { AccountManager } from './services/account-manager.js';
import { ConnectionLogger } from './connection-logger.js';
import { ConnectionResult, PoolStatusInfo, ConnectionManagerInterface } from './types/connection.js';

export class ConnectionManager implements ConnectionManagerInterface {
  private gmailPool: Map<string, GmailHandler> = new Map();
  private imapPool: Map<string, ImapFlowHandler> = new Map();
  private accountManager: AccountManager;
  private logger: ConnectionLogger;
  
  constructor(accountManager: AccountManager) {
    this.accountManager = accountManager;
    this.logger = ConnectionLogger.getInstance();
    // 設計書Step 1: McpEmailServer起動 → ConnectionManager初期化 → 空プール作成
    this.logger.logPoolStatus(0, 0);
  }
  
  // 設計書データフロー Step 2-3 実装
  async getGmailHandler(accountName: string): Promise<GmailHandler> {
    // プール確認 → 未接続なら新規作成 → プールに保存
    if (this.gmailPool.has(accountName)) {
      this.logger.logConnectionEvent('REUSE', accountName, 'gmail');
      return this.gmailPool.get(accountName)!;
    }
    
    // 新規作成
    const account = this.accountManager.getAccount(accountName);
    if (!account || account.type !== 'gmail') {
      throw new Error(`Gmail account not found: ${accountName}`);
    }
    
    const handler = new GmailHandler([account]);
    this.gmailPool.set(accountName, handler);
    this.logger.logConnectionEvent('CREATE', accountName, 'gmail');
    this.logger.logPoolStatus(this.gmailPool.size, this.imapPool.size);
    
    return handler;
  }
  
  async getImapHandler(accountName: string): Promise<ImapFlowHandler> {
    // プール確認 → 未接続なら新規作成 → プールに保存
    if (this.imapPool.has(accountName)) {
      this.logger.logConnectionEvent('REUSE', accountName, 'imap');
      return this.imapPool.get(accountName)!;
    }
    
    // 新規作成
    const account = this.accountManager.getAccount(accountName);
    if (!account || account.type !== 'imap') {
      throw new Error(`IMAP account not found: ${accountName}`);
    }
    
    const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
    const handler = new ImapFlowHandler([account], encryptionKey);
    this.imapPool.set(accountName, handler);
    this.logger.logConnectionEvent('CREATE', accountName, 'imap');
    this.logger.logPoolStatus(this.gmailPool.size, this.imapPool.size);
    
    return handler;
  }

  // 設計書Line 31-34 対応 - 統一testConnection実装
  // 設計書: 入力: accountName → 処理: アカウント種別自動判定 → 適切なハンドラー取得 → 接続テスト → 出力: 統一形式の接続結果
  async testConnection(accountName: string): Promise<ConnectionResult> {
    try {
      const account = this.accountManager.getAccount(accountName);
      if (!account) {
        const result: ConnectionResult = {
          success: false,
          accountName,
          accountType: 'gmail', // デフォルト値
          message: `Account not found: ${accountName}`
        };
        this.logger.logConnectionError(accountName, 'testConnection', new Error(result.message));
        return result;
      }
      
      // アカウント種別自動判定 → 適切なハンドラー取得 → 接続テスト
      if (account.type === 'gmail') {
        const handler = await this.getGmailHandler(accountName);
        await handler.testConnection(accountName);
        return {
          success: true,
          accountName,
          accountType: 'gmail',
          message: 'Gmail connection test successful'
        };
      } else if (account.type === 'imap') {
        const handler = await this.getImapHandler(accountName);
        await handler.testConnection(accountName);
        return {
          success: true,
          accountName,
          accountType: 'imap',
          message: 'IMAP connection test successful'
        };
      } else {
        // TypeScript exhaustiveness check - この分岐は理論的には到達不可能
        const result: ConnectionResult = {
          success: false,
          accountName,
          accountType: 'gmail', // フォールバック値
          message: `Unsupported account type: ${(account as any).type}`
        };
        this.logger.logConnectionError(accountName, 'testConnection', new Error(result.message));
        return result;
      }
    } catch (error: any) {
      const account = this.accountManager.getAccount(accountName);
      const accountType = (account?.type === 'gmail' || account?.type === 'imap') ? account.type : 'gmail';
      const result: ConnectionResult = {
        success: false,
        accountName,
        accountType,
        message: `Connection test failed: ${error.message}`
      };
      this.logger.logConnectionError(accountName, 'testConnection', error);
      return result;
    }
  }

  // 設計書Line 94 対応 - リソース管理機能実装
  // 設計書: セッション終了 → ConnectionManager.cleanup() → 全接続破棄
  async cleanup(): Promise<void> {
    try {
      // IMAP接続のクリーンアップ（ImapFlowHandlerにはcleanupメソッドがないため、プールからの削除のみ）
      for (const accountName of this.imapPool.keys()) {
        this.logger.logConnectionEvent('CLEANUP', accountName, 'imap');
      }
      
      // Gmail接続は特別なクリーンアップ不要（HTTPベース）
      for (const accountName of this.gmailPool.keys()) {
        this.logger.logConnectionEvent('CLEANUP', accountName, 'gmail');
      }
      
      // プールクリア
      this.gmailPool.clear();
      this.imapPool.clear();
      this.logger.logPoolStatus(0, 0);
    } catch (error: any) {
      this.logger.logConnectionError('ALL', 'cleanup', error);
      throw error;
    }
  }

  getPoolStatus(): PoolStatusInfo {
    return {
      gmail: {
        active: this.gmailPool.size,
        accounts: Array.from(this.gmailPool.keys())
      },
      imap: {
        active: this.imapPool.size,
        accounts: Array.from(this.imapPool.keys())
      }
    };
  }
}