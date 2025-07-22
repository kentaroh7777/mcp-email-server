# MCP Email Server Scripts

このディレクトリには、MCP Email Serverの設定、認証、管理用のスクリプトが含まれています。

## 📁 スクリプト一覧

### 📧 Gmail認証関連

#### `gmail-desktop-auth.mjs` 🆕
Gmail アカウント用のデスクトップアプリケーション認証スクリプト

```bash
# 基本使用方法
node scripts/gmail-desktop-auth.mjs [ACCOUNT_NAME]

# 例
node scripts/gmail-desktop-auth.mjs MAIN      # メインアカウント
node scripts/gmail-desktop-auth.mjs WORK     # 仕事用アカウント
```

**特徴:**
- ✅ 正しい環境変数形式 (`GMAIL_REFRESH_TOKEN_アカウント名`)
- ✅ デスクトップアプリ用OAuth 2.0フロー
- ✅ 自動ブラウザオープン
- ✅ 認証テスト機能

#### `cleanup-env-tokens.mjs` 🧹
混在している環境変数形式を統一するスクリプト

```bash
node scripts/cleanup-env-tokens.mjs
```

**機能:**
- 古い形式の環境変数を削除
- 正しい形式 (`GMAIL_REFRESH_TOKEN_*`) に統一
- 自動バックアップ作成

### 🔐 セキュリティ関連

#### `encrypt-password.mjs`
IMAP パスワードの暗号化スクリプト

```bash
node scripts/encrypt-password.mjs [PASSWORD]
```

**使用例:**
```bash
# 対話式
node scripts/encrypt-password.mjs

# 直接指定
node scripts/encrypt-password.mjs "your-password"
```

#### `setup-xserver.mjs`
Xサーバー IMAP設定スクリプト

```bash
node scripts/setup-xserver.mjs
```

**機能:**
- 対話式IMAP アカウント設定
- パスワード自動暗号化
- .env ファイル自動更新

### 🚀 サーバー関連

#### `run-email-server.ts` 🆕
MCP Email Server起動スクリプト

```bash
npx tsx scripts/run-email-server.ts
```

**機能:**
- MCPサーバーの本番起動
- 標準入出力でのJSON-RPC通信
- ログファイル出力
- 全アカウント（Gmail + IMAP）対応



## 🚀 使用方法

### 1. 新規Gmail アカウント認証

```bash
# 1. 環境変数設定（.envファイル）
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob

# 2. 認証実行
node scripts/gmail-desktop-auth.mjs ACCOUNT_NAME

# 3. ブラウザで認証し、認証コードを入力
```

### 2. 環境変数の統一

```bash
# 混在している形式を統一
node scripts/cleanup-env-tokens.mjs
```

### 3. IMAP アカウント設定

```bash
# Xサーバー設定
node scripts/setup-xserver.mjs

# または手動でパスワード暗号化
node scripts/encrypt-password.mjs
```

## 📋 環境変数形式

### ✅ 正しい形式（推奨）

```bash
# Gmail アカウント
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
GMAIL_REFRESH_TOKEN_accountname=your-refresh-token

# IMAP アカウント
IMAP_HOST_accountname=mail.example.com
IMAP_PORT_accountname=993
IMAP_USER_accountname=user@example.com
IMAP_PASSWORD_accountname=encrypted-password
```

### ❌ 古い形式（非推奨）

```bash
# これらの形式は自動的に削除・変換されます
GMAIL_ACCESS_TOKEN_accountname=***
ACCOUNTNAME_ACCESS_TOKEN=***
ACCOUNTNAME_REFRESH_TOKEN=***
ACCOUNTNAME_TOKEN_EXPIRY=***
```

## 🔧 トラブルシューティング

### Gmail認証エラー

1. **`redirect_uri_mismatch`**
   - Google Cloud Console でデスクトップアプリケーション用クライアントIDを作成
   - `GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob` を設定

2. **`access_blocked`**
   - OAuth同意画面でテストユーザーに自分のアカウントを追加
   - 必要なスコープが設定されているか確認

### 環境変数エラー

1. **混在形式の問題**
   ```bash
   node scripts/cleanup-env-tokens.mjs
   ```

2. **暗号化エラー**
   ```bash
   # 暗号化キーを確認
   echo $EMAIL_ENCRYPTION_KEY
   ```

## 🔄 マイグレーション

### toolsフォルダからの移行

以下のファイルは新しいscriptsフォルダに統合されました：

- `tools/refresh-gmail-tokens.js` → **削除** (古い形式のため)
- `tools/encrypt-password.js` → `scripts/encrypt-password.mjs`
- `tools/setup-xserver.js` → `scripts/setup-xserver.mjs`

## 📚 関連ドキュメント

- [../README.md](../README.md) - メイン README
- [../doc/setup-guide.md](../doc/setup-guide.md) - セットアップガイド
- [../doc/troubleshooting.md](../doc/troubleshooting.md) - トラブルシューティング

## 🔐 セキュリティ注意事項

- `.env` ファイルはGitに含めないでください
- 認証トークンは定期的に更新してください
- 暗号化キーは安全に保管してください 