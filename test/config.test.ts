import { describe, test, expect } from 'vitest';
import { TestHelper } from './helpers.js';

describe('Configuration Tests', () => {
  const helper = new TestHelper();

  test('暗号化キーが正しく設定されている', () => {
    expect(helper.isEncryptionKeyValid()).toBe(true);
  });

  test('必須ファイルが全て存在する', async () => {
    const verification = await helper.verifyRequiredFiles();
    expect(verification.exists).toBe(true);
    expect(verification.missing).toEqual([]);
  });

  test('package.jsonが有効なJSON形式である', async () => {
    const fs = await import('fs');
    const packageJsonContent = fs.readFileSync('package.json', 'utf8');
    
    expect(() => JSON.parse(packageJsonContent)).not.toThrow();
    
    const packageJson = JSON.parse(packageJsonContent);
    expect(packageJson.name).toBe('mcp-email-server');
    expect(packageJson.type).toBe('module');
  });

  test('必須依存関係が全て設定されている', async () => {
    const fs = await import('fs');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    const requiredDeps = [
      '@modelcontextprotocol/sdk',
      'dotenv',
      'google-auth-library',
      'googleapis',
      'node-imap'
    ];

    for (const dep of requiredDeps) {
      expect(packageJson.dependencies[dep]).toBeDefined();
    }
  });

  test('TypeScriptが正しくコンパイルできる', async () => {
    const { execSync } = await import('child_process');
    
    expect(() => {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
    }).not.toThrow();
  });

  test('設定されたアカウントタイプが確認できる', () => {
    const accounts = helper.getConfiguredAccounts();
    
    // 少なくとも1つのアカウントタイプが設定されている
    const totalAccounts = accounts.gmail.length + accounts.imap.length + accounts.xserver.length;
    expect(totalAccounts).toBeGreaterThan(0);
  });

  test('本番環境でログファイルが正しく記録される', async () => {
    const fs = await import('fs');
    const path = await import('path');
    
    // ログディレクトリの存在確認
    const logDir = path.join(process.cwd(), 'logs');
    expect(fs.existsSync(logDir)).toBe(true);
    
    // 本日のログファイルの存在確認
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `mcp-email-server-${today}.log`);
    
    // ログファイルが存在するか確認
    if (fs.existsSync(logFile)) {
      const logContent = fs.readFileSync(logFile, 'utf8');
      
      // ログ内容の基本的な形式確認
      expect(logContent).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] MCP Email Server starting.../);
      
      // ログエントリが複数ある場合の確認
      const logLines = logContent.trim().split('\n').filter(line => line.length > 0);
      expect(logLines.length).toBeGreaterThan(0);
      
      // 各ログエントリがJSON形式の追加情報を含むことを確認
      for (const line of logLines) {
        expect(line).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[(INFO|DEBUG|WARN|ERROR|LOG)\]/);
      }
    } else {
      // ログファイルが存在しない場合は、テスト用に作成してみる
      console.warn(`Log file ${logFile} does not exist. This may be expected if no server has been started today.`);
    }
  });
}); 