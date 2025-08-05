# MCP Email Server

Gmail と IMAP アカウントの両方をサポートする、統合メール管理用の包括的な Model Context Protocol (MCP) サーバーです。

## 🚀 機能

- **MCP プロトコル対応**: 標準入出力MCPサーバー（HTTPエンドポイント不要）
- **Gmail 統合**: OAuth2ベースのGmail API アクセスと自動トークン管理
- **IMAP サポート**: 各種メールプロバイダーへの安全なIMAP接続
- **統一インターフェース**: 自動検出機能付きのすべてのメールアカウント用単一MCPインターフェース
- **アカウント管理**: 一元化された設定と接続テスト
- **堅牢なエラーハンドリング**: 詳細なユーザーガイダンス付きの包括的なタイムアウトとエラー管理
- **セキュリティ**: IMAPアカウント用の暗号化パスワードストレージ
- **クロスアカウント検索**: 設定済みのすべてのアカウントを同時に検索

## 📋 利用可能なMCPツール

### 🔄 統合ツール（アカウント種別自動判定）

| ツール | 説明 | パラメータ |
|--------|------|----------|
| `list_emails` | 任意のアカウントからメール一覧を取得（種別自動判定） | `account_name`, `limit?`, `folder?`, `unread_only?` |
| `search_emails` | 任意のアカウントでメール検索（種別自動判定） | `account_name`, `query`, `limit?` |
| `get_email_detail` | 任意のアカウントから詳細メール情報を取得 | `account_name`, `email_id` |
| `archive_email` | 任意のアカウントでメールをアーカイブ（種別自動判定） | `account_name`, `email_id`, `remove_unread?` |
| `send_email` | 任意のアカウントからメール送信（種別自動判定） | `account_name`, `to`, `subject`, `text/html`, `cc?`, `bcc?`, `attachments?` |

### 🔧 管理ツール

| ツール | 説明 | パラメータ |
|--------|------|----------|
| `list_accounts` | 設定済みメールアカウントをステータス付きで一覧表示 | なし |
| `test_connection` | 特定のアカウントへの接続テスト | `account_name` |
| `get_account_stats` | 全アカウントの包括的統計情報を取得 | なし |
| `search_all_emails` | 全てのGmailとIMAPアカウントを横断検索 | `query`, `accounts?`, `limit?`, `sortBy?` |

## 🛠️ 利用可能なスクリプト

`scripts/` ディレクトリに配置：

### 📧 認証とセットアップ

| スクリプト | 目的 | 使用方法 |
|-----------|------|----------|
| `gmail-desktop-auth.mjs` | Gmail OAuth2認証セットアップ | `node scripts/gmail-desktop-auth.mjs [ACCOUNT_NAME]` |
| `cleanup-env-tokens.mjs` | 環境変数のクリーンアップと標準化 | `node scripts/cleanup-env-tokens.mjs` |
| `setup-xserver.mjs` | XServer用対話式IMAPアカウントセットアップ | `node scripts/setup-xserver.mjs` |
| `encrypt-password.ts` | IMAPアカウント用パスワード暗号化 | `npx tsx scripts/encrypt-password.ts [PASSWORD]` |

### 🖥️ サーバーとテスト

| スクリプト | 目的 | 使用方法 |
|-----------|------|----------|
| `run-email-server.ts` | 本番用MCPサーバー起動 | `npx tsx scripts/run-email-server.ts` |
| `quick-test.ts` | 高速接続・応答テスト | `npx tsx scripts/quick-test.ts` |
| `monitor-health.ts` | 包括的ヘルスモニタリング | `npx tsx scripts/monitor-health.ts` |
| `decrypt-test.ts` | パスワード復号化機能テスト | `npx tsx scripts/decrypt-test.ts` |

## ⚙️ インストールとセットアップ

### 1. インストール

```bash
git clone <repository-url>
cd mcp-email-server
npm install
```

### 2. 環境設定

```bash
# 環境設定ファイルのサンプルをコピー
cp .env.example .env

# 設定を編集
nano .env
```

### 3. 必要な環境変数

