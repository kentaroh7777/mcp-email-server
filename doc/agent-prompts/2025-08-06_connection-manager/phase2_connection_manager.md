# Task 2: ConnectionManager実装

## 概要
Gmail/IMAP接続の統一管理を行うConnectionManagerクラスを実装し、重複インスタンス問題を解決する。Phase 1で拡張されたConnectionLoggerを活用した接続ログ記録も含む。

## 設計書詳細反映確認【新規必須セクション】
### 設計書参照箇所
- **設計書ファイル**: `doc/design/connection-manager.md`
- **参照セクション**: 4.1.1 ConnectionManager、4.2 データ構造設計
- **参照行数**: Line 100-158

### 設計書詳細の具体的反映

#### コード例（設計書から転記）
```typescript
// 設計書Line 104-111 から転記
interface ConnectionManager {
  getGmailHandler(accountName: string): Promise<GmailHandler>;
  getImapHandler(accountName: string): Promise<ImapFlowHandler>;
  testConnection(accountName: string): Promise<ConnectionResult>;
  cleanup(): Promise<void>;
  getPoolStatus(): PoolStatusInfo;
}

// 設計書Line 129-147 から転記
interface ConnectionResult {
  success: boolean;
  accountName: string;
  accountType: 'gmail' | 'imap';
  message: string;
}

interface PoolStatusInfo {
  gmail: {
    active: number;
    accounts: string[];
  };
  imap: {
    active: number;
    accounts: string[];
  };
}
```

#### 操作手順（設計書から転記）
1. **手順1**: ConnectionManagerクラスの基本構造実装
2. **手順2**: Gmail/IMAP接続プールの実装
3. **手順3**: 統一testConnection実装
4. **手順4**: ライフサイクル管理（cleanup）実装

#### 固有値・設定値（設計書から転記）
- **データフロー**: `McpEmailServer起動 → ConnectionManager初期化 → 空プール作成`
- **プール管理**: `プール確認 → 未接続なら新規作成 → プールに保存`
- **クリーンアップ**: `セッション終了 → ConnectionManager.cleanup() → 全接続破棄`

### 曖昧指示チェック
**以下の曖昧な指示を含まないことを確認**
- [x] "設計書を参照して実装"
- [x] "設計書通りに実装"
- [x] "～の実際のシナリオを実装"
- [x] "詳細は設計書を参照"

## 依存関係
- 本実装の元となる設計書: `doc/design/connection-manager.md`
- Phase 1の成果物: `src/connection-logger.ts` (ConnectionLoggerクラス)
- 既存ハンドラー: `src/services/gmail.ts` (GmailHandler), `src/services/imapflow-handler.ts` (ImapFlowHandler)
- アカウント管理: `src/services/account-manager.ts` (AccountManager)

### 前提条件
- Phase 1: ConnectionLoggerクラス実装完了 - ログ記録機能
- src/services/gmail.ts: GmailHandlerクラス - Gmail接続管理
- src/services/imapflow-handler.ts: ImapFlowHandlerクラス - IMAP接続管理
- src/services/account-manager.ts: AccountManagerクラス - アカウント設定管理

### 成果物
- `src/connection-manager.ts` - ConnectionManagerクラス実装（新規作成）
- `src/types/connection.ts` - 接続関連型定義（新規作成）

### テスト成果物【必須】
- **テストファイル**: `src/tests/connection/connection-manager.test.ts` - ConnectionManagerのテスト
- **テストファイル**: `src/tests/connection/connection-pool.test.ts` - 接続プール機能のテスト
- **vitest設定**: `vitest.config.ts` - テスト環境設定（Phase 1で設定済み）
- **npmテストスクリプト**: `package.json`の`scripts.test`設定確認

### 影響範囲
- src/connection-manager.ts - 新規作成
- src/types/connection.ts - 新規作成

## 実装要件
### 【必須制約】セッション毎初期化
- **接続プール管理**: セッション毎に接続プールを初期化、永続化なし
- **リソースクリーンアップ**: セッション終了時の確実なリソース解放

### 技術仕様
```typescript
// 型定義例（必須）
interface ConnectionManager {
  getGmailHandler(accountName: string): Promise<GmailHandler>;
  getImapHandler(accountName: string): Promise<ImapFlowHandler>;
  testConnection(accountName: string): Promise<ConnectionResult>;
  cleanup(): Promise<void>;
  getPoolStatus(): PoolStatusInfo;
}

interface ConnectionResult {
  success: boolean;
  accountName: string;
  accountType: 'gmail' | 'imap';
  message: string;
}

// 実装例（必須）
export class ConnectionManager {
  private gmailPool: Map<string, GmailHandler> = new Map();
  private imapPool: Map<string, ImapFlowHandler> = new Map();
  private accountManager: AccountManager;
  private logger: ConnectionLogger;
  
  constructor(accountManager: AccountManager) {
    this.accountManager = accountManager;
    this.logger = ConnectionLogger.getInstance();
  }
}
```

