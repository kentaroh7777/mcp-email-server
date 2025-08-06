# Task 1: ログ拡張・基盤整備

## 概要
既存のfile-logger.tsに機密情報マスキング機能と接続ログ専用機能を追加し、Phase 2のConnectionManager実装に必要な基盤を整備する。

## 設計書詳細反映確認【新規必須セクション】
### 設計書参照箇所
- **設計書ファイル**: `doc/design/connection-manager.md`
- **参照セクション**: 4.1.2 ConnectionLogger、4.3 ログ設計
- **参照行数**: Line 114-177

### 設計書詳細の具体的反映

#### コード例（設計書から転記）
```typescript
// 設計書Line 119-123 から転記
interface ConnectionLogger {
  logConnectionEvent(event: 'CREATE' | 'REUSE' | 'CLEANUP', accountName: string, accountType: 'gmail' | 'imap'): void;
  logConnectionError(accountName: string, operation: string, error: Error): void;
  logPoolStatus(gmailCount: number, imapCount: number): void;
}
```

#### 操作手順（設計書から転記）
1. **手順1**: file-logger.tsに機密情報マスキング機能を追加
2. **手順2**: ConnectionLogger専用インターフェースを実装
3. **手順3**: 部分表示方式のマスキング機能を実装

#### 固有値・設定値（設計書から転記）
- **マスキング設定**: `prefixLength: 4, suffixLength: 4, maskChar: '*'`
- **機密フィールド**: `['password', 'refreshToken', 'encryptionKey', 'clientSecret']`
- **ログフォーマット**: `[INFO] [CONNECTION] GMAIL CREATE kentaroh7: New connection established`

### 曖昧指示チェック
**以下の曖昧な指示を含まないことを確認**
- [x] "設計書を参照して実装"
- [x] "設計書通りに実装"
- [x] "～の実際のシナリオを実装"
- [x] "詳細は設計書を参照"

## 依存関係
- 本実装の元となる設計書: `doc/design/connection-manager.md`
- 既存ファイル: `src/file-logger.ts` の拡張

### 前提条件
- src/file-logger.ts: 既存のFileLoggerクラス - 機密マスキング機能追加のベース

### 成果物
- `src/file-logger.ts` - 機密情報マスキング機能追加
- `src/connection-logger.ts` - 接続専用ログ機能（新規作成）

### テスト成果物【必須】
- **テストファイル**: `src/tests/logging/connection-logger.test.ts` - 接続ログ機能のテスト
- **テストファイル**: `src/tests/logging/masking.test.ts` - 機密マスキング機能のテスト
- **vitest設定**: `vitest.config.ts` - テスト環境設定（既存確認・必要に応じて修正）
- **npmテストスクリプト**: `package.json`の`scripts.test`設定確認・追加

### 影響範囲
- src/file-logger.ts - 機密マスキング機能追加
- src/connection-logger.ts - 新規作成

## 実装要件
### 【必須制約】機密情報保護
- **機密マスキング必須**: password, refreshToken, encryptionKey, clientSecret は必ず部分表示でマスク
- **部分表示形式**: 先頭4文字 + マスク + 末尾4文字（例: "secr***123"）

### 技術仕様
```typescript
// 型定義例（必須）
interface MaskingConfig {
  partialMasking: {
    prefixLength: 4;
    suffixLength: 4;  
    maskChar: '*';
  };
  sensitiveFields: string[];
}

interface ConnectionLogger {
  logConnectionEvent(event: 'CREATE' | 'REUSE' | 'CLEANUP', accountName: string, accountType: 'gmail' | 'imap'): void;
  logConnectionError(accountName: string, operation: string, error: Error): void;
  logPoolStatus(gmailCount: number, imapCount: number): void;
}

// 実装例（必須）
export const maskSensitiveData = (data: any, config: MaskingConfig): any => {
  // 具体的な実装コード
};
```

### 設計パターン
**参考**: `src/file-logger.ts`の`FileLogger`クラスパターンを踏襲
**理由**: 既存のログシステムとの一貫性維持とグローバル利用可能性

