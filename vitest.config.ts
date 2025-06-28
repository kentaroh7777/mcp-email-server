import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    setupFiles: ['./test/utils/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.js'],
    exclude: ['node_modules/**', 'dist/**'],
    // ログ監視設定：標準出力のエラーパターンを監視
    onConsoleLog(log, type) {
      // DEBUGエラーや予期しないAPI呼び出しを検出
      const errorPatterns = [
        /\[DEBUG\] Archive error/,
        /Gmail archive failed/,
        /Invalid id value/,
        /Gmail API error/,
        /IMAP error.*dummy/
      ];
      
      for (const pattern of errorPatterns) {
        if (pattern.test(log)) {
          throw new Error(`Test reliability violation: Unexpected error log detected: ${log}`);
        }
      }
      
      // 実際のAPI呼び出しの検出（テスト環境での予期しない呼び出し）
      const apiCallPatterns = [
        /Making Gmail API request/,
        /Gmail API response received/,
        /IMAP connection established.*dummy/
      ];
      
      for (const pattern of apiCallPatterns) {
        if (pattern.test(log) && process.env.TEST_STRICT_MODE !== 'false') {
          throw new Error(`Test reliability violation: Unexpected API call detected: ${log}`);
        }
      }
      
      return false; // ログを通常通り出力
    }
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
}); 