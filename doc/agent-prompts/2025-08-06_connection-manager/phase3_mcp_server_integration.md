# Task 3: McpEmailServer統合

## 概要
McpEmailServerクラスを修正し、Phase 2で実装されたConnectionManagerを統合する。重複インスタンス作成を削除し、統一された接続管理を実現する。

## 設計書詳細反映確認【新規必須セクション】
### 設計書参照箇所
- **設計書ファイル**: `doc/design/connection-manager.md`
- **参照セクション**: 3.1 システム構成、5.1 Phase分割
- **参照行数**: Line 48-95, 201-209

### 設計書詳細の具体的反映

#### コード例（設計書から転記）
```mermaid
// 設計書Line 50-77 から転記
graph TB
    A[McpEmailServer] --> B[ConnectionManager]
    B --> C[GmailConnectionPool]
    B --> D[ImapConnectionPool]
    
    C --> E[GmailHandler instances]
    D --> F[ImapFlowHandler instances]
    
    B --> G[AccountManager]
    G --> H[Account Configuration]
    
    B --> I[ConnectionLogger]
    I --> J[FileLogger + Masking]
```

#### 操作手順（設計書から転記）
1. **手順1**: McpEmailServer重複インスタンス削除
2. **手順2**: ConnectionManager統合
3. **手順3**: 既存API互換性保持

#### 固有値・設定値（設計書から転記）
- **統合方針**: `ConnectionManager統合、既存API互換性保持`
- **重複削除**: `McpEmailServer重複インスタンス削除`
- **システム構成**: `McpEmailServer → ConnectionManager → Handler instances`

### 曖昧指示チェック
**以下の曖昧な指示を含まないことを確認**
- [x] "設計書を参照して実装"
- [x] "設計書通りに実装"
- [x] "～の実際のシナリオを実装"
- [x] "詳細は設計書を参照"

## 依存関係
- 本実装の元となる設計書: `doc/design/connection-manager.md`
- Phase 2の成果物: `src/connection-manager.ts` (ConnectionManagerクラス)
- 修正対象: `src/index.ts` (McpEmailServerクラス)
- 関連型定義: `src/types/connection.ts` (Phase 2で作成)

### 前提条件
- Phase 2: ConnectionManagerクラス実装完了 - 統一接続管理機能
- src/index.ts: McpEmailServerクラス - 修正対象の既存実装
- src/connection-logger.ts: ConnectionLoggerクラス - ログ記録機能

### 成果物
- `src/index.ts` - McpEmailServer重複インスタンス削除とConnectionManager統合

### テスト成果物【必須】
- **テストファイル**: `src/tests/integration/mcp-server-integration.test.ts` - 統合テスト
- **テストファイル**: `src/tests/integration/api-compatibility.test.ts` - API互換性テスト
- **vitest設定**: `vitest.config.ts` - テスト環境設定（既存確認）
- **npmテストスクリプト**: `package.json`の`scripts.test`設定確認

### 影響範囲
- src/index.ts - ConnectionManager統合、重複削除
- 既存テスト - 統合に伴うテスト修正が必要な可能性

## 実装要件
### 【必須制約】API互換性維持
- **既存API仕様**: 既存のツール仕様と戻り値形式を完全に維持
- **段階的統合**: 安全な機能移行とロールバック可能性

### 技術仕様
```typescript
// 型定義例（必須）
export default class McpEmailServer {
  private accountManager: AccountManager;
  private connectionManager: ConnectionManager;
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
    this.accountManager = new AccountManager();
    this.connectionManager = new ConnectionManager(this.accountManager);
  }
}

// 実装例（必須）
// 重複インスタンス削除前：
// this.gmailHandler = new GmailHandler(this.accountManager.getGmailAccounts());
// this.imapHandler = new ImapFlowHandler(this.accountManager.getImapAccounts(), this.encryptionKey);

// 重複インスタンス削除後：
// ハンドラーは ConnectionManager が管理
```

### 設計パターン
**参考**: `src/index.ts`の既存構造を維持しつつConnectionManager統合
**理由**: 既存API互換性保持、段階的移行による安全性確保

