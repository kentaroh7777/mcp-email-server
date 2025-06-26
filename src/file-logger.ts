import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logDir = join(__dirname, '..', 'logs');

// ログディレクトリが存在しない場合は作成
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

/**
 * ファイルベースのログ出力
 */
export class FileLogger {
  private logFile: string;
  private errorFile: string;

  constructor() {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.logFile = join(logDir, `mcp-email-server-${timestamp}.log`);
    this.errorFile = join(logDir, `mcp-email-server-error-${timestamp}.log`);
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${level}] ${message}${argsStr}\n`;
  }

  debug(message: string, ...args: any[]): void {
    const logMessage = this.formatMessage('DEBUG', message, ...args);
    appendFileSync(this.logFile, logMessage);
  }

  info(message: string, ...args: any[]): void {
    const logMessage = this.formatMessage('INFO', message, ...args);
    appendFileSync(this.logFile, logMessage);
  }

  warn(message: string, ...args: any[]): void {
    const logMessage = this.formatMessage('WARN', message, ...args);
    appendFileSync(this.logFile, logMessage);
    appendFileSync(this.errorFile, logMessage);
  }

  error(message: string, ...args: any[]): void {
    const logMessage = this.formatMessage('ERROR', message, ...args);
    appendFileSync(this.logFile, logMessage);
    appendFileSync(this.errorFile, logMessage);
  }

  log(message: string, ...args: any[]): void {
    const logMessage = this.formatMessage('LOG', message, ...args);
    appendFileSync(this.logFile, logMessage);
  }
}

// グローバルなファイルロガーインスタンス
let fileLogger: FileLogger | null = null;

// 元のconsole.logを保存（MCP応答用）
const originalConsoleLog = console.log;

/**
 * 本番環境でのconsoleオーバーライド
 */
export function setupProductionLogging(): void {
  if (process.env.NODE_ENV === 'production') {
    fileLogger = new FileLogger();
    
    // 全てのconsoleメソッドをファイルログに変更
    console.debug = (message: string, ...args: any[]) => fileLogger?.debug(message, ...args);
    console.info = (message: string, ...args: any[]) => fileLogger?.info(message, ...args);
    console.log = (message: string, ...args: any[]) => fileLogger?.log(message, ...args);
    console.warn = (message: string, ...args: any[]) => fileLogger?.warn(message, ...args);
    console.error = (message: string, ...args: any[]) => fileLogger?.error(message, ...args);
  }
}

/**
 * MCP応答専用の標準出力関数
 */
export function outputMCPResponse(response: any): void {
  // 本番環境でも常に標準出力にJSON応答を出力
  originalConsoleLog(JSON.stringify(response));
}

/**
 * 手動でファイルログに記録する関数
 */
export function logToFile(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
  if (process.env.NODE_ENV === 'production') {
    if (!fileLogger) {
      fileLogger = new FileLogger();
    }
    fileLogger[level](message, ...args);
  } else {
    // 開発環境では通常のconsoleに出力
    console[level](`[${level.toUpperCase()}] ${message}`, ...args);
  }
} 