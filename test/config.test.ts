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
}); 