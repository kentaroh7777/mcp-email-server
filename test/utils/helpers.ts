import McpEmailServer from '../../src/index.js';
import { MCPRequest, MCPResponse } from '../../src/types.js';
import { loadAccounts } from '../../src/config/account-loader.js';

export interface TestEnvironment {
  hasGmail: boolean;
  hasImap: boolean;
  firstGmailAccount?: string;
  firstImapAccount?: string;
  allGmailAccounts: string[];
  allImapAccounts: string[];
}

/**
 * テスト環境の設定状況を確認
 */
export function getTestEnvironment(): TestEnvironment {
  console.log('getTestEnvironment: Loading accounts...');
  const allAccounts = loadAccounts();
  console.log(`getTestEnvironment: Total accounts loaded by account-loader: ${allAccounts.length}`);
  
  const allGmailAccounts = allAccounts.filter(acc => acc.type === 'gmail').map(acc => acc.name);
  const allImapAccounts = allAccounts.filter(acc => acc.type === 'imap').map(acc => acc.name);
  
  console.log(`getTestEnvironment: Gmail accounts found: ${allGmailAccounts.join(', ') || 'None'}`);
  console.log(`getTestEnvironment: IMAP accounts found: ${allImapAccounts.join(', ') || 'None'}`);

  return {
    hasGmail: allGmailAccounts.length > 0,
    hasImap: allImapAccounts.length > 0,
    firstGmailAccount: allGmailAccounts[0],
    firstImapAccount: allImapAccounts[0],
    allGmailAccounts,
    allImapAccounts
  };
}

/**
 * テスト実行の前提条件をチェック
 */
export function checkTestPrerequisites(): { canRun: boolean; message: string } {
  const env = getTestEnvironment();
  
  if (!env.hasGmail && !env.hasImap) {
    return {
      canRun: false,
      message: 'テスト実行には最低1つのGmailアカウントまたは1つのIMAPアカウントの設定が必要です。.envファイルを確認してください。'
    };
  }
  
  if (!env.hasGmail) {
    return {
      canRun: true,
      message: `IMAPアカウントのみでテスト実行: ${env.allImapAccounts.length}アカウント`
    };
  }
  
  if (!env.hasImap) {
    return {
      canRun: true,
      message: `Gmailアカウントのみでテスト実行: ${env.allGmailAccounts.length}アカウント`
    };
  }
  
  return {
    canRun: true,
    message: `完全なテスト環境: Gmail ${env.allGmailAccounts.length}アカウント, IMAP ${env.allImapAccounts.length}アカウント`
  };
}

/**
 * テスト環境でのログ出力（本番環境では抑制）
 */
export function testLog(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message);
  }
}

/**
 * テストで使用するサンプルアカウント名を取得
 */
export function getTestAccountName(type: 'gmail' | 'imap'): string | null {
  const env = getTestEnvironment();
  
  if (type === 'gmail') {
    return env.firstGmailAccount || null;
  } else {
    return env.firstImapAccount || null;
  }
}

/**
 * 日付範囲検索用のテスト日付を取得（昨日）
 */
export function getTestDateRange(): { dateAfter: string; dateBefore: string } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  
  return {
    dateAfter: `${year}/${month}/${day} 00:00:00`,
    dateBefore: `${year}/${month}/${day} 23:59:59`
  };
}

/**
 * 実際の状態検証結果の型定義
 */
export interface StateVerificationResult {
  valid: boolean;
  expected: any;
  actual: any;
  error?: string;
  details?: any;
}

/**
 * API呼び出し監視結果の型定義
 */
export interface APICallMonitorResult {
  unexpectedCalls: string[];
  suspiciousPatterns: string[];
  safe: boolean;
}

/**
 * ログ監視クラス - DEBUGエラーと予期しないAPI呼び出しを検出
 */
export class LogMonitor {
  private logs: string[] = [];
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private isMonitoring = false;

