# Task 4: テスト修正・検証

## 概要
Phase 1-3の実装に伴い影響を受ける既存テストを修正し、統合された接続管理システムの動作確認を行う。重複インスタンス問題の解決とnpm test/health:checkの整合性を検証する。

## 設計書詳細反映確認【新規必須セクション】
### 設計書参照箇所
- **設計書ファイル**: `doc/design/connection-manager.md`
- **参照セクション**: 7. テスト戦略、2.1 成功基準
- **参照行数**: Line 240-251, 10-15

### 設計書詳細の具体的反映

#### コード例（設計書から転記）
```typescript
// 設計書Line 240-251 から転記
### 7.1 テスト方針
- 単体テスト: ConnectionManager各メソッドの動作確認
- 統合テスト: McpEmailServerとの統合動作確認
- 回帰テスト: 既存機能の動作継続確認

### 7.2 検証項目
- 重複インスタンス作成の完全解消
- test_connectionとlist_emailsの一貫性確保
- health:checkとnpm testの結果整合性
- 機密情報マスキングの正常動作
```

#### 操作手順（設計書から転記）
1. **手順1**: 既存テスト修正
2. **手順2**: 新規テスト追加
3. **手順3**: 統合テスト実行

#### 固有値・設定値（設計書から転記）
- **検証項目**: `重複インスタンス作成の完全解消、test_connectionとlist_emailsの一貫性確保`
- **成功基準**: `health:checkとnpm testの結果整合性、機密情報マスキングの正常動作`
- **テスト方針**: `単体テスト、統合テスト、回帰テスト`

### 曖昧指示チェック
**以下の曖昧な指示を含まないことを確認**
- [x] "設計書を参照して実装"
- [x] "設計書通りに実装"
- [x] "～の実際のシナリオを実装"
- [x] "詳細は設計書を参照"

## 依存関係
- 本実装の元となる設計書: `doc/design/connection-manager.md`
- Phase 1-3の全成果物: ConnectionLogger, ConnectionManager, 統合されたMcpEmailServer
- 既存テスト: `test/` ディレクトリ内の全テストファイル
- 検証スクリプト: `scripts/monitor-health.ts`

### 前提条件
- Phase 1-3: 全実装完了 - 統一接続管理システム実装済み
- test/: 既存テストファイル群 - 修正対象
- scripts/monitor-health.ts: health:checkスクリプト - 動作確認用

### 成果物
- `test/` - 既存テスト修正
- `src/tests/integration/full-system.test.ts` - 統合テスト（新規作成）
- `test-report.md` - テスト結果レポート（新規作成）

### テスト成果物【必須】
- **テストファイル**: `src/tests/integration/full-system.test.ts` - 全システム統合テスト
- **テストファイル**: `test/` 既存テスト修正 - 接続管理統合対応
- **vitest設定**: `vitest.config.ts` - テスト環境最終確認
- **npmテストスクリプト**: `package.json`の`scripts.test`設定最終確認

### 影響範囲
- test/ - 既存テスト全体の統合対応修正
- scripts/monitor-health.ts - 動作確認
- package.json - テストスクリプト最終確認

## 実装要件
### 【必須制約】整合性確保
- **npm test成功**: 全テストケースが確実に合格する状態
- **health:check成功**: npm run health:check が全アカウントで成功する状態
- **一貫性確保**: test_connectionとlist_emailsの動作が一貫している状態

### 技術仕様
```typescript
// 型定義例（必須）
interface TestEnvironment {
  connectionManager: ConnectionManager;
  mockAccounts: Array<{
    name: string;
    type: 'gmail' | 'imap';
    config: any;
  }>;
}

interface SystemVerificationResult {
  npmTest: boolean;
  healthCheck: boolean;
  consistencyCheck: boolean;
  duplicateInstanceCheck: boolean;
}

// 実装例（必須）
export const verifySystemIntegration = async (): Promise<SystemVerificationResult> => {
  // システム全体の検証実装
};
```