## 実装ガイド【設計書詳細反映必須】
### ステップ1: McpEmailServer重複インスタンス削除
**【設計書Line 201-203 対応】**
```typescript
// src/index.ts
// 設計書から転記した具体的なコード

import { AccountManager } from './services/account-manager.js';
import { ConnectionManager } from './connection-manager.js';
import { MCPRequest, MCPResponse, McpError, Tool, EmailMessage } from './types/index.js';
import { ConnectionResult } from './types/connection.js';

export default class McpEmailServer {
  private accountManager: AccountManager;
  private connectionManager: ConnectionManager;
  private encryptionKey: string;

  // 重複インスタンス削除：以下の行を削除
  // private gmailHandler: GmailHandler;
  // private imapHandler: ImapFlowHandler;

  constructor() {
    this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
    this.accountManager = new AccountManager();
    
    // ConnectionManager統合：重複インスタンス作成を統一管理に変更
    this.connectionManager = new ConnectionManager(this.accountManager);
    
    // 削除：重複インスタンス作成
    // this.gmailHandler = new GmailHandler(this.accountManager.getGmailAccounts());
    // this.imapHandler = new ImapFlowHandler(this.accountManager.getImapAccounts(), this.encryptionKey);
  }
}
```

### ステップ2: ツール実行メソッドの統合修正
**【設計書Line 89-94 対応】**
```typescript
// 設計書の詳細を反映した実装コード
// callToolメソッドの修正：統一接続管理の活用

private async callTool(toolName: string, args: any): Promise<any> {
  // 既存のツール存在チェックは維持
  const allTools = this.getTools().tools;
  const toolExists = allTools.some(tool => tool.name === toolName);
  if (!toolExists) {
    throw new McpError(-32601, `Tool not found: ${toolName}`);
  }

  let accountName: string | undefined;
  let account: any;

  // account_nameを必要としないツール
  if (!['list_accounts', 'get_account_stats', 'search_all_emails'].includes(toolName)) {
    accountName = args.account_name;
    if (!accountName) {
      throw new McpError(-32602, 'account_name is required');
    }
    account = this.accountManager.getAccount(accountName);
    if (!account) {
      throw new McpError(-32602, `Account not found: ${accountName}`);
    }
  }

  try {
    switch (toolName) {
      case 'list_emails':
        if (account.type === 'gmail') {
          // 重複削除：統一接続管理を使用
          const handler = await this.connectionManager.getGmailHandler(accountName!);
          return await handler.listEmails(accountName!, args);
        } else if (account.type === 'imap') {
          const handler = await this.connectionManager.getImapHandler(accountName!);
          return await handler.listEmails(accountName!, args);
        }
        break;
      case 'search_emails':
        if (account.type === 'gmail') {
          const handler = await this.connectionManager.getGmailHandler(accountName!);
          return await handler.searchEmails(accountName!, args.query, args.limit);
        } else if (account.type === 'imap') {
          const handler = await this.connectionManager.getImapHandler(accountName!);
          return await handler.searchEmails(accountName!, args.query, args.limit);
        }
        break;
      case 'get_email_detail':
        if (account.type === 'gmail') {
          const handler = await this.connectionManager.getGmailHandler(accountName!);
          return await handler.getEmailDetail(accountName!, args.email_id);
        } else if (account.type === 'imap') {
          const handler = await this.connectionManager.getImapHandler(accountName!);
          return await handler.getEmailDetail(accountName!, args.email_id);
        }
        break;
      case 'archive_email':
        if (account.type === 'gmail') {
          const handler = await this.connectionManager.getGmailHandler(accountName!);
          return await handler.archiveEmail(accountName!, args.email_id, args.remove_unread);
        } else if (account.type === 'imap') {
          const handler = await this.connectionManager.getImapHandler(accountName!);
          return await handler.archiveEmail(accountName!, args.email_id, args.remove_unread);
        }
        break;
      case 'send_email':
        if (account.type === 'gmail') {
          const handler = await this.connectionManager.getGmailHandler(accountName!);
          const result = await handler.sendEmail(accountName!, args);
          return { success: result.success, messageId: result.messageId, error: result.error };
        } else if (account.type === 'imap') {
          const handler = await this.connectionManager.getImapHandler(accountName!);
          const result = await handler.sendEmail(accountName!, args);
          return { success: result.success, messageId: result.messageId, error: result.error };
        }
        break;
      // ... 他のケースは既存のまま維持
    }
  } catch (error) {
    throw new McpError(-32603, `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