  constructor() {
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.logs = [];
    this.isMonitoring = true;

    // コンソール出力をインターセプト
    console.log = (...args) => {
      const message = args.join(' ');
      this.logs.push(`[LOG] ${message}`);
      this.originalConsoleLog(...args);
    };

    console.error = (...args) => {
      const message = args.join(' ');
      this.logs.push(`[ERROR] ${message}`);
      this.originalConsoleError(...args);
    };

    console.warn = (...args) => {
      const message = args.join(' ');
      this.logs.push(`[WARN] ${message}`);
      this.originalConsoleWarn(...args);
    };
  }

  stopMonitoring(): APICallMonitorResult {
    if (!this.isMonitoring) {
      return { unexpectedCalls: [], suspiciousPatterns: [], safe: true };
    }

    // コンソールを復元
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    this.isMonitoring = false;

    return this.analyzeCollectedLogs();
  }

  private analyzeCollectedLogs(): APICallMonitorResult {
    const unexpectedCalls: string[] = [];
    const suspiciousPatterns: string[] = [];

    // 危険なパターンを検出
    const dangerousPatterns = [
      { pattern: /\[DEBUG\] Archive error/, reason: 'Archive API error occurred' },
      { pattern: /Gmail archive failed/, reason: 'Gmail API failure detected' },
      { pattern: /Invalid id value/, reason: 'Invalid API parameters used' },
      { pattern: /Gmail API error/, reason: 'Gmail API error occurred' },
      { pattern: /IMAP error.*dummy/, reason: 'IMAP error with dummy data' }
    ];

    // 予期しないAPI呼び出しパターン
    const apiCallPatterns = [
      { pattern: /Making Gmail API request/, reason: 'Unexpected Gmail API call' },
      { pattern: /Gmail API response received/, reason: 'Unexpected Gmail API response' },
      { pattern: /IMAP connection established.*dummy/, reason: 'Unexpected IMAP connection with dummy data' }
    ];

    for (const log of this.logs) {
      // 危険なパターンをチェック
      for (const { pattern, reason } of dangerousPatterns) {
        if (pattern.test(log)) {
          suspiciousPatterns.push(`${reason}: ${log}`);
        }
      }

      // API呼び出しパターンをチェック
      for (const { pattern, reason } of apiCallPatterns) {
        if (pattern.test(log)) {
          unexpectedCalls.push(`${reason}: ${log}`);
        }
      }
    }

    return {
      unexpectedCalls,
      suspiciousPatterns,
      safe: unexpectedCalls.length === 0 && suspiciousPatterns.length === 0
    };
  }

  getAllLogs(): string[] {
    return [...this.logs];
  }
}

export class TestHelper {
  private server: McpEmailServer;
  private logMonitor: LogMonitor;

  constructor() {
    this.server = new McpEmailServer();
    this.logMonitor = new LogMonitor();
  }

  // MCP-todoist形式のレスポンスから実際のデータを抽出
  private extractMCPData(response: MCPResponse): any {
    if (response.error) return null;
    if (!response.result) return null;
    
    // mcp-todoist形式: {content: [{type: 'text', text: JSON.stringify(data)}]}
    if (response.result.content && Array.isArray(response.result.content)) {
      const textContent = response.result.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.text) {
        try {
          return JSON.parse(textContent.text);
        } catch (e) {
          console.error('Failed to parse MCP content:', e);
          return null;
        }
      }
    }
    