## 実装ガイド【設計書詳細反映必須】
### ステップ1: 機密情報マスキング機能追加
**【設計書Line 149-176 対応】**
```typescript
// 設計書から転記した具体的なコード
// 機密情報マスキング設定
interface MaskingConfig {
  partialMasking: {
    prefixLength: 4;    // 先頭4文字表示
    suffixLength: 4;    // 末尾4文字表示  
    maskChar: '*';      // マスク文字
  };
  sensitiveFields: ['password', 'refreshToken', 'encryptionKey', 'clientSecret'];
}

// マスキング例実装
// Original: { refreshToken: "1//04abcd...xyz789", password: "secret123" }
// Masked:   { refreshToken: "1//0***89", password: "secr***23" }
export function maskSensitiveData(data: any, sensitiveFields: string[]): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const masked = { ...data };
  for (const field of sensitiveFields) {
    if (masked[field] && typeof masked[field] === 'string') {
      const value = masked[field];
      if (value.length <= 8) {
        masked[field] = '*'.repeat(value.length);
      } else {
        const prefix = value.substring(0, 4);
        const suffix = value.substring(value.length - 4);
        const maskLength = Math.max(3, value.length - 8);
        masked[field] = prefix + '*'.repeat(maskLength) + suffix;
      }
    }
  }
  return masked;
}
```

### ステップ2: ConnectionLogger専用クラス実装
**【設計書Line 114-125 対応】**
```typescript
// 設計書の詳細を反映した実装コード
import { FileLogger, logToFile } from './file-logger.js';

export class ConnectionLogger {
  private static instance: ConnectionLogger | null = null;
  
  public static getInstance(): ConnectionLogger {
    if (!ConnectionLogger.instance) {
      ConnectionLogger.instance = new ConnectionLogger();
    }
    return ConnectionLogger.instance;
  }
  
  logConnectionEvent(event: 'CREATE' | 'REUSE' | 'CLEANUP', accountName: string, accountType: 'gmail' | 'imap'): void {
    const message = `[CONNECTION] ${accountType.toUpperCase()} ${event} ${accountName}`;
    const details = this.getEventDetails(event);
    logToFile('info', message, details);
  }
  
  logConnectionError(accountName: string, operation: string, error: Error): void {
    const message = `[CONNECTION] ${accountName} FAILED ${operation}`;
    logToFile('error', message, error.message);
  }
  
  logPoolStatus(gmailCount: number, imapCount: number): void {
    const message = `[CONNECTION] POOL_STATUS: Gmail: ${gmailCount} active, IMAP: ${imapCount} active`;
    logToFile('info', message);
  }
  
  private getEventDetails(event: string): string {
    switch (event) {
      case 'CREATE': return 'New connection established';
      case 'REUSE': return 'Using cached connection';
      case 'CLEANUP': return 'Connection cleaned up';
      default: return '';
    }
  }
}
```

### テスト環境構築【全プロジェクト必須】
#### ステップA: vitest環境確認・設定
```bash
# vitestインストール確認（未インストールの場合）
npm install -D vitest

# TypeScript設定ファイル確認
# tsconfig.jsonにtest設定が含まれているか確認
```

#### ステップB: vitest設定ファイル作成・確認
```typescript
// vitest.config.ts （新規作成または確認・修正）
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '**/*.d.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/tests/**', '**/*.d.ts']
    }
  }
})
```

#### ステップC: npmスクリプト設定確認・追加
```json
// package.json のscriptsセクション確認・追加
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### ステップD: テストファイル作成
```typescript
// src/tests/logging/connection-logger.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { ConnectionLogger } from '../../connection-logger.js'

describe('ConnectionLogger', () => {
  let logger: ConnectionLogger;

  beforeEach(() => {
    logger = ConnectionLogger.getInstance();
  });

  it('should create singleton instance', () => {
    const logger1 = ConnectionLogger.getInstance();
    const logger2 = ConnectionLogger.getInstance();
    expect(logger1).toBe(logger2);
  });

  it('should log connection create event', () => {
    // 接続作成イベントのログ記録テスト
    expect(() => {
      logger.logConnectionEvent('CREATE', 'test_account', 'gmail');
    }).not.toThrow();
  });

  it('should log connection error', () => {
    // 接続エラーログ記録テスト
    const error = new Error('Test connection failed');
    expect(() => {
      logger.logConnectionError('test_account', 'testConnection', error);
    }).not.toThrow();
  });

  it('should log pool status', () => {
    // プール状況ログ記録テスト
    expect(() => {
      logger.logPoolStatus(2, 1);
    }).not.toThrow();
  });
});
```

```typescript
// src/tests/logging/masking.test.ts
import { describe, it, expect } from 'vitest'
import { maskSensitiveData } from '../../file-logger.js'