```bash
# 必須 - パスワード保存用暗号化キー
EMAIL_ENCRYPTION_KEY=your-unique-32-character-encryption-key

# Gmail OAuth2設定（Gmailを使用する場合）
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret  
GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob

# Gmailアカウントトークン（OAuthスクリプトで取得）
GMAIL_REFRESH_TOKEN_accountname=your-refresh-token

# IMAPアカウント設定（IMAPを使用する場合）
IMAP_HOST_accountname=mail.example.com
IMAP_USER_accountname=user@example.com
IMAP_PASSWORD_accountname=encrypted-password-here
IMAP_PORT_accountname=993
IMAP_TLS_accountname=true
```

### 4. アカウントセットアップ

#### Gmailアカウント
```bash
# 最初に.envファイルにGmail OAuth2認証情報を設定し、その後：
node scripts/gmail-desktop-auth.mjs ACCOUNT_NAME
```

#### IMAPアカウント
```bash
# 対話式IMAPセットアップ（推奨）：
node scripts/setup-xserver.mjs

# または手動でパスワードを暗号化：
npx tsx scripts/encrypt-password.ts "あなたのパスワード"
```

### 5. 確認

```bash
# 高速接続テスト
npx tsx scripts/quick-test.ts

# 包括的ヘルスチェック
npx tsx scripts/monitor-health.ts

# 完全テストスイート
npm test
```

## 🔧 MCP設定

### Cursor MCPセットアップ（推奨）

Cursor MCP設定ファイル (`~/.cursor/mcp.json`) に追加：

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/mcp-email-server",
      "env": {
        "EMAIL_ENCRYPTION_KEY": "your-unique-encryption-key"
      }
    }
  }
}
```

### 環境変数

| 変数 | 説明 | デフォルト |
|-------|------|----------|
| `EMAIL_ENCRYPTION_KEY` | **必須** - IMAPパスワード暗号化用キー | なし |
| `GMAIL_TIMEOUT_MS` | Gmail API操作タイムアウト | 60000 (60秒) |
| `IMAP_CONNECTION_TIMEOUT_MS` | IMAP接続タイムアウト | 30000 (30秒) |
| `IMAP_OPERATION_TIMEOUT_MS` | IMAP操作タイムアウト | 60000 (60秒) |
| `SEARCH_ALL_TIMEOUT_MS` | クロスアカウント検索タイムアウト | 25000 (25秒) |
| `EMAIL_DEFAULT_TIMEZONE` | 日付操作用デフォルトタイムゾーン | Asia/Tokyo |

## 💡 使用例

### アカウント管理

```javascript
// 設定済みアカウントを全て一覧表示
mcp_mcp-email-server_list_accounts()

// 特定アカウントの接続テスト
mcp_mcp-email-server_test_connection("business_gmail")

// 全アカウントの包括的統計情報を取得
mcp_mcp-email-server_get_account_stats()
```

### メール操作

```javascript
// 全アカウントを横断検索
mcp_mcp-email-server_search_all_emails({
  query: "invoice",
  accounts: "ALL",
  limit: 20,
  sortBy: "date"
})

// 特定アカウントからメール一覧を取得
mcp_mcp-email-server_list_emails({
  account_name: "business_gmail",
  limit: 10,
  unread_only: true
})

// メール送信（Gmail/IMAP自動判定）
mcp_mcp-email-server_send_email({
  account_name: "business_gmail",
  to: "recipient@example.com",
  subject: "会議スケジュール",
  text: "来週の会議のスケジュールを組みましょう。",
  cc: "manager@example.com"
})

// メールをアーカイブ
mcp_mcp-email-server_archive_email({
  account_name: "business_gmail", 
  email_id: "email_id_here"
})
```

## 🧪 テスト

このプロジェクトには、任意のアカウント設定で動作するよう設計された包括的なテストが含まれています：

```bash
# 完全テストスイート
npm test

# 特定のテストカテゴリ
npm run test:core          # コア機能テスト
npm run test:integration   # 統合テスト
npm run test:imap-timeout  # IMAPタイムアウト防止テスト