### ステップ3: test_connectionの統合修正
**【設計書Line 31-34 対応】**
```typescript
// callToolメソッド内のtest_connectionケースを修正
// 設計書：統一testConnectionの活用

case 'test_connection':
  // 重複削除：統一接続管理のtestConnectionを使用
  const connectionResult: ConnectionResult = await this.connectionManager.testConnection(accountName!);
  
  // 既存API互換性維持：戻り値形式を既存形式に変換
  return {
    status: connectionResult.success ? 'connected' : 'failed',
    account: connectionResult.accountName,
    accountType: connectionResult.accountType,
    testResult: connectionResult.message
  };
  
  // 削除：重複インスタンス作成によるtest_connection
  /*
  try {
    if (account.type === 'gmail') {
      const gmailHandler = new (await import('./services/gmail.js')).GmailHandler([account]);
      await gmailHandler.testConnection(accountName);
      return { status: 'connected', account: accountName, accountType: account.type, testResult: 'Gmail connection test successful' };
    } else if (account.type === 'imap') {
      await this.imapHandler.testConnection(accountName);
      return { status: 'connected', account: accountName, accountType: account.type, testResult: 'IMAP connection test successful' };
    } else {
      throw new Error(`Unsupported account type: ${account.type}`);
    }
  } catch (error: any) {
    return { status: 'failed', account: accountName, accountType: account.type, testResult: `Connection test failed: ${error.message}` };
  }
  */
```

### ステップ4: search_all_emailsメソッドの統合修正
**【設計書Line 89-94 対応】**
```typescript
// _performSearchAllEmailsメソッドの修正：統一接続管理の活用

private async _performSearchAllEmails(args: any): Promise<any> {
  const results: any[] = [];
  const errors: string[] = [];

  const accountsType = args.accounts || 'ALL';

  // Gmail search：統一接続管理を使用
  if (accountsType === 'ALL' || accountsType === 'GMAIL_ONLY') {
    const gmailAccounts = this.accountManager.getGmailAccounts();
    const gmailPromises = gmailAccounts.map(async (account) => {
      try {
        // 重複削除：ConnectionManager経由でハンドラー取得
        const handler = await this.connectionManager.getGmailHandler(account.name);
        const emailPromise = handler.searchEmails(account.name, args.query, args.limit);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Individual Gmail search timeout')), 15000)
        );
        const emails = await Promise.race([emailPromise, timeoutPromise]) as EmailMessage[];
        return emails;
      } catch (error) {
        errors.push(`Gmail ${account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return [];
      }
    });
    
    const gmailResults = await Promise.allSettled(gmailPromises);
    gmailResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      } else {
        const account = gmailAccounts[index];
        errors.push(`Gmail ${account.name}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
      }
    });
  }

  // IMAP search：統一接続管理を使用
  if (accountsType === 'ALL' || accountsType === 'IMAP_ONLY') {
    const imapAccounts = this.accountManager.getImapAccounts();
    const imapPromises = imapAccounts.map(async (account) => {
      try {
        // 重複削除：ConnectionManager経由でハンドラー取得
        const handler = await this.connectionManager.getImapHandler(account.name);
        const emailPromise = handler.searchEmails(account.name, args.query, args.limit);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Individual ImapFlow search timeout')), 15000)
        );
        const emails = await Promise.race([emailPromise, timeoutPromise]) as EmailMessage[];
        return emails;
      } catch (error) {
        errors.push(`ImapFlow ${account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return [];
      }
    });
    
    const imapResults = await Promise.allSettled(imapPromises);
    imapResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      } else {
        const account = imapAccounts[index];
        errors.push(`ImapFlow ${account.name}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
      }
    });
  }

  // 既存のソート・結果処理は維持
  const sortedResults = results.sort((a, b) => {
    if (args.sortBy === 'relevance') {
      const aScore = a.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
      const bScore = b.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
      if (aScore !== bScore) return bScore - aScore;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  }).slice(0, args.limit);

  return {
    emails: sortedResults,
    totalFound: results.length,
    searchQuery: args.query,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

### テスト環境構築【全プロジェクト必須】
#### ステップD: テストファイル作成
```typescript
// src/tests/integration/mcp-server-integration.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import McpEmailServer from '../../index.js'
import { AccountManager } from '../../services/account-manager.js'
import { ConnectionManager } from '../../connection-manager.js'

// モック設定
vi.mock('../../connection-manager.js')
vi.mock('../../services/account-manager.js')

describe('McpEmailServer Integration', () => {
  let mcpServer: McpEmailServer;

  beforeEach(() => {
    mcpServer = new McpEmailServer();
  });

  describe('ConnectionManager Integration', () => {
    it('should use ConnectionManager for Gmail operations', async () => {
      // ConnectionManagerのモック設定
      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue({
          listEmails: vi.fn().mockResolvedValue([]),
          testConnection: vi.fn().mockResolvedValue(undefined)
        }),
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_gmail',
          accountType: 'gmail',
          message: 'Gmail connection test successful'
        })
      };

      // McpEmailServerにモックを注入
      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_gmail',
          type: 'gmail',
          config: {}
        })
      };

      // list_emailsツール実行テスト
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'test_gmail' }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.result).toBeDefined();
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledWith('test_gmail');
    });

    it('should use ConnectionManager for test_connection', async () => {
      // test_connectionの統合テスト
      const mockConnectionManager = {
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_account',
          accountType: 'gmail',
          message: 'Gmail connection test successful'
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_account',
          type: 'gmail',
          config: {}
        })
      };

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'test_connection',
          arguments: { account_name: 'test_account' }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.result).toEqual({
        status: 'connected',
        account: 'test_account',
        accountType: 'gmail',
        testResult: 'Gmail connection test successful'
      });
    });
  });

  describe('Duplicate Instance Prevention', () => {
    it('should not create duplicate Gmail handlers', async () => {
      // 重複インスタンス作成防止のテスト
      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue({
          listEmails: vi.fn().mockResolvedValue([])
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_gmail',
          type: 'gmail',
          config: {}
        })
      };

      // 複数回のツール実行
      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: 'test_gmail' }
        },
        id: 1
      };

      await mcpServer.handleRequest(request);
      await mcpServer.handleRequest(request);

      // ConnectionManagerが適切に呼ばれることを確認
      expect(mockConnectionManager.getGmailHandler).toHaveBeenCalledTimes(2);
    });
  });
});
```

```typescript
// src/tests/integration/api-compatibility.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import McpEmailServer from '../../index.js'