describe('Sensitive Data Masking', () => {
  const sensitiveFields = ['password', 'refreshToken', 'encryptionKey', 'clientSecret'];

  it('should mask sensitive fields with partial display', () => {
    const data = {
      password: 'secret123',
      refreshToken: '1//04abcdefghijklmnopqrstuvwxyz789',
      username: 'testuser'
    };
    
    const masked = maskSensitiveData(data, sensitiveFields);
    
    expect(masked.password).toBe('secr***123');
    expect(masked.refreshToken).toBe('1//0***z789');
    expect(masked.username).toBe('testuser'); // 非機密は変更されない
  });

  it('should handle short sensitive values', () => {
    const data = { password: 'short' };
    const masked = maskSensitiveData(data, sensitiveFields);
    expect(masked.password).toBe('*****');
  });

  it('should handle non-object input', () => {
    expect(maskSensitiveData('string', sensitiveFields)).toBe('string');
    expect(maskSensitiveData(null, sensitiveFields)).toBe(null);
    expect(maskSensitiveData(123, sensitiveFields)).toBe(123);
  });
});
```

## 検証基準【ユーザー承認済み】
### 機能検証
- [ ] 機密情報マスキングが正常に動作する（部分表示形式）
- [ ] 接続ログが適切なフォーマットで出力される
- [ ] ConnectionLoggerのシングルトン実装が動作する

### 技術検証
- [ ] TypeScript strict modeでコンパイル成功
- [ ] ESLintエラー0件
- [ ] vitestによるテストケース実装完了
- [ ] 既存テストが継続して通る
- [ ] 基本ルール（@test-debug-rule.mdc）準拠

### 設計書詳細反映検証【新規必須】
- [x] 設計書の具体的コード例が実装指示書に転記済み
- [x] 設計書の操作手順が明確に記載済み
- [x] 設計書の固有値（マスキング設定等）が具体的に記載済み
- [x] 曖昧な指示（"設計書を参照"等）が排除済み
- [x] エラーハンドリングの詳細が設計書から反映済み

### 自動テスト検証【必須】
- [ ] `npm test` でテスト実行可能
- [ ] `npm run test:run` で非対話モード実行可能
- [ ] 実装したテストケースが全て合格
- [ ] テストカバレッジが適切（新規コードの主要パスを網羅）
- [ ] CI/CD環境での実行を考慮した設定

### 統合検証
- [ ] 既存のlogToFile関数との連携確認
- [ ] 機密マスキングのパフォーマンス要件の確認

## 実装例【設計書詳細反映版】
```typescript
// 【設計書Line 149-176 から転記】具体的な実装例
// 設計書の詳細を完全に反映した実装コード
// src/file-logger.ts への追加

// 機密情報マスキング設定（設計書通り）
const MASKING_CONFIG = {
  partialMasking: {
    prefixLength: 4,
    suffixLength: 4,  
    maskChar: '*'
  },
  sensitiveFields: ['password', 'refreshToken', 'encryptionKey', 'clientSecret']
};

export function maskSensitiveData(data: any, sensitiveFields: string[] = MASKING_CONFIG.sensitiveFields): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const masked = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in masked) {
    if (sensitiveFields.includes(key) && typeof masked[key] === 'string') {
      const value = masked[key];
      if (value.length <= 8) {
        masked[key] = MASKING_CONFIG.partialMasking.maskChar.repeat(value.length);
      } else {
        const prefix = value.substring(0, MASKING_CONFIG.partialMasking.prefixLength);
        const suffix = value.substring(value.length - MASKING_CONFIG.partialMasking.suffixLength);
        const maskLength = Math.max(3, value.length - 8);
        masked[key] = prefix + MASKING_CONFIG.partialMasking.maskChar.repeat(maskLength) + suffix;
      }
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key], sensitiveFields);
    }
  }
  
  return masked;
}

// FileLoggerクラスのformatMessageメソッドを拡張
// 既存のformatMessageメソッドを修正
private formatMessage(level: string, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const maskedArgs = args.map(arg => 
    typeof arg === 'object' && arg !== null 
      ? maskSensitiveData(arg) 
      : arg
  );
  const argsStr = maskedArgs.length > 0 ? ' ' + maskedArgs.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ') : '';
  return `[${timestamp}] [${level}] ${message}${argsStr}\n`;
}
```

## 注意事項
### 【厳守事項】
- 機密情報は必ず部分表示でマスクすること
- 既存のコメントを削除しないこと
- vitestによる自動テスト実行が可能な状態を維持すること
- package.jsonのtestスクリプト設定を必ず確認・設定すること
- **【新規】設計書詳細完全反映ルールを必ず遵守すること**

### 【推奨事項】
- シングルトンパターンの適切な実装
- エラーハンドリングの適切な実装

### 【禁止事項】
- 機密情報の平文ログ出力
- vitestの設定や既存テストを破壊する変更
- npm testでテストが実行できなくなる変更
- **【新規】設計書詳細を「参照」のみで済ませる曖昧な指示**

## 参考情報
- [設計書]: `doc/design/connection-manager.md` - ログ設計と機密マスキング仕様
- [既存実装]: `src/file-logger.ts` - 拡張対象のベースクラス