### 設計パターン
**参考**: `src/index.ts`の`McpEmailServer`クラスパターンを踏襲
**理由**: 既存のサーバー構造との整合性維持、依存性注入パターン活用

## 実装ガイド【設計書詳細反映必須】
### ステップ1: 型定義ファイル作成
**【設計書Line 129-147 対応】**
```typescript
// src/types/connection.ts
// 設計書から転記した具体的なコード

export interface ConnectionResult {
  success: boolean;
  accountName: string;
  accountType: 'gmail' | 'imap';
  message: string;
}

export interface PoolStatusInfo {
  gmail: {
    active: number;
    accounts: string[];
  };
  imap: {
    active: number;
    accounts: string[];
  };
}

export interface ConnectionManagerInterface {
  getGmailHandler(accountName: string): Promise<GmailHandler>;
  getImapHandler(accountName: string): Promise<ImapFlowHandler>;
  testConnection(accountName: string): Promise<ConnectionResult>;
  cleanup(): Promise<void>;
  getPoolStatus(): PoolStatusInfo;
}
```

### ステップ2: ConnectionManagerクラス基本実装
**【設計書Line 89-94, 104-111 対応】**
```typescript
// src/connection-manager.ts
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
    this.logger.logPoolStatus(0, 0); // 初期化ログ
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
}
```

### ステップ3: 統一testConnection実装
**【設計書Line 31-34 対応】**
```typescript
// ConnectionManagerクラスに追加
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
      const result: ConnectionResult = {
        success: false,
        accountName,
        accountType: account.type as 'gmail' | 'imap',
        message: `Unsupported account type: ${account.type}`
      };
      this.logger.logConnectionError(accountName, 'testConnection', new Error(result.message));
      return result;
    }
  } catch (error: any) {
    const account = this.accountManager.getAccount(accountName);
    const accountType = account?.type || 'gmail';
    const result: ConnectionResult = {
      success: false,
      accountName,
      accountType: accountType as 'gmail' | 'imap',
      message: `Connection test failed: ${error.message}`
    };
    this.logger.logConnectionError(accountName, 'testConnection', error);
    return result;
  }
}
```

### ステップ4: リソース管理機能実装
**【設計書Line 94 対応】**
```typescript
// ConnectionManagerクラスに追加
// 設計書: セッション終了 → ConnectionManager.cleanup() → 全接続破棄

async cleanup(): Promise<void> {
  try {
    // IMAP接続のクリーンアップ
    for (const [accountName, handler] of this.imapPool.entries()) {
      try {
        await handler.cleanup();
        this.logger.logConnectionEvent('CLEANUP', accountName, 'imap');
      } catch (error: any) {
        this.logger.logConnectionError(accountName, 'cleanup', error);
      }
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
```

### テスト環境構築【全プロジェクト必須】
#### ステップD: テストファイル作成
```typescript
// src/tests/connection/connection-manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConnectionManager } from '../../connection-manager.js'
import { AccountManager } from '../../services/account-manager.js'
import { GmailHandler } from '../../services/gmail.js'
import { ImapFlowHandler } from '../../services/imapflow-handler.js'

// モック設定
vi.mock('../../services/gmail.js')
vi.mock('../../services/imapflow-handler.js')
vi.mock('../../connection-logger.js')

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let accountManager: AccountManager;

  beforeEach(() => {
    accountManager = new AccountManager();
    connectionManager = new ConnectionManager(accountManager);
  });

  afterEach(async () => {
    await connectionManager.cleanup();
  });

  describe('getGmailHandler', () => {
    it('should create new Gmail handler for first access', async () => {
      // Gmailアカウント設定のモック
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        config: {}
      });

      const handler = await connectionManager.getGmailHandler('test_gmail');
      expect(handler).toBeInstanceOf(GmailHandler);
    });

    it('should reuse existing Gmail handler', async () => {
      // アカウント設定とハンドラー再利用のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        config: {}
      });

      const handler1 = await connectionManager.getGmailHandler('test_gmail');
      const handler2 = await connectionManager.getGmailHandler('test_gmail');
      expect(handler1).toBe(handler2);
    });
  });

  describe('testConnection', () => {
    it('should test Gmail connection successfully', async () => {
      // Gmail接続テスト成功のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        config: {}
      });

      const result = await connectionManager.testConnection('test_gmail');
      expect(result.success).toBe(true);
      expect(result.accountType).toBe('gmail');
      expect(result.accountName).toBe('test_gmail');
    });

    it('should handle connection test failure', async () => {
      // 接続テスト失敗のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue(null);

      const result = await connectionManager.testConnection('nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Account not found');
    });
  });

  describe('cleanup', () => {
    it('should cleanup all connections', async () => {
      // クリーンアップ機能のテスト
      vi.spyOn(accountManager, 'getAccount').mockReturnValue({
        name: 'test_gmail',
        type: 'gmail',
        config: {}
      });

      await connectionManager.getGmailHandler('test_gmail');
      const statusBefore = connectionManager.getPoolStatus();
      expect(statusBefore.gmail.active).toBe(1);

      await connectionManager.cleanup();
      const statusAfter = connectionManager.getPoolStatus();
      expect(statusAfter.gmail.active).toBe(0);
    });
  });

  describe('getPoolStatus', () => {
    it('should return correct pool status', async () => {
      // プール状況取得のテスト
      const status = connectionManager.getPoolStatus();
      expect(status).toHaveProperty('gmail');
      expect(status).toHaveProperty('imap');
      expect(typeof status.gmail.active).toBe('number');
      expect(typeof status.imap.active).toBe('number');
    });
  });
});
```

