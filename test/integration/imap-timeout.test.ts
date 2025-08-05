import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { GmailHandler } from '../../src/services/gmail.js';
import { checkTestPrerequisites, getTestAccountName, getTestDateRange, getTestEnvironment } from '../utils/helpers.js';

describe('IMAP Tools Timeout Prevention', () => {
  const serverPath = path.join(process.cwd(), 'scripts/run-email-server.ts');
  const TIMEOUT_MS = 10000; // 10秒タイムアウト

  let gmailHandler: GmailHandler;
  let testEnv: ReturnType<typeof getTestEnvironment>;

  beforeAll(() => {
    const { canRun, message } = checkTestPrerequisites();
    console.log(`テスト環境チェック: ${message}`);
    
    if (!canRun) {
      throw new Error(message);
    }

    gmailHandler = new GmailHandler([]);
    testEnv = getTestEnvironment();
  });

  // Test helper function to run MCP command with timeout
  async function runMCPCommand(command: any, timeoutMs: number = TIMEOUT_MS): Promise<{
    success: boolean;
    response?: any;
    error?: string;
    timedOut: boolean;
  }> {
    return new Promise((resolve) => {
      const child = spawn('npx', ['tsx', serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Command timed out',
          timedOut: true
        });
      }, timeoutMs);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (timedOut) return; // Already resolved

        try {
          const jsonOutput = stdout.split('\n').filter(line => line.startsWith('{') && line.endsWith('}')).pop();          if (jsonOutput) {            const response = JSON.parse(jsonOutput);
            resolve({
              success: true,
              response,
              timedOut: false
            });
          } else {
            resolve({
              success: false,
              error: `No output. Code: ${code}, Stderr: ${stderr}`,
              timedOut: false
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: `JSON parse error: ${error}. Stdout: ${stdout}, Stderr: ${stderr}`,
            timedOut: false
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `Process error: ${error.message}`,
          timedOut: false
        });
      });

      // Send the command
      child.stdin.write(JSON.stringify(command) + '\n');
      child.stdin.end();
    });
  }

  it.skipIf(!getTestAccountName('imap'))('should respond within timeout for list_emails', async () => {
    const imapAccount = getTestAccountName('imap')!;
    const command = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: {
          account_name: imapAccount,
          limit: 1
        }
      }
    };

    const result = await runMCPCommand(command, 5000);

    // デバッグ用ログ
    if (!result.success) {
      console.log('list_emails test failed:', result.error);
      console.log('TimedOut:', result.timedOut);
      console.log('Response:', result.response);
    }

    expect(result.timedOut).toBe(false);
    expect(result.success).toBe(true);
    expect(result.response).toBeDefined();
    if (result.response.error) {
      expect(result.response.error.message).toContain('Failed to decrypt password or connect');
    } else {
      expect(result.response.result).toBeDefined();
      const emails = JSON.parse(result.response.result.content[0].text);
      expect(emails.emails).toBeDefined();
      expect(Array.isArray(emails.emails)).toBe(true);
    }
  }, 10000);

  it.skipIf(!getTestAccountName('imap'))('should respond within timeout for list_emails with unread_only', async () => {
    const imapAccount = getTestAccountName('imap')!;
    const command = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: {
          account_name: imapAccount,
          unread_only: true,
          limit: 50
        }
      }
    };

    const result = await runMCPCommand(command, 5000);

    // デバッグ用ログ
    if (!result.success) {
      console.log('list_emails with unread_only test failed:', result.error);
      console.log('TimedOut:', result.timedOut);
      console.log('Response:', result.response);
    }

    expect(result.timedOut).toBe(false);
    expect(result.success).toBe(true);
    expect(result.response).toBeDefined();
    if (result.response.error) {
      expect(result.response.error.message).toContain('Failed to decrypt password or connect');
    } else {
      const emailsResult = JSON.parse(result.response.result.content[0].text);
      expect(emailsResult.emails).toBeDefined();
      expect(Array.isArray(emailsResult.emails)).toBe(true);
      expect(emailsResult.unread_count).toBeDefined();
      expect(typeof emailsResult.unread_count).toBe('number');
    }
  }, 10000);

  it('should handle invalid account gracefully', async () => {
    const command = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'list_emails',
        arguments: {
          account_name: 'invalid_account',
          limit: 1
        }
      }
    };

    const result = await runMCPCommand(command, 5000);

    // デバッグ用ログ
    if (!result.success) {
      console.log('invalid account test failed:', result.error);
      console.log('TimedOut:', result.timedOut);
      console.log('Response:', result.response);
    }

    expect(result.timedOut).toBe(false);
    expect(result.success).toBe(true);
    expect(result.response).toBeDefined();
    expect(result.response.error).toBeDefined();
  }, 10000);

  it.skipIf(() => getTestEnvironment().allImapAccounts.length < 2)('should handle multiple accounts without timeout', async () => {
    const imapAccounts = testEnv.allImapAccounts;
    const commands = [
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: imapAccounts[0], limit: 1 }
        }
      },
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: { account_name: imapAccounts[1] || imapAccounts[0], unread_only: true, limit: 10 }
        }
      }
    ];

    const results = await Promise.all(
      commands.map(cmd => runMCPCommand(cmd, 8000))
    );

    results.forEach((result) => {
      expect(result.timedOut).toBe(false);
      expect(result.success).toBe(true);
    });
  }, 20000);

  it.skipIf(!getTestAccountName('gmail'))('should search emails with date range (previous day)', async () => {
    const { dateAfter } = getTestDateRange();
    
    console.log(`Testing date range search for: ${dateAfter}`);

    const command = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'search_emails',
        arguments: {
          account_name: 'MAIN',
          query: '*',  // Search all emails
          limit: 50,
          date_after: dateAfter  // 前日以降のメールを検索（beforeは指定しない）
        }
      }
    };

    const result = await runMCPCommand(command, 8000);

    // デバッグ用ログ
    if (!result.success) {
      console.log('Test failed with error:', result.error);
      console.log('TimedOut:', result.timedOut);
    }

    expect(result.timedOut).toBe(false);
    expect(result.success).toBe(true);
    expect(result.response).toBeDefined();
    if (result.response.error) {
      expect(result.response.error.message).toContain('Account not found');
    } else {
      const searchResult = JSON.parse(result.response.result.content[0].text);
      expect(searchResult.emails).toBeDefined();
      expect(Array.isArray(searchResult.emails)).toBe(true);
      
      // 前日以降のメールが存在することを確認（現実的な期待値）
      expect(searchResult.emails.length).toBeGreaterThan(0);
      
      console.log(`前日（${dateAfter}）以降受信メール件数: ${searchResult.emails.length}件`);
      
      // Log first few email subjects for verification
      if (searchResult.emails.length > 0) {
        console.log('前日以降受信メールの例:');
        searchResult.emails.slice(0, 3).forEach((email: any, index: number) => {
          console.log(`  ${index + 1}. ${email.subject} (${email.date})`);
        });
      }
      
      // 期間指定が正しく動作していることを確認（前日以降のメールのみ）
      const emailDates = searchResult.emails.map((email: any) => new Date(email.date));
      const yesterdayDate = new Date(dateAfter.split(' ')[0]);
      yesterdayDate.setHours(0, 0, 0, 0);
      
      const validEmails = emailDates.filter(date => date >= yesterdayDate);
      expect(validEmails.length).toBe(emailDates.length); // 全てのメールが前日以降であることを確認
    }
  }, 15000);
});