### 設計パターン
**参考**: 既存の`test/`ディレクトリ構造を維持しつつ統合対応
**理由**: テストの継続性確保、既存CI/CDとの互換性維持

## 実装ガイド【設計書詳細反映必須】
### ステップ1: 既存テスト影響調査・修正
**【設計書Line 247-250 対応】**
```typescript
// test/core/simple-imap.test.ts の修正例
// 重複インスタンス作成の完全解消確認

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import McpEmailServer from '../../src/index.js'
import { ConnectionManager } from '../../src/connection-manager.js'

describe('IMAP Integration Test', () => {
  let mcpServer: McpEmailServer;

  beforeEach(() => {
    mcpServer = new McpEmailServer();
  });

  it('should use ConnectionManager for IMAP operations', async () => {
    // 既存テストをConnectionManager統合に対応
    const mockConnectionManager = {
      getImapHandler: vi.fn().mockResolvedValue({
        testConnection: vi.fn().mockResolvedValue(undefined),
        listEmails: vi.fn().mockResolvedValue([])
      })
    };

    (mcpServer as any).connectionManager = mockConnectionManager;
    (mcpServer as any).accountManager = {
      getAccount: vi.fn().mockReturnValue({
        name: 'info_h_fpo_com',
        type: 'imap',
        config: {}
      })
    };

    const testRequest = {
      jsonrpc: '2.0' as const,
      method: 'tools/call',
      params: {
        name: 'test_connection',
        arguments: { account_name: 'info_h_fpo_com' }
      },
      id: 1
    };

    const response = await mcpServer.handleRequest(testRequest);
    expect(response.result.status).toBe('connected');
    expect(mockConnectionManager.getImapHandler).toHaveBeenCalledWith('info_h_fpo_com');
  });
});
```

### ステップ2: test_connectionとlist_emailsの一貫性テスト
**【設計書Line 248 対応】**
```typescript
// test/integration/consistency.test.ts（新規作成）
// 設計書の詳細を反映した実装コード

import { describe, it, expect, beforeEach } from 'vitest'
import McpEmailServer from '../../src/index.js'

describe('Connection Consistency Verification', () => {
  let mcpServer: McpEmailServer;

  beforeEach(() => {
    mcpServer = new McpEmailServer();
  });

  it('should maintain consistency between test_connection and list_emails', async () => {
    // test_connectionとlist_emailsの一貫性確保の検証
    const accountName = 'info_h_fpo_com';

    // test_connection実行
    const testRequest = {
      jsonrpc: '2.0' as const,
      method: 'tools/call',
      params: {
        name: 'test_connection',
        arguments: { account_name: accountName }
      },
      id: 1
    };

    const testResponse = await mcpServer.handleRequest(testRequest);

    // list_emails実行
    const listRequest = {
      jsonrpc: '2.0' as const,
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: { account_name: accountName, limit: 1 }
      },
      id: 2
    };

    const listResponse = await mcpServer.handleRequest(listRequest);

    // 一貫性確認
    if (testResponse.result.status === 'connected') {
      // test_connectionが成功した場合、list_emailsも成功するべき
      expect(listResponse.error).toBeUndefined();
      expect(listResponse.result).toBeDefined();
    } else {
      // test_connectionが失敗した場合、list_emailsも失敗するべき
      expect(listResponse.error).toBeDefined();
    }
  });

  it('should use same ConnectionManager instance for both operations', async () => {
    // 同一ConnectionManagerインスタンス使用の確認
    const connectionManagerSpy = vi.spyOn(mcpServer as any, 'connectionManager', 'get');
    
    const accountName = 'test_account';
    
    await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'test_connection', arguments: { account_name: accountName } },
      id: 1
    });

    await mcpServer.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'list_emails', arguments: { account_name: accountName } },
      id: 2
    });

    // 同一インスタンスが使用されることを確認
    expect(connectionManagerSpy).toHaveBeenCalledTimes(2);
    const firstCall = connectionManagerSpy.mock.results[0].value;
    const secondCall = connectionManagerSpy.mock.results[1].value;
    expect(firstCall).toBe(secondCall);
  });
});
```

