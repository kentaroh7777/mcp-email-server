import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 機密情報マスキング設定（設計書通り）
const MASKING_CONFIG = {
  partialMasking: {
    prefixLength: 4,
    suffixLength: 4,  
    maskChar: '*'
  },
  sensitiveFields: ['password', 'refreshToken', 'encryptionKey', 'clientSecret']
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logDir = join(__dirname, '..', 'logs');

// ログディレクトリが存在しない場合は作成
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

/**
 * 機密情報マスキング関数（設計書Line 349-372から転記）
 */
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
        const maskLength = Math.max(3, value.length - MASKING_CONFIG.partialMasking.prefixLength - MASKING_CONFIG.partialMasking.suffixLength);
        masked[key] = prefix + MASKING_CONFIG.partialMasking.maskChar.repeat(maskLength) + suffix;
      }
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key], sensitiveFields);
    }
  }
  
  return masked;
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
export function logToFile(_level: 'debug' | 'info' | 'warn' | 'error', _message: string, ..._args: any[]): void {
  // ログ出力を完全に無効化（MCP接続問題のデバッグのため）
  // if (process.env.NODE_ENV === 'production') {
  //   if (!fileLogger) {
  //     fileLogger = new FileLogger();
  //   }
  //   fileLogger[level](message, ...args);
  // } else {
  //   // 開発環境では通常のconsoleに出力
  //   console[level](`[${level.toUpperCase()}] ${message}`, ...args);
  // }
} 