# ヘルスモニタリング
npm run health:check       # 包括的ヘルスチェック
npm run test:quick         # 高速接続テスト
```

### テスト要件

- **最小構成**: 少なくとも1つのGmailアカウントまたは1つのIMAPアカウントが設定済み
- **フルカバレッジ**: 完全なテストにはGmailとIMAPアカウントの両方が必要
- テストはアカウント設定を自動検出し、適応します

## 🔐 セキュリティ機能

### パスワード暗号化
- 全てのIMAPパスワードはAES-256-GCMで暗号化
- インストールごとに固有の暗号化キーが必要
- セキュリティのための初期化ベクターのランダム化

### OAuth2セキュリティ
- Gmailアクセスはリフレッシュトークンローテーション付きOAuth2を使用
- 平文認証情報は保存されない
- 自動トークン更新

### ベストプラクティス
- 環境変数の分離
- バージョン管理に認証情報を含めない
- 定期的なトークンローテーションを推奨
- 最小限の権限スコープリクエスト

## 🛠️ アーキテクチャ

### コアコンポーネント

- **MCPプロトコルハンドラ**: JSON-RPC 2.0準拠のリクエスト処理
- **アカウントマネージャ**: 一元化されたアカウント設定と検出
- **Gmailハンドラ**: OAuth2認証されたGmail API操作
- **IMAPハンドラ**: コネクションプーリング付きの安全なIMAPプロトコル実装
- **統合インターフェース**: 自動アカウントタイプ検出とルーティング

### エラーハンドリング

- MCP準拠の包括的エラーレスポンス
- 一般的な問題に対する詳細なユーザーガイダンス
- 一時的な障害に対する自動リトライ機構
- 部分的サービス利用可能性に対するグレースフルデグラデーション

## 📊 現在の状態

### ✅ 完全稼働（100%成功率）

CLIとMCP環境の両方で全ツールのテストと検証が完了：

- **アカウント管理**: 全アカウントタイプで100%成功率
- **メール操作**: 完全なCRUD操作をサポート
- **クロスアカウント検索**: GmailとIMAPを横断した統合検索
- **接続テスト**: 堅牢な接続性検証
- **エラーハンドリング**: 包括的なエラー復旧とユーザーガイダンス

### 🎯 パフォーマンス指標

- **応答時間**: ほとんどの操作で5秒未満
- **タイムアウト防止**: タイムアウトテストで100%成功率
- **アカウント検出**: 設定済み7/7アカウントの自動検出
- **エラー復旧**: ネットワークと認証問題のグレースフルな処理

## 🔧 トラブルシューティング

### 一般的な問題

#### Gmail認証
```bash
# Gmailアカウントの再認証
node scripts/gmail-desktop-auth.mjs ACCOUNT_NAME

# 古いトークン形式のクリーンアップ
node scripts/cleanup-env-tokens.mjs
```

#### IMAP接続問題
```bash
# パスワード復号化テスト
npx tsx scripts/decrypt-test.ts

# 正しいキーでパスワードを再暗号化
npx tsx scripts/encrypt-password.ts "あなたのパスワード"
```

#### MCP接続問題
- MCP設定の`cwd`パスを確認
- .envとMCP設定で`EMAIL_ENCRYPTION_KEY`が一致していることを確認
- TypeScript実行をチェック: `npx tsx --version`

### デバッグモード

```bash
# デバッグログを有効化
DEBUG=1 npx tsx src/index.ts

# 詳細出力で実行
NODE_ENV=development npx tsx src/index.ts
```

## 📈 将来の機能拡張

- 追加のメールプロバイダーサポート
- 高度なフィルタリングと検索オプション
- メールテンプレート管理
- 一括操作サポート
- 会議メール用カレンダー連携

## 🤝 貢献

1. リポジトリをフォーク
2. 機能ブランチを作成
3. 包括的なテストを追加
4. 全テストが合格することを確認
5. プルリクエストを提出

## 📄 ライセンス

MITライセンス - 詳細はLICENSEファイルを参照。

## 🆘 サポート

問題や質問について：
1. 上記のトラブルシューティングセクションを確認
2. `DEBUG=1`を有効にしてログをレビュー
3. ヘルスチェックスクリプトでテスト
4. 詳細なエラー情報と設定詳細を含めてissueを作成