describe.skip('Timezone Handling', () => {
    let gmailHandlerForTz: GmailHandler;

    beforeAll(() => {
      gmailHandlerForTz = new GmailHandler([]);
    });

    it('should handle Unix timestamp correctly', () => {
      // Access private method for testing
      const parseDateTime = (gmailHandlerForTz as any).parseDateTime.bind(gmailHandlerForTz);
      
      const unixTimestamp = '1640995200'; // 2022-01-01 00:00:00 UTC
      const result = parseDateTime(unixTimestamp);
      expect(result).toBe('1640995200');
    });

    it('should handle ISO 8601 with timezone correctly', () => {
      const parseDateTime = (gmailHandlerForTz as any).parseDateTime.bind(gmailHandlerForTz);
      
      // ISO 8601 with timezone offset
      const isoWithTz = '2024-01-01T10:00:00+09:00';
      const result = parseDateTime(isoWithTz);
      
      // Should convert to Unix timestamp
      const expectedDate = new Date(isoWithTz);
      const expectedTimestamp = Math.floor(expectedDate.getTime() / 1000).toString();
      expect(result).toBe(expectedTimestamp);
    });

    it('should handle ISO 8601 with Z timezone correctly', () => {
      const parseDateTime = (gmailHandlerForTz as any).parseDateTime.bind(gmailHandlerForTz);
      
      // ISO 8601 with Z (UTC)
      const isoWithZ = '2024-01-01T01:00:00Z';
      const result = parseDateTime(isoWithZ);
      
      const expectedDate = new Date(isoWithZ);
      const expectedTimestamp = Math.floor(expectedDate.getTime() / 1000).toString();
      expect(result).toBe(expectedTimestamp);
    });

    it('should handle date format correctly', () => {
      const parseDateTime = (gmailHandlerForTz as any).parseDateTime.bind(gmailHandlerForTz);
      
      // Date format (Gmail API format)
      const dateFormat = '2024/01/01';
      const result = parseDateTime(dateFormat);
      expect(result).toBe('2024/01/01');
    });

    it('should handle datetime format with default timezone', () => {
      const parseDateTime = (gmailHandlerForTz as any).parseDateTime.bind(gmailHandlerForTz);
      
      // Datetime format without timezone
      const datetimeFormat = '2024/01/01 10:00:00';
      const result = parseDateTime(datetimeFormat);
      
      // Should be a Unix timestamp
      expect(result).toMatch(/^\d+$/);
      expect(parseInt(result)).toBeGreaterThan(0);
    });

    it('should detect system timezone correctly', () => {
      const detectTimezone = (gmailHandlerForTz as any).detectTimezone.bind(gmailHandlerForTz);
      
      // Test without environment variables
      const originalTZ = process.env.TZ;
      const originalEmailTZ = process.env.EMAIL_DEFAULT_TIMEZONE;
      
      delete process.env.TZ;
      delete process.env.EMAIL_DEFAULT_TIMEZONE;
      
      const detectedTz = detectTimezone();
      
      // Should detect system timezone or use default
      expect(detectedTz).toBeTruthy();
      expect(typeof detectedTz).toBe('string');
      
      // Restore environment variables
      if (originalTZ) process.env.TZ = originalTZ;
      if (originalEmailTZ) process.env.EMAIL_DEFAULT_TIMEZONE = originalEmailTZ;
    });

    it('should prioritize TZ environment variable', () => {
      const detectTimezone = (gmailHandlerForTz as any).detectTimezone.bind(gmailHandlerForTz);
      
      // Set test environment variables
      const originalTZ = process.env.TZ;
      const originalEmailTZ = process.env.EMAIL_DEFAULT_TIMEZONE;
      
      process.env.TZ = 'America/New_York';
      process.env.EMAIL_DEFAULT_TIMEZONE = 'Europe/London';
      
      const detectedTz = detectTimezone();
      
      // Should prioritize TZ over EMAIL_DEFAULT_TIMEZONE
      expect(detectedTz).toBe('America/New_York');
      
      // Restore environment variables
      if (originalTZ) process.env.TZ = originalTZ;
      else delete process.env.TZ;
      if (originalEmailTZ) process.env.EMAIL_DEFAULT_TIMEZONE = originalEmailTZ;
      else delete process.env.EMAIL_DEFAULT_TIMEZONE;
    });

    it('should use EMAIL_DEFAULT_TIMEZONE when TZ is not set', () => {
      const detectTimezone = (gmailHandlerForTz as any).detectTimezone.bind(gmailHandlerForTz);
      
      // Set test environment variables
      const originalTZ = process.env.TZ;
      const originalEmailTZ = process.env.EMAIL_DEFAULT_TIMEZONE;
      
      delete process.env.TZ;
      process.env.EMAIL_DEFAULT_TIMEZONE = 'Europe/London';
      
      const detectedTz = detectTimezone();
      
      // Should use EMAIL_DEFAULT_TIMEZONE
      expect(detectedTz).toBe('Europe/London');
      
      // Restore environment variables
      if (originalTZ) process.env.TZ = originalTZ;
      if (originalEmailTZ) process.env.EMAIL_DEFAULT_TIMEZONE = originalEmailTZ;
      else delete process.env.EMAIL_DEFAULT_TIMEZONE;
    });
  });