describe('API Compatibility', () => {
  let mcpServer: McpEmailServer;

  beforeEach(() => {
    mcpServer = new McpEmailServer();
  });

  describe('Tool Response Format', () => {
    it('should maintain test_connection response format', async () => {
      // API互換性：test_connection戻り値形式の確認
      const mockConnectionManager = {
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_account',
          accountType: 'gmail',
          message: 'Connection successful'
        })
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_account',
          type: 'gmail',
          config: {}
        })
      };

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'test_connection',
          arguments: { account_name: 'test_account' }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      
      // 既存の戻り値形式を維持
      expect(response.result).toHaveProperty('status');
      expect(response.result).toHaveProperty('account');
      expect(response.result).toHaveProperty('accountType');
      expect(response.result).toHaveProperty('testResult');
      expect(response.result.status).toBe('connected');
    });

    it('should maintain send_email response format', async () => {
      // API互換性：send_email戻り値形式の確認
      const mockHandler = {
        sendEmail: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'test-message-id',
          error: undefined
        })
      };

      const mockConnectionManager = {
        getGmailHandler: vi.fn().mockResolvedValue(mockHandler)
      };

      (mcpServer as any).connectionManager = mockConnectionManager;
      (mcpServer as any).accountManager = {
        getAccount: vi.fn().mockReturnValue({
          name: 'test_gmail',
          type: 'gmail',
          config: {}
        })
      };

      const request = {
        jsonrpc: '2.0' as const,
        method: 'tools/call',
        params: {
          name: 'send_email',
          arguments: {
            account_name: 'test_gmail',
            to: 'test@example.com',
            subject: 'Test',
            text: 'Test message'
          }
        },
        id: 1
      };

      const response = await mcpServer.handleRequest(request);
      
      // 既存の戻り値形式を維持
      expect(response.result).toHaveProperty('success');
      expect(response.result).toHaveProperty('messageId');
      expect(response.result).toHaveProperty('error');
    });
  });

  describe('Tool List Compatibility', () => {
    it('should return same tool list structure', () => {
      // API互換性：ツールリストの構造確認
      const toolsResponse = mcpServer.getTools();
      expect(toolsResponse).toHaveProperty('tools');
      expect(Array.isArray(toolsResponse.tools)).toBe(true);
      
      // 主要ツールの存在確認
      const toolNames = toolsResponse.tools.map(t => t.name);
      expect(toolNames).toContain('list_emails');
      expect(toolNames).toContain('test_connection');
      expect(toolNames).toContain('send_email');
    });
  });
});
```

## 検証基準【ユーザー承認済み】
### 機能検証
- [ ] ConnectionManagerが正常にMcpEmailServerに統合される
- [ ] 重複インスタンス作成が完全に削除される
- [ ] 既存API仕様が完全に維持される
- [ ] 全ツールが統一接続管理で動作する

### 技術検証
- [ ] TypeScript strict modeでコンパイル成功
- [ ] ESLintエラー0件
- [ ] vitestによるテストケース実装完了
- [ ] 既存テストが継続して通る
- [ ] 基本ルール（@test-debug-rule.mdc）準拠

### 設計書詳細反映検証【新規必須】
- [x] 設計書の具体的コード例が実装指示書に転記済み
- [x] 設計書の操作手順が明確に記載済み
- [x] 設計書の固有値（システム構成等）が具体的に記載済み
- [x] 曖昧な指示（"設計書を参照"等）が排除済み
- [x] エラーハンドリングの詳細が設計書から反映済み

### 自動テスト検証【必須】
- [ ] `npm test` でテスト実行可能
- [ ] `npm run test:run` で非対話モード実行可能
- [ ] 実装したテストケースが全て合格
- [ ] テストカバレッジが適切（統合部分の主要パスを網羅）
- [ ] CI/CD環境での実行を考慮した設定

### 統合検証
- [ ] 統合前後でのAPI互換性確認
- [ ] 重複インスタンス削除の効果確認

## 実装例【設計書詳細反映版】
```typescript
// 【設計書Line 48-77, 201-209 から転記】具体的な実装例
// 設計書の詳細を完全に反映した実装コード

