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

  it('should log connection reuse event', () => {
    // 接続再利用イベントのログ記録テスト
    expect(() => {
      logger.logConnectionEvent('REUSE', 'test_account', 'imap');
    }).not.toThrow();
  });

  it('should log connection cleanup event', () => {
    // 接続クリーンアップイベントのログ記録テスト
    expect(() => {
      logger.logConnectionEvent('CLEANUP', 'test_account', 'gmail');
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

  it('should handle different account types', () => {
    // 異なるアカウントタイプのテスト
    expect(() => {
      logger.logConnectionEvent('CREATE', 'gmail_account', 'gmail');
      logger.logConnectionEvent('CREATE', 'imap_account', 'imap');
    }).not.toThrow();
  });

  it('should handle zero pool counts', () => {
    // プールカウントが0の場合のテスト
    expect(() => {
      logger.logPoolStatus(0, 0);
    }).not.toThrow();
  });
});