```typescript
// src/tests/connection/connection-pool.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConnectionManager } from '../../connection-manager.js'
import { AccountManager } from '../../services/account-manager.js'

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
      .mockReturnValueOnce({ name: 'gmail1', type: 'gmail', config: {} })
      .mockReturnValueOnce({ name: 'imap1', type: 'imap', config: {} });

    await connectionManager.getGmailHandler('gmail1');
    await connectionManager.getImapHandler('imap1');

    const status = connectionManager.getPoolStatus();
    expect(status.gmail.active).toBe(1);
    expect(status.imap.active).toBe(1);
  });

  it('should handle concurrent connection requests safely', async () => {
    // 並行接続リクエストの安全な処理
    vi.spyOn(accountManager, 'getAccount').mockReturnValue({
      name: 'test_account',
      type: 'gmail',
      config: {}
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
});
```

## 検証基準【ユーザー承認済み】
### 機能検証
- [ ] Gmail/IMAP接続プールが正常に動作する
- [ ] testConnectionが統一形式で結果を返す
- [ ] cleanup機能が全接続を確実に解放する
- [ ] ConnectionLoggerとの連携が正常に動作する

### 技術検証
- [ ] TypeScript strict modeでコンパイル成功
- [ ] ESLintエラー0件
- [ ] vitestによるテストケース実装完了
- [ ] 既存テストが継続して通る
- [ ] 基本ルール（@test-debug-rule.mdc）準拠

### 設計書詳細反映検証【新規必須】
- [x] 設計書の具体的コード例が実装指示書に転記済み
- [x] 設計書の操作手順が明確に記載済み
- [x] 設計書の固有値（データフロー等）が具体的に記載済み
- [x] 曖昧な指示（"設計書を参照"等）が排除済み
- [x] エラーハンドリングの詳細が設計書から反映済み

### 自動テスト検証【必須】
- [ ] `npm test` でテスト実行可能
- [ ] `npm run test:run` で非対話モード実行可能
- [ ] 実装したテストケースが全て合格
- [ ] テストカバレッジが適切（新規コードの主要パスを網羅）
- [ ] CI/CD環境での実行を考慮した設定

### 統合検証
- [ ] GmailHandler/ImapFlowHandlerとの連携確認
- [ ] 接続プールの並行アクセス安全性確認

## 実装例【設計書詳細反映版】
```typescript
// 【設計書Line 89-111 から転記】具体的な実装例
// 設計書の詳細を完全に反映した実装コード
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
  
  // 設計書データフローStep 2-4の完全実装
  private async createHandler<T>(
    accountName: string,
    expectedType: 'gmail' | 'imap',
    pool: Map<string, T>,
    factory: (account: any) => T
  ): Promise<T> {
    // Step 2: ツール実行要求 → ConnectionManager.getHandler(accountName)
    if (pool.has(accountName)) {
      // Step 4: ハンドラー取得 → 既存メソッド実行
      this.logger.logConnectionEvent('REUSE', accountName, expectedType);
      return pool.get(accountName)!;
    }
    
    // Step 3: プール確認 → 未接続なら新規作成 → プールに保存
    const account = this.accountManager.getAccount(accountName);
    if (!account || account.type !== expectedType) {
      throw new Error(`${expectedType.toUpperCase()} account not found: ${accountName}`);
    }
    
    const handler = factory(account);
    pool.set(accountName, handler);
    this.logger.logConnectionEvent('CREATE', accountName, expectedType);
    this.logger.logPoolStatus(this.gmailPool.size, this.imapPool.size);
    
    return handler;
  }
}
```

## 注意事項
### 【厳守事項】
- セッション毎の接続プール初期化を必ず実行すること
- cleanup実行時の確実なリソース解放を保証すること
- 既存のコメントを削除しないこと
- vitestによる自動テスト実行が可能な状態を維持すること
- **【新規】設計書詳細完全反映ルールを必ず遵守すること**

### 【推奨事項】
- エラーハンドリングの包括的実装
- 並行アクセスに対する安全性確保

### 【禁止事項】
- 永続的な接続プール実装
- vitestの設定や既存テストを破壊する変更
- npm testでテストが実行できなくなる変更
- **【新規】設計書詳細を「参照」のみで済ませる曖昧な指示**

## 参考情報
- [設計書]: `doc/design/connection-manager.md` - ConnectionManager詳細設計
- [既存実装]: `src/services/gmail.ts`, `src/services/imapflow-handler.ts` - 活用対象のハンドラークラス
- [Phase 1成果物]: `src/connection-logger.ts` - 接続ログ機能