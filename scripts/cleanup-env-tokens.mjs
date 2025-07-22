#!/usr/bin/env node

/**
 * Gmail Environment Variables Cleanup Script
 * 
 * 混在している環境変数形式を正しい形式に統一します：
 * - 正しい形式: GMAIL_REFRESH_TOKEN_アカウント名
 * - 削除する形式: GMAIL_ACCESS_TOKEN_*, *_ACCESS_TOKEN, *_REFRESH_TOKEN, *_TOKEN_EXPIRY
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = path.resolve(__dirname, '../.env');

class EnvTokenCleanup {
  constructor() {
    this.envLines = [];
    this.accounts = new Map();
  }

  /**
   * .envファイルを読み込み
   */
  loadEnvFile() {
    try {
      const envContent = fs.readFileSync(ENV_FILE, 'utf8');
      this.envLines = envContent.split('\n');
      console.log(`✅ .envファイルを読み込みました (${this.envLines.length}行)`);
      return true;
    } catch (error) {
      console.error('❌ .envファイル読み込みエラー:', error.message);
      return false;
    }
  }

  /**
   * トークン情報を抽出
   */
  extractTokenInfo() {
    const patterns = {
      // 古い形式
      oldAccessToken: /^GMAIL_ACCESS_TOKEN_(.+)=(.+)$/,
      oldRefreshToken: /^GMAIL_REFRESH_TOKEN_(.+)=(.+)$/,
      oldExpiry: /^GMAIL_TOKEN_EXPIRY_(.+)=(.+)$/,
      
      // 新しい形式（間違った）
      newAccessToken: /^([A-Z]+)_ACCESS_TOKEN=(.+)$/,
      newRefreshToken: /^([A-Z]+)_REFRESH_TOKEN=(.+)$/,
      newExpiry: /^([A-Z]+)_TOKEN_EXPIRY=(.+)$/
    };

    for (const line of this.envLines) {
      // 古い形式の処理
      let match = line.match(patterns.oldRefreshToken);
      if (match) {
        const [, accountName, token] = match;
        this.addAccountToken(accountName, 'refresh', token);
        continue;
      }

      // 新しい形式（間違った）の処理
      match = line.match(patterns.newRefreshToken);
      if (match) {
        const [, accountName, token] = match;
        this.addAccountToken(accountName.toLowerCase(), 'refresh', token);
        continue;
      }
    }

    console.log(`📊 検出されたアカウント: ${this.accounts.size}個`);
    for (const [name, tokens] of this.accounts) {
      console.log(`   - ${name}: ${tokens.refresh ? '✅' : '❌'} refresh_token`);
    }
  }

  /**
   * アカウントトークンを追加
   */
  addAccountToken(accountName, tokenType, value) {
    if (!this.accounts.has(accountName)) {
      this.accounts.set(accountName, {});
    }
    this.accounts.get(accountName)[tokenType] = value;
  }

  /**
   * 古い形式の行を削除
   */
  removeOldFormatLines() {
    const tokensToRemove = [
      // 古い形式
      /^GMAIL_ACCESS_TOKEN_.+=.+$/,
      /^GMAIL_REFRESH_TOKEN_.+=.+$/,
      /^GMAIL_TOKEN_EXPIRY_.+=.+$/,
      
      // 新しい形式（間違った）
      /^[A-Z]+_ACCESS_TOKEN=.+$/,
      /^[A-Z]+_REFRESH_TOKEN=.+$/,
      /^[A-Z]+_TOKEN_EXPIRY=.+$/,
      
      // セクションヘッダー
      /^# =+ [A-Z]+ GMAIL ACCOUNT TOKENS =+$/
    ];

    const originalLength = this.envLines.length;
    
    this.envLines = this.envLines.filter(line => {
      for (const pattern of tokensToRemove) {
        if (pattern.test(line)) {
          console.log(`🗑️  削除: ${line.substring(0, 50)}...`);
          return false;
        }
      }
      return true;
    });

    console.log(`📝 ${originalLength - this.envLines.length}行を削除しました`);
  }

  /**
   * 正しい形式でトークンを追加
   */
  addCorrectFormatTokens() {
    // 空行を整理
    while (this.envLines.length > 0 && this.envLines[this.envLines.length - 1].trim() === '') {
      this.envLines.pop();
    }

    // セクションヘッダーを追加
    this.envLines.push('');
    this.envLines.push('# ==============================================');
    this.envLines.push('# GMAIL ACCOUNT TOKENS (Correct Format)');
    this.envLines.push('# ==============================================');

    // 各アカウントのトークンを追加
    for (const [accountName, tokens] of this.accounts) {
      if (tokens.refresh) {
        this.envLines.push(`GMAIL_REFRESH_TOKEN_${accountName}=${tokens.refresh}`);
        console.log(`✅ 追加: GMAIL_REFRESH_TOKEN_${accountName}`);
      }
    }

    this.envLines.push('');
  }

  /**
   * .envファイルに書き戻し
   */
  writeEnvFile() {
    try {
      const content = this.envLines.join('\n');
      fs.writeFileSync(ENV_FILE, content);
      console.log('✅ .envファイルを更新しました');
      return true;
    } catch (error) {
      console.error('❌ .envファイル書き込みエラー:', error.message);
      return false;
    }
  }

  /**
   * メイン処理
   */
  async run() {
    console.log('🚀 Gmail環境変数の形式統一を開始します\n');

    // Step 1: .envファイルを読み込み
    if (!this.loadEnvFile()) {
      return false;
    }

    // Step 2: トークン情報を抽出
    this.extractTokenInfo();

    if (this.accounts.size === 0) {
      console.log('⚠️  処理対象のアカウントが見つかりませんでした');
      return false;
    }

    // Step 3: 確認
    console.log('\n📋 以下の形式で統一します:');
    for (const [name] of this.accounts) {
      console.log(`   GMAIL_REFRESH_TOKEN_${name}=***`);
    }

    // Step 4: 古い形式を削除
    console.log('\n🧹 古い形式の環境変数を削除中...');
    this.removeOldFormatLines();

    // Step 5: 正しい形式で追加
    console.log('\n📝 正しい形式で環境変数を追加中...');
    this.addCorrectFormatTokens();

    // Step 6: ファイルに書き戻し
    if (!this.writeEnvFile()) {
      return false;
    }

    console.log('\n🎉 環境変数の形式統一が完了しました！');
    console.log('\n🔄 MCP Email Serverを再起動してください');
    
    return true;
  }
}

// メイン実行
async function main() {
  const cleanup = new EnvTokenCleanup();
  const success = await cleanup.run();
  process.exit(success ? 0 : 1);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('❌ 予期しないエラー:', error.message);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 