### ステップ3: 統合システムテスト実装
**【設計書Line 240-245 対応】**
```typescript
// src/tests/integration/full-system.test.ts
// 設計書：単体テスト、統合テスト、回帰テストの実装

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import McpEmailServer from '../../index.js'
import { ConnectionManager } from '../../connection-manager.js'
import { ConnectionLogger } from '../../connection-logger.js'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec);

describe('Full System Integration Test', () => {
  let mcpServer: McpEmailServer;

  beforeAll(() => {
    mcpServer = new McpEmailServer();
  });

  describe('Single Unit Tests', () => {
    it('should have ConnectionManager properly integrated', () => {
      // 単体テスト：ConnectionManager統合確認
      expect((mcpServer as any).connectionManager).toBeInstanceOf(ConnectionManager);
      expect((mcpServer as any).connectionManager.getPoolStatus).toBeFunction();
    });

    it('should have ConnectionLogger singleton working', () => {
      // 単体テスト：ConnectionLoggerシングルトン確認
      const logger1 = ConnectionLogger.getInstance();
      const logger2 = ConnectionLogger.getInstance();
      expect(logger1).toBe(logger2);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate McpEmailServer with ConnectionManager', async () => {
      // 統合テスト：McpEmailServerとConnectionManagerの統合動作確認
      const mockConnectionManager = {
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          accountName: 'test_account',
          accountType: 'gmail',
          message: 'Success'
        }),
        getPoolStatus: vi.fn().mockReturnValue({
          gmail: { active: 0, accounts: [] },
          imap: { active: 0, accounts: [] }
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
        testResult: 'Success'
      });
    });
  });

  describe('Regression Tests', () => {
    it('should maintain existing API compatibility', async () => {
      // 回帰テスト：既存機能の動作継続確認
      const initResponse = await mcpServer.handleRequest({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 1
      });

      expect(initResponse.result).toHaveProperty('protocolVersion');
      expect(initResponse.result).toHaveProperty('capabilities');
      expect(initResponse.result).toHaveProperty('serverInfo');
    });

    it('should return same tool structure as before', () => {
      // 回帰テスト：ツール構造の継続性確認
      const tools = mcpServer.getTools();
      expect(tools).toHaveProperty('tools');
      expect(Array.isArray(tools.tools)).toBe(true);
      
      const requiredTools = [
        'list_emails', 'search_emails', 'get_email_detail',
        'archive_email', 'send_email', 'list_accounts',
        'test_connection', 'get_account_stats', 'search_all_emails'
      ];
      
      const toolNames = tools.tools.map(t => t.name);
      requiredTools.forEach(toolName => {
        expect(toolNames).toContain(toolName);
      });
    });
  });

  describe('System Verification', () => {
    it('should verify npm test passes', async () => {
      // システム検証：npm testの成功確認
      try {
        const { stdout, stderr } = await execAsync('npm test');
        expect(stderr).toBe('');
        expect(stdout).toMatch(/PASSED|✓/);
      } catch (error) {
        console.error('npm test failed:', error);
        throw error;
      }
    }, 30000);

    it('should verify health check passes', async () => {
      // システム検証：health:checkの成功確認
      try {
        const { stdout, stderr } = await execAsync('npm run health:check');
        expect(stderr).not.toMatch(/ERROR|FAILED/);
        // health:checkが全アカウントをチェックすることを確認
        expect(stdout).toMatch(/checking|testing|verifying/i);
      } catch (error) {
        console.error('health:check failed:', error);
        // health:checkの失敗理由を詳細に記録
        throw new Error(`health:check failed: ${error}`);
      }
    }, 30000);

    it('should verify duplicate instance elimination', () => {
      // システム検証：重複インスタンス作成の完全解消
      const server = new McpEmailServer();
      
      // McpEmailServerにgmailHandler/imapHandlerプロパティが存在しないことを確認
      expect((server as any).gmailHandler).toBeUndefined();
      expect((server as any).imapHandler).toBeUndefined();
      
      // ConnectionManagerが存在することを確認
      expect((server as any).connectionManager).toBeInstanceOf(ConnectionManager);
    });
  });
});
```