// システム構成の実装：McpEmailServer → ConnectionManager
export default class McpEmailServer {
  private accountManager: AccountManager;
  private connectionManager: ConnectionManager; // 統一接続管理
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
    this.accountManager = new AccountManager();
    
    // Phase 3統合：ConnectionManager導入
    this.connectionManager = new ConnectionManager(this.accountManager);
  }

  // 重複削除の完全実装例
  private async executeEmailTool(toolName: string, accountName: string, account: any, args: any): Promise<any> {
    // 統一接続管理による重複削除
    if (account.type === 'gmail') {
      const handler = await this.connectionManager.getGmailHandler(accountName);
      switch (toolName) {
        case 'list_emails': return await handler.listEmails(accountName, args);
        case 'search_emails': return await handler.searchEmails(accountName, args.query, args.limit);
        case 'get_email_detail': return await handler.getEmailDetail(accountName, args.email_id);
        case 'archive_email': return await handler.archiveEmail(accountName, args.email_id, args.remove_unread);
        case 'send_email': 
          const result = await handler.sendEmail(accountName, args);
          return { success: result.success, messageId: result.messageId, error: result.error };
      }
    } else if (account.type === 'imap') {
      const handler = await this.connectionManager.getImapHandler(accountName);
      switch (toolName) {
        case 'list_emails': return await handler.listEmails(accountName, args);
        case 'search_emails': return await handler.searchEmails(accountName, args.query, args.limit);
        case 'get_email_detail': return await handler.getEmailDetail(accountName, args.email_id);
        case 'archive_email': return await handler.archiveEmail(accountName, args.email_id, args.remove_unread);
        case 'send_email': 
          const result = await handler.sendEmail(accountName, args);
          return { success: result.success, messageId: result.messageId, error: result.error };
      }
    }
  }
}
```

## 注意事項
### 【厳守事項】
- 既存API仕様を完全に維持すること
- 重複インスタンス作成を完全に削除すること  
- 既存のコメントを削除しないこと
- vitestによる自動テスト実行が可能な状態を維持すること
- **【新規】設計書詳細完全反映ルールを必ず遵守すること**

### 【推奨事項】
- 段階的統合による安全な移行
- API互換性テストの包括的実装

### 【禁止事項】
- 既存API仕様の変更
- vitestの設定や既存テストを破壊する変更
- npm testでテストが実行できなくなる変更
- **【新規】設計書詳細を「参照」のみで済ませる曖昧な指示**

## 参考情報
- [設計書]: `doc/design/connection-manager.md` - システム構成と統合方針
- [Phase 2成果物]: `src/connection-manager.ts` - 統合対象のConnectionManagerクラス
- [修正対象]: `src/index.ts` - 既存のMcpEmailServerクラス