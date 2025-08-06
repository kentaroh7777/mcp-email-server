import { logToFile } from './file-logger.js';

/**
 * ConnectionLogger専用インターフェース（設計書Line 114-125対応）
 */
interface IConnectionLogger {
  logConnectionEvent(event: 'CREATE' | 'REUSE' | 'CLEANUP', accountName: string, accountType: 'gmail' | 'imap'): void;
  logConnectionError(accountName: string, operation: string, error: Error): void;
  logPoolStatus(gmailCount: number, imapCount: number): void;
}

/**
 * 接続ログ専用クラス（設計書Line 137-177対応）
 */
export class ConnectionLogger implements IConnectionLogger {
  private static instance: ConnectionLogger | null = null;
  
  public static getInstance(): ConnectionLogger {
    if (!ConnectionLogger.instance) {
      ConnectionLogger.instance = new ConnectionLogger();
    }
    return ConnectionLogger.instance;
  }
  
  /**
   * 接続イベントをログ記録
   * フォーマット: [INFO] [CONNECTION] GMAIL CREATE kentaroh7: New connection established
   */
  logConnectionEvent(event: 'CREATE' | 'REUSE' | 'CLEANUP', accountName: string, accountType: 'gmail' | 'imap'): void {
    const message = `[CONNECTION] ${accountType.toUpperCase()} ${event} ${accountName}`;
    const details = this.getEventDetails(event);
    logToFile('info', message, details);
  }
  
  /**
   * 接続エラーをログ記録
   */
  logConnectionError(accountName: string, operation: string, error: Error): void {
    const message = `[CONNECTION] ${accountName} FAILED ${operation}`;
    logToFile('error', message, error.message);
  }
  
  /**
   * 接続プール状況をログ記録
   */
  logPoolStatus(gmailCount: number, imapCount: number): void {
    const message = `[CONNECTION] POOL_STATUS: Gmail: ${gmailCount} active, IMAP: ${imapCount} active`;
    logToFile('info', message);
  }
  
  /**
   * イベント詳細取得
   */
  private getEventDetails(event: string): string {
    switch (event) {
      case 'CREATE': return 'New connection established';
      case 'REUSE': return 'Using cached connection';
      case 'CLEANUP': return 'Connection cleaned up';
      default: return '';
    }
  }
}