### ステップ4: テスト結果レポート作成
**【設計書Line 247-251 対応】**
```markdown
// test-report.md（新規作成）
# アカウント接続一元管理テストレポート

## テスト実行概要
- **実行日**: 2025-08-06
- **対象**: Phase 1-4 統合された接続管理システム
- **テスト項目**: 設計書Line 247-251に基づく検証項目

## 検証結果

### 重複インスタンス作成の完全解消
- [x] McpEmailServerにgmailHandler/imapHandlerプロパティが存在しない
- [x] ConnectionManagerのみが接続を管理
- [x] 同一アカウントに対する複数回アクセスで同一ハンドラー再利用

### test_connectionとlist_emailsの一貫性確保
- [x] test_connection成功時、list_emailsも成功
- [x] test_connection失敗時、list_emailsも失敗
- [x] 同一ConnectionManagerインスタンス使用確認

### health:checkとnpm testの結果整合性
- [x] npm test: 全テストケース合格
- [x] npm run health:check: 全アカウントチェック成功
- [x] 結果の整合性: 両コマンドの成功/失敗が一致

### 機密情報マスキングの正常動作
- [x] 部分表示マスキング実装（先頭4文字+マスク+末尾4文字）
- [x] 機密フィールド自動検出・マスク
- [x] ログファイル出力でのマスキング適用

## パフォーマンス検証
- [x] 接続プール再利用による応答時間向上
- [x] セッション毎初期化のオーバーヘッド許容範囲内
- [x] リソースクリーンアップの確実な実行

## 結論
✅ **全検証項目合格** - 統一接続管理システムの正常動作を確認
```

### テスト環境構築【全プロジェクト必須】
#### ステップD: 検証スクリプト作成
```typescript
// scripts/verify-integration.ts（新規作成）
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface VerificationResult {
  testName: string;
  success: boolean;
  message: string;
  details?: string;
}

async function verifySystemIntegration(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // npm test検証
  try {
    const { stdout, stderr } = await execAsync('npm test', { timeout: 30000 });
    results.push({
      testName: 'npm test',
      success: !stderr && stdout.includes('passed'),
      message: 'All tests passed successfully',
      details: stdout
    });
  } catch (error: any) {
    results.push({
      testName: 'npm test',
      success: false,
      message: 'Tests failed',
      details: error.message
    });
  }

  // health:check検証
  try {
    const { stdout, stderr } = await execAsync('npm run health:check', { timeout: 30000 });
    results.push({
      testName: 'health:check',
      success: !stderr.includes('ERROR') && !stderr.includes('FAILED'),
      message: 'Health check passed for all accounts',
      details: stdout
    });
  } catch (error: any) {
    results.push({
      testName: 'health:check',
      success: false,
      message: 'Health check failed',
      details: error.message
    });
  }

  return results;
}

// 実行
verifySystemIntegration().then(results => {
  console.log('=== System Integration Verification Results ===');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.testName}: ${result.message}`);
    if (!result.success && result.details) {
      console.log(`Details: ${result.details.substring(0, 500)}...`);
    }
  });

  const allPassed = results.every(r => r.success);
  console.log(`\n=== Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'} ===`);
  process.exit(allPassed ? 0 : 1);
});
```

## 検証基準【ユーザー承認済み】
### 機能検証
- [ ] npm test が全ケース合格する
- [ ] npm run health:check が全アカウントで成功する
- [ ] test_connectionとlist_emailsの動作が一貫している
- [ ] 重複インスタンス作成が完全に解消されている

### 技術検証
- [ ] TypeScript strict modeでコンパイル成功
- [ ] ESLintエラー0件
- [ ] vitestによるテストケース実装完了
- [ ] 既存テストが継続して通る
- [ ] 基本ルール（@test-debug-rule.mdc）準拠

### 設計書詳細反映検証【新規必須】
- [x] 設計書の具体的コード例が実装指示書に転記済み
- [x] 設計書の操作手順が明確に記載済み
- [x] 設計書の固有値（検証項目等）が具体的に記載済み
- [x] 曖昧な指示（"設計書を参照"等）が排除済み
- [x] エラーハンドリングの詳細が設計書から反映済み

### 自動テスト検証【必須】
- [ ] `npm test` でテスト実行可能
- [ ] `npm run test:run` で非対話モード実行可能
- [ ] 実装したテストケースが全て合格
- [ ] テストカバレッジが適切（統合システム全体を網羅）
- [ ] CI/CD環境での実行を考慮した設定

### 統合検証
- [ ] システム全体の整合性確認
- [ ] 設計書成功基準の達成確認

## 実装例【設計書詳細反映版】
```typescript
// 【設計書Line 247-251 から転記】具体的な実装例
// 設計書の詳細を完全に反映した検証コード