    return response.result;
  }

  // 実際の状態検証のためのヘルパーメソッド
  async verifyAccountExists(accountName: string): Promise<boolean> {
    const response = await this.callTool('list_accounts', {});
    if (response.error) return false;
    
    const data = this.extractMCPData(response);
    const accounts = data?.accounts || [];
    return accounts.some((acc: any) => acc.name === accountName);
  }

  async verifyAccountConnection(accountName: string): Promise<{ connected: boolean; message: string }> {
    const response = await this.callTool('test_connection', { account_name: accountName });
    if (response.error) {
      return { connected: false, message: response.error.message };
    }
    
    const data = this.extractMCPData(response);
    return {
      connected: data?.status === 'connected',
      message: data?.testResult || 'Unknown status'
    };
  }

  async verifyUnreadCount(accountName: string, expectedMinimum: number = 0): Promise<{ valid: boolean; actual: number }> {
    // 統合ツールを使用
    const response = await this.callTool('list_emails', { 
      account_name: accountName,
      unread_only: true,
      limit: 1
    });
    
    if (response.error) {
      return { valid: false, actual: -1 };
    }
    
    // MCP形式のレスポンスからデータを抽出
    const data = this.extractMCPData(response);
    let count = -1;
    if (data && typeof data === 'object') {
      if ('unread_count' in data) {
        count = data.unread_count;
      } else if ('unreadCount' in data) {
        count = data.unreadCount;
      } else if ('emails' in data && Array.isArray(data.emails)) {
        // フォールバック: 実際のメール数から推測
        count = data.emails.length;
      }
    }
    
    return {
      valid: count >= expectedMinimum,
      actual: count
    };
  }

  async verifySearchResults(query: string, accounts: string = 'ALL', expectedMinimum: number = 0): Promise<{ valid: boolean; count: number; errors: string[] }> {
    const response = await this.callTool('search_all_emails', {
      query,
      accounts,
      limit: 10
    });
    
    if (response.error) {
      return { valid: false, count: 0, errors: [response.error.message] };
    }
    
    const data = this.extractMCPData(response);
    return {
      valid: (data?.emails?.length || 0) >= expectedMinimum,
      count: data?.emails?.length || 0,
      errors: data?.errors || []
    };
  }

  // MCP リクエストを送信するヘルパーメソッド
  async callTool(name: string, args: any): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: `test-${Date.now()}`,
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    return await this.server.handleRequest(request);
  }

  // MCP メソッドを直接呼び出すヘルパーメソッド
  async callMCPMethod(method: string, params: any): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: `test-${Date.now()}`,
      method,
      params
    };

    return await this.server.handleRequest(request);
  }

  // 環境設定の検証
  getConfiguredAccounts(): { gmail: string[]; imap: string[]; xserver: string[] } {
    const gmail: string[] = [];
    const imap: string[] = [];
    const xserver: string[] = [];

    Object.keys(process.env).forEach(key => {
      if (key.startsWith('GMAIL_REFRESH_TOKEN_')) {
        const accountName = key.replace('GMAIL_REFRESH_TOKEN_', '');
        gmail.push(accountName);
      } else if (key.startsWith('IMAP_HOST_')) {
        const accountName = key.replace('IMAP_HOST_', '');
        imap.push(accountName);
      } else if (key.startsWith('XSERVER_DOMAIN_')) {
        const accountName = key.replace('XSERVER_DOMAIN_', '');
        xserver.push(accountName);
      }
    });

    return { gmail, imap, xserver };
  }

  // 暗号化キーの検証
  isEncryptionKeyValid(): boolean {
    const key = process.env.EMAIL_ENCRYPTION_KEY;
    return !!(key && key !== 'your-encryption-key-here' && key !== 'your-very-secure-encryption-key-change-this');
  }

  // 必須ファイルの検証
  async verifyRequiredFiles(): Promise<{ exists: boolean; missing: string[] }> {
    const fs = await import('fs');
    const requiredFiles = [
      'src/index.ts',
      'src/services/gmail.ts',
      'src/services/imapflow-handler.ts',
      'src/crypto.ts',
      'src/types.ts',
      'package.json',
      'tsconfig.json',
      '.env.example'
    ];

    const missing: string[] = [];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        missing.push(file);
      }
    }

    return {
      exists: missing.length === 0,
      missing
    };
  }

  /**
   * 実際の状態検証: メールアーカイブの結果を検証
   */
  async verifyEmailArchiveState(accountName: string, emailId: string): Promise<StateVerificationResult> {
    try {
      // アーカイブ前の状態を確認
      const beforeState = await this.getEmailState(accountName, emailId);
      
      if (!beforeState.exists) {
        return {
          valid: false,
          expected: 'Email should exist before archive',
          actual: 'Email not found',
          error: 'Email does not exist before archive operation'
        };
      }

      // アーカイブ実行
      this.logMonitor.startMonitoring();
      const response = await this.callTool('archive_email', {
        account_name: accountName,
        email_id: emailId
      });
      const monitorResult = this.logMonitor.stopMonitoring();

      // ログ監視結果を確認
      if (!monitorResult.safe) {
        return {
          valid: false,
          expected: 'No suspicious API calls or errors',
          actual: `Unexpected calls: ${monitorResult.unexpectedCalls.length}, Suspicious patterns: ${monitorResult.suspiciousPatterns.length}`,
          error: 'API call monitoring detected issues',
          details: monitorResult
        };
      }

      // レスポンス検証
      if (response.error) {
        return {
          valid: false,
          expected: 'Successful archive operation',
          actual: response.error.message,
          error: 'Archive operation failed'
        };
      }

      // アーカイブ後の状態を確認
      const afterState = await this.getEmailState(accountName, emailId);
      
      return {
        valid: afterState.archived,
        expected: 'Email should be archived',
        actual: afterState.archived ? 'Email archived' : 'Email still in inbox',
        details: { beforeState, afterState, monitorResult }
      };

    } catch (error) {
      return {
        valid: false,
        expected: 'Successful state verification',
        actual: 'Exception occurred',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 実際の状態検証: メールの詳細情報取得を検証
   */
  async verifyEmailDetailRetrieval(accountName: string, emailId: string): Promise<StateVerificationResult> {
    this.logMonitor.startMonitoring();
    
    try {
      const response = await this.callTool('get_email_detail', {
        account_name: accountName,
        email_id: emailId
      });
      
      const monitorResult = this.logMonitor.stopMonitoring();

      // ログ監視結果を確認
      if (!monitorResult.safe) {
        return {
          valid: false,
          expected: 'No suspicious API calls or errors',
          actual: 'Suspicious activity detected',
          error: 'API call monitoring detected issues',
          details: monitorResult
        };
      }

      // 実際のメールが存在する場合とダミーIDの場合を区別
      if (emailId === 'dummy_id' || emailId.includes('dummy') || emailId.includes('test')) {
        // ダミーIDの場合は適切なエラーレスポンスが期待される
        const expectedError = Boolean(response.error && 
          (response.error.message.includes('not found') || 
           response.error.message.includes('Invalid id')));
        
        return {
          valid: expectedError,
          expected: 'Appropriate error for dummy ID',
          actual: response.error ? response.error.message : 'Unexpected success',
          details: { monitorResult }
        };
      }

      // 実際のメールIDの場合
      if (response.error) {
        return {
          valid: false,
          expected: 'Successful email retrieval',
          actual: response.error.message,
          error: 'Failed to retrieve email details'
        };
      }

      const data = this.extractMCPData(response);
      const hasRequiredFields = Boolean(data && 
        typeof data.subject === 'string' &&
        typeof data.from === 'string' &&
        data.date);

      return {
        valid: hasRequiredFields,
        expected: 'Email with required fields (subject, from, date)',
        actual: hasRequiredFields ? 'All required fields present' : 'Missing required fields',
        details: { data, monitorResult }
      };

    } catch (error) {
      this.logMonitor.stopMonitoring();
      return {
        valid: false,
        expected: 'Successful detail retrieval',
        actual: 'Exception occurred',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 実際の状態検証: メール送信の結果を検証
   */
  async verifySendEmailState(params: {
    account_name: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<StateVerificationResult> {
    this.logMonitor.startMonitoring();
    
    try {
      const response = await this.callTool('send_email', params);
      const monitorResult = this.logMonitor.stopMonitoring();

      // ログ監視結果を確認
      if (!monitorResult.safe) {
        return {
          valid: false,
          expected: 'No suspicious API calls or errors',
          actual: 'Suspicious activity detected',
          error: 'API call monitoring detected issues',
          details: monitorResult
        };
      }

      // レスポンス検証
      if (response.error) {
        return {
          valid: false,
          expected: 'Successful email send',
          actual: response.error.message,
          error: 'Send operation failed'
        };
      }

      const data = this.extractMCPData(response);
      const success = Boolean(data?.success === true && data?.messageId);

      return {
        valid: success,
        expected: 'Successful send with messageId',
        actual: success ? `Message sent with ID: ${data.messageId}` : 'Send failed or no messageId',
        details: { data, monitorResult }
      };

    } catch (error) {
      this.logMonitor.stopMonitoring();
      return {
        valid: false,
        expected: 'Successful send verification',
        actual: 'Exception occurred',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * プロトコルレベルのテスト専用：実際のAPI呼び出しを避ける
   */
  async verifyProtocolOnly(toolName: string, params: any): Promise<StateVerificationResult> {
    // 存在しないアカウント名を強制的に設定してAPI呼び出しを避ける
    const safeParams = {
      ...params,
      account_name: 'test_protocol_only_nonexistent_12345'
    };

    this.logMonitor.startMonitoring();
    
    try {
      const response = await this.callTool(toolName, safeParams);
      const monitorResult = this.logMonitor.stopMonitoring();

      // プロトコルテストでは実際のAPI呼び出しは発生すべきではない
      if (!monitorResult.safe) {
        return {
          valid: false,
          expected: 'No API calls for protocol test',
          actual: 'Unexpected API calls detected',
          error: 'Protocol test triggered actual API calls',
          details: monitorResult
        };
      }

      // ツール別のエラーハンドリング検証
      const hasProperError = this.checkProperErrorHandling(toolName, response);

      return {
        valid: hasProperError.isValid,
        expected: 'Proper error handling for non-existent account',
        actual: hasProperError.description,
        details: { response, monitorResult }
      };

    } catch (error) {
      this.logMonitor.stopMonitoring();
      return {
        valid: false,
        expected: 'Proper protocol handling',
        actual: 'Exception occurred',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * ツール別の適切なエラーハンドリングを検証
   */
  private checkProperErrorHandling(toolName: string, response: any): { isValid: boolean; description: string } {
    // 直接的なエラーレスポンス（list_emails, search_emails, get_email_detail等）
    if (response.error) {
      return {
        isValid: true,
        description: `Appropriate error response: ${response.error.message}`
      };
    }

    // MCPコンテンツからデータを抽出
    const data = this.extractMCPData(response);

    // send_emailツールの場合
    if (toolName === 'send_email') {
      if (data && data.success === false && data.error) {
        return {
          isValid: true,
          description: `Send email error handled properly: ${data.error}`
        };
      }
    }

    // archive_emailツールの場合
    if (toolName === 'archive_email') {
      if (data && data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        return {
          isValid: true,
          description: `Archive email errors handled properly: ${data.errors.length} errors`
        };
      }
    }

    // その他のツールで結果データがあるが、適切なエラーがない場合
    if (data) {
      return {
        isValid: false,
        description: `Unexpected success response for non-existent account: ${JSON.stringify(data)}`
      };
    }

    // レスポンスがない場合
    return {
      isValid: false,
      description: 'No response data received'
    };
  }

  /**
   * メールの状態を取得（実際の状態検証用）
   */
  private async getEmailState(accountName: string, emailId: string): Promise<{
    exists: boolean;
    archived: boolean;
    folder?: string;
    subject?: string;
  }> {
    try {
      // メール詳細を取得して存在確認
      const detailResponse = await this.callTool('get_email_detail', {
        account_name: accountName,
        email_id: emailId
      });

      if (detailResponse.error) {
        return { exists: false, archived: false };
      }

      const data = this.extractMCPData(detailResponse);
      
             // フォルダ情報からアーカイブ状態を判定
       const isArchived = Boolean(data?.folder === 'Archive' || 
                         data?.folder === '[Gmail]/All Mail' ||
                         data?.labels?.includes('ARCHIVED'));

       return {
         exists: true,
         archived: isArchived,
         folder: data?.folder,
         subject: data?.subject
       };

    } catch (error) {
      return { exists: false, archived: false };
    }
  }
} 