// 重複インスタンス作成の完全解消確認
export function verifyDuplicateInstanceElimination(mcpServer: McpEmailServer): boolean {
  // 設計書検証項目：重複インスタンス作成の完全解消
  const hasGmailHandler = (mcpServer as any).gmailHandler !== undefined;
  const hasImapHandler = (mcpServer as any).imapHandler !== undefined;
  const hasConnectionManager = (mcpServer as any).connectionManager instanceof ConnectionManager;
  
  return !hasGmailHandler && !hasImapHandler && hasConnectionManager;
}

// test_connectionとlist_emailsの一貫性確保確認
export async function verifyConnectionConsistency(mcpServer: McpEmailServer, accountName: string): Promise<boolean> {
  // 設計書検証項目：test_connectionとlist_emailsの一貫性確保
  const testResult = await mcpServer.handleRequest({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: 'test_connection', arguments: { account_name: accountName } },
    id: 1
  });
  
  const listResult = await mcpServer.handleRequest({
    jsonrpc: '2.0', 
    method: 'tools/call',
    params: { name: 'list_emails', arguments: { account_name: accountName, limit: 1 } },
    id: 2
  });
  
  // 一貫性確認：test_connection成功時はlist_emailsも成功、失敗時は失敗
  if (testResult.result?.status === 'connected') {
    return listResult.error === undefined;
  } else {
    return listResult.error !== undefined;
  }
}

// 機密情報マスキング正常動作確認
export function verifyMaskingFunctionality(): boolean {
  // 設計書検証項目：機密情報マスキングの正常動作
  const testData = {
    password: 'secret123',
    refreshToken: '1//04abcdefghijklmnopqrstuvwxyz789',
    username: 'testuser'
  };
  
  const masked = maskSensitiveData(testData, ['password', 'refreshToken']);
  
  return masked.password === 'secr***123' &&
         masked.refreshToken === '1//0***z789' &&
         masked.username === 'testuser';
}
```

## 注意事項
### 【厳守事項】
- 全テストケースが確実に合格する状態を維持すること
- health:checkとnpm testの整合性を完全に確保すること
- 既存のコメントを削除しないこと
- vitestによる自動テスト実行が可能な状態を維持すること
- **【新規】設計書詳細完全反映ルールを必ず遵守すること**

### 【推奨事項】
- 包括的な検証スクリプトの実装
- 詳細なテスト結果レポート作成

### 【禁止事項】
- テストの品質や網羅性を犠牲にした実装
- vitestの設定や既存テストを破壊する変更
- npm testでテストが実行できなくなる変更
- **【新規】設計書詳細を「参照」のみで済ませる曖昧な指示**

## 参考情報
- [設計書]: `doc/design/connection-manager.md` - テスト戦略と成功基準
- [Phase 1-3成果物]: 統一接続管理システム - 検証対象
- [既存テスト]: `test/` ディレクトリ - 修正・統合対象