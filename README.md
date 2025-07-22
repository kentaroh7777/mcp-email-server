# MCP Email Server

Gmail と IMAP をサポートするメール管理用MCPサーバー

## 🚀 機能

- **Gmail統合**: OAuth2ベースのGmail API アクセス
- **IMAPサポート**: 各種メールプロバイダーへの安全なIMAP接続
- **統一インターフェース**: 全メールアカウント用の単一MCPインターフェース
- **堅牢なエラーハンドリング**: 包括的なタイムアウトとエラー管理
- **接続プール**: 効率的なIMAP接続管理
- **環境変数設定**: タイムアウト値の柔軟な設定

## ⚙️ 環境変数設定

### .envファイル設定

プロジェクトルートに`.env`ファイルを作成して環境変数を設定します：

```bash
# .env.exampleをコピーして設定
cp .env.example .env
```

### タイムアウト設定

```bash
# Gmail APIタイムアウト（デフォルト: 60000ms = 60秒）
GMAIL_TIMEOUT_MS=60000

# IMAP接続タイムアウト（デフォルト: 30000ms = 30秒）
IMAP_CONNECTION_TIMEOUT_MS=30000

# IMAP操作タイムアウト（デフォルト: 60000ms = 60秒）
IMAP_OPERATION_TIMEOUT_MS=60000

# 統合検索タイムアウト（デフォルト: 25000ms = 25秒）
SEARCH_ALL_TIMEOUT_MS=25000
```

### MCP仕様準拠

MCP公式仕様では、具体的なタイムアウト時間は規定されておらず、実装者が適切な値を設定することが期待されています：

- **初期化**: 合理的な時間内（通常数秒から数十秒）
- **ツール実行**: 操作の性質に応じて（軽量な操作は数秒、重い操作は数分）
- **最大タイムアウト**: システムリソースを保護するため、非常に長時間の操作でも上限を設ける

本実装では、MCP仕様に準拠した適切なタイムアウト値を設定し、環境変数による柔軟な調整を可能にしています。

## 🚨 Gmail認証エラーハンドリング

MCPサーバーは詳細なGmail認証エラーメッセージを提供し、問題解決のための具体的な手順を案内します。

### エラーの種類と解決方法

#### 🔑 リフレッシュトークン無効エラー
```
Gmail認証エラー: リフレッシュトークンが無効または期限切れです。

❌ アカウント: kentaroh7
🔧 解決方法: 以下のコマンドでトークンを再生成してください:
   node scripts/gmail-desktop-auth.mjs kentaroh7

📝 詳細: OAuth 2.0 リフレッシュトークンが無効、期限切れ、または取り消されています。
```

#### 🌐 ネットワークエラー
```
Gmail接続エラー: ネットワークタイムアウトが発生しました。

❌ アカウント: kentaroh7
🔧 解決方法:
   1. ネットワーク接続を確認してください
   2. ファイアウォール設定を確認してください
   3. しばらく時間をおいて再試行してください
```

#### 📊 APIクォータ制限
```
Gmail API制限エラー: APIクォータ制限に達しました。

❌ アカウント: kentaroh7
🔧 解決方法:
   1. しばらく時間をおいて再試行してください
   2. 複数のリクエストを短時間で送信しないでください
   3. Google Cloud Consoleでクォータ制限を確認してください
```

#### 🔐 権限不足エラー
```
Gmail権限エラー: APIアクセス権限が不足しています。

❌ アカウント: kentaroh7
🔧 解決方法:
   1. Google Cloud ConsoleでGmail APIが有効化されているか確認
   2. OAuth同意画面でスコープが正しく設定されているか確認
   3. 以下のコマンドで認証をやり直してください:
      node scripts/gmail-desktop-auth.mjs kentaroh7
```

### MCPエラーコード

- **-32001**: Gmail認証関連エラー（詳細なガイダンス付き）
- **-32602**: アカウント設定エラー（設定方法の案内付き）
- **-32603**: 一般的な操作エラー

## 📊 現在のステータス

### ✅ 完全に動作するツール (7/7 - 100%)

CLI環境とMCP環境の両方で完璧に動作するツール:

- `list_accounts` - 設定済みメールアカウントの一覧表示
- `get_account_stats` - 包括的なアカウント統計情報
- `search_all_emails` - GmailとIMAPアカウント横断検索
- `list_imap_emails` - IMAPアカウントからのメール一覧
- `get_imap_unread_count` - IMAPアカウントの未読数取得
- `search_imap_emails` - IMAPアカウント内メール検索
- `get_imap_email_detail` - IMAP詳細メール情報取得

### 🔧 改善されたGmailツール

MCP仕様準拠の適切なタイムアウト設定により、以下のGmailツールも安定動作:

- `list_emails` (Gmail) - Gmail メール一覧取得
- `get_unread_count` (Gmail) - Gmail 未読数取得

**推奨**: 包括的なGmail+IMAP検索機能には `search_all_emails` を使用してください。

## 🔧 技術的改善

### Gmail実装
- **認証最適化**: `getProfile` による即座の接続テスト
- **環境変数タイムアウト**: `GMAIL_TIMEOUT_MS` で設定可能（デフォルト60秒）
- **正確な未読数カウント**: より良い精度のための `resultSizeEstimate` 使用
- **エラー耐性**: 個別メッセージ失敗の適切な処理

### IMAP実装
- **接続プール管理**: 接続リークとハングの防止
- **堅牢なタイムアウト処理**: 環境変数による柔軟な設定
- **Promise解決保護**: 複数の解決/拒否の防止
- **適切なクリーンアップ**: 操作後の確実な接続クローズ

### MCPプロトコル準拠
- **応答フォーマット**: MCP仕様との一貫性
- **エラーハンドリング**: 適切なJSON-RPC 2.0 エラー応答
- **タイムアウト管理**: MCPサーバーのハング防止

## 📈 パフォーマンス指標

- **CLI環境**: 100%成功率、適切な応答時間
- **MCP環境**: 100%応答率、タイムアウトなし
- **アカウント接続**: 7/7アカウント接続（Gmail 4 + IMAP 3）
- **ヘルスチェック**: 7/7ツールが包括的テストに合格

## 🧪 テスト

### 汎用テスト設計

このプロジェクトのテストは、特定の環境やアカウントに依存しない汎用的な設計になっています：

- **動的アカウント検出**: `.env`設定から利用可能なアカウントを自動検出
- **前提条件チェック**: 最低1つのGmailまたはIMAPアカウントが設定されているかを確認
- **条件付きテスト**: アカウントが設定されていない場合は該当テストをスキップ
- **環境依存性の排除**: 固有のアカウント名やデータに依存しない

### テスト実行の前提条件

テスト実行には以下の設定が必要です：

- **最低1つのGmailアカウント** または **最低1つのIMAPアカウント** の設定
- `.env`ファイルでの適切な環境変数設定

設定が不足している場合、テストは以下のメッセージで失敗します：
```
テスト実行には最低1つのGmailアカウントまたは1つのIMAPアカウントの設定が必要です。.envファイルを確認してください。
```

### テストコマンド

```bash
# 全テストスイートの実行
npm test

# タイムアウト防止テストの実行
npm run test:imap-timeout

# シンプルIMAPテストの実行
npm run test:simple-imap

# 包括的ヘルスチェックの実行
npm run health:check
```

### テスト環境例

テスト実行時に以下のような環境チェックメッセージが表示されます：

```
テスト環境チェック: 完全なテスト環境: Gmail 4アカウント, IMAP 3アカウント
テスト環境チェック: Gmailアカウントのみでテスト実行: 2アカウント
テスト環境チェック: IMAPアカウントのみでテスト実行: 1アカウント
```

## 🎯 ベストプラクティス

1. **Gmail用**: 包括的な結果には `search_all_emails` を使用
2. **IMAP用**: 全ての個別ツールが完璧に動作
3. **統計情報用**: 正確な未読数には `get_account_stats` を使用
4. **テスト用**: 全接続確認には `list_accounts` を使用

## 🔍 アーキテクチャ

サーバーは関心の分離を明確にした設計を使用:

- **MCPEmailProtocolHandler**: MCPプロトコル処理
- **GmailHandler**: タイムアウト保護付きGmail API操作
- **IMAPHandler**: 接続プール付きIMAP操作
- **接続管理**: 自動クリーンアップとエラー回復

このアーキテクチャにより、MCP制約内で最高のユーザーエクスペリエンスを提供しながら、信頼性、パフォーマンス、保守性を確保しています。

## 🔧 重要な技術的注意事項

### .env読み込みの問題と解決策

#### 問題
ビルドされたJavaScriptファイル（`dist/index.js`）を使用すると、以下の問題が発生する可能性があります：

- **作業ディレクトリの問題**: CursorのMCPサーバーがルートディレクトリ（`/`）で起動される
- **.env読み込み失敗**: 相対パスでの`.env`ファイル参照が失敗
- **アカウント認識不能**: 環境変数が読み込まれず、全アカウントが「設定されていない」状態になる

#### 解決策
**TypeScript直接実行**を使用することで、これらの問題を完全に解決できます：

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/mcp-email-server",  // 重要: 作業ディレクトリの指定
      "env": {
        "EMAIL_ENCRYPTION_KEY": "your-encryption-key"
      }
    }
  }
}
```

#### 技術的詳細
- **ESモジュールのメタ情報**: `import.meta.url`を使用した確実なファイルパス取得
- **相対パス解決**: 実行ファイルの場所から相対的に`.env`ファイルを読み込み
- **作業ディレクトリ独立**: `cwd`設定により確実なプロジェクトルート参照

### 暗号化キーの一致確保

アカウント認識の問題の多くは、暗号化キーの不一致が原因です：

```bash
# .envファイルの暗号化キー確認
grep EMAIL_ENCRYPTION_KEY .env

# CursorのMCP設定の暗号化キー確認
cat ~/.cursor/mcp.json | grep EMAIL_ENCRYPTION_KEY
```

両方のキーが**完全に一致**している必要があります。

### 依存関係の確認

TypeScript直接実行には以下が必要です：

```bash
# tsx の確認・インストール
npx tsx --version || npm install tsx

# 必要なTypeScript依存関係
npm install @types/node typescript
```

## クイックスタート

### 1. インストール

```bash
git clone <repository-url>
cd mcp-email-server
npm install
```

### 2. 環境設定

環境変数ファイルをコピーして設定します：

```bash
cp .env.example .env
```

`.env`ファイルを編集して、あなたの設定を追加してください。

### 3. テストと動作確認

```bash
# クイックテスト（推奨）
npm run test:quick

# 包括的ヘルスチェック
npm run health:check
```

### 4. 依存関係の確認

TypeScript直接実行に必要なパッケージを確認・インストール：

```bash
# tsx の確認・インストール
npx tsx --version || npm install tsx

# TypeScript関連の依存関係確認
npm install @types/node typescript
```

### 5. MCP設定

CursorのMCP設定ファイル（`~/.cursor/mcp.json`）にサーバーを追加します。

**推奨設定（TypeScript直接実行）**:
```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/your/path/to/mcp-email-server",
      "env": {
        "EMAIL_ENCRYPTION_KEY": "your-unique-encryption-key"
      }
    }
  }
}
```

## 🔧 MCP設定ガイド

### 設定ファイルの場所

- **macOS/Linux**: `~/.cursor/mcp.json`
- **Windows**: `%USERPROFILE%\.cursor\mcp.json`

### 基本設定

CursorのMCP設定ファイルに以下を追加：

#### 推奨設定（TypeScript直接実行）

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/mcp-email-server",
      "env": {
        "EMAIL_ENCRYPTION_KEY": "your-unique-encryption-key-here",
        "NODE_ENV": "development",
        "DEBUG": "false"
      }
    }
  }
}
```

#### レガシー設定（JavaScript実行）

⚠️ **注意**: ビルドされたJavaScriptファイルでは.env読み込みに問題がある場合があります。TypeScript直接実行を推奨。

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/mcp-email-server",
      "env": {
        "EMAIL_ENCRYPTION_KEY": "your-unique-encryption-key-here",
        "NODE_ENV": "development",
        "DEBUG": "false"
      }
    }
  }
}
```

### 環境別設定例

#### 開発環境（最小設定・推奨）

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/Users/your-username/path/to/mcp-email-server",
      "env": {
        "EMAIL_ENCRYPTION_KEY": "mcp-email-server-development-key-2025"
      }
    }
  }
}
```

#### 本格運用設定（推奨）

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/Users/your-username/path/to/mcp-email-server",
      "env": {
        "EMAIL_ENCRYPTION_KEY": "your-strong-encryption-key",
        "NODE_ENV": "production",
        "DEBUG": "false",
        "GMAIL_TIMEOUT_MS": "60000",
        "IMAP_CONNECTION_TIMEOUT_MS": "30000",
        "IMAP_OPERATION_TIMEOUT_MS": "60000",
        "EMAIL_DEFAULT_TIMEZONE": "Asia/Tokyo"
      }
    }
  }
}
```

### 設定手順

1. **パスの確認**:
   ```bash
   pwd
   # /Users/your-username/path/to/mcp-email-server
   ```

2. **ビルド確認**:
   ```bash
   ls -la dist/index.js
   # -rw-r--r--  1 user  staff  3200 Dec 29 10:00 dist/index.js
   ```

3. **MCP設定ファイル編集**:
   ```bash
   # macOS/Linux
   nano ~/.cursor/mcp.json
   
   # Windows
   notepad %USERPROFILE%\.cursor\mcp.json
   ```

4. **Cursor再起動**: 設定反映のためCursorを再起動

5. **動作確認**: MCPツールが利用可能になったことを確認

### 設定のポイント

- **cwd（作業ディレクトリ）**: プロジェクトルートの指定が必要（.env読み込みのため）
- **TypeScript直接実行**: `npx tsx src/index.ts`を推奨（ビルド不要、確実な.env読み込み）
- **暗号化キー**: 他のプロジェクトと重複しない一意のキーを使用
- **環境変数**: 必要最小限は`EMAIL_ENCRYPTION_KEY`のみ
- **tsx依存**: TypeScript実行に必要（`npm install tsx`でインストール）

### トラブルシューティング

#### サーバーが起動しない場合

1. **プロジェクトパスの確認**:
   ```bash
   # プロジェクトディレクトリの確認
   ls -la /path/to/mcp-email-server/src/index.ts
   ```

2. **Node.js/tsx確認**:
   ```bash
   node --version  # v18.0.0以上が必要
   npx tsx --version  # tsxがインストールされているか確認
   ```

3. **手動テスト（推奨）**:
   ```bash
   cd /path/to/mcp-email-server
   npx tsx src/index.ts
   ```

4. **環境変数確認**:
   ```bash
   # .envファイルの存在確認
   ls -la .env
   # 暗号化キーの設定確認
   cat .env | grep EMAIL_ENCRYPTION_KEY
   ```

#### よくあるエラー

- **`.env not found`**: 作業ディレクトリ（cwd）が正しく設定されていない
- **`tsx command not found`**: `npm install tsx`または`npm install -g tsx`でインストール
- **`Cannot find module`**: TypeScript/tsxパッケージの依存関係問題
- **`Encryption key required`**: `EMAIL_ENCRYPTION_KEY`環境変数を設定
- **アカウント認識エラー**: 暗号化キーの不一致、.env読み込み失敗が原因

### 設定検証

#### MCP接続確認

Cursor上でMCPツールが正常に利用できるか確認：

1. **Cursorのコマンドパレット**を開く（Cmd+Shift+P / Ctrl+Shift+P）
2. 「MCP」で検索
3. MCP関連のコマンドが表示されるか確認

#### 基本動作テスト

以下のコマンドでMCPサーバーの基本機能をテスト：

```javascript
// アカウント一覧の確認
mcp_mcp-email-server_list_accounts()

// アカウント統計の確認
mcp_mcp-email-server_get_account_stats()

// 存在しないアカウントでのエラーハンドリング確認
mcp_mcp-email-server_test_connection("nonexistent_account")
```

期待される結果：
- **正常起動**: エラーなしで応答
- **適切なエラー**: 存在しないアカウントで適切なエラーメッセージ
- **空の結果**: アカウント未設定時は空の配列を返却

### 実用的な設定例

#### 個人利用（Gmail のみ・推奨）

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/Users/username/projects/mcp-email-server",
      "env": {
        "EMAIL_ENCRYPTION_KEY": "personal-gmail-mcp-2025"
      }
    }
  }
}
```

#### ビジネス利用（Gmail + IMAP・推奨）

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/Users/username/projects/mcp-email-server",
      "env": {
        "EMAIL_ENCRYPTION_KEY": "business-email-mcp-secure-key-2025",
        "NODE_ENV": "production",
        "GMAIL_TIMEOUT_MS": "45000",
        "IMAP_CONNECTION_TIMEOUT_MS": "20000",
        "EMAIL_DEFAULT_TIMEZONE": "Asia/Tokyo"
      }
    }
  }
}
```

### アカウント設定後の利用例

メールアカウントを設定した後の実用的な使用例：

#### 横断検索

```javascript
// 全アカウントからキーワード検索
mcp_mcp-email-server_search_all_emails({
  query: "請求書",
  limit: 20,
  accounts: "ALL"
})
```

#### アカウント管理

```javascript
// 全アカウントの状態確認
mcp_mcp-email-server_list_accounts()

// 特定アカウントの接続テスト
mcp_mcp-email-server_test_connection("business_gmail")
```

#### 統計情報取得

```javascript
// 全アカウントの統計情報
mcp_mcp-email-server_get_account_stats()
```

### セキュリティ考慮事項

1. **暗号化キー管理**:
   - 他のプロジェクトと異なるキーを使用
   - 定期的な更新を推奨
   - 本番環境では強力なランダムキーを生成

2. **MCP設定ファイル**:
   - `.cursor/mcp.json`は通常バージョン管理対象外
   - パスワードなどの機密情報は環境変数で管理

3. **権限最小化**:
   - 必要最小限の権限でNode.jsプロセスを実行
   - 不要な環境変数は設定しない
```

## Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```bash
# Encryption key for password storage (change this!)
EMAIL_ENCRYPTION_KEY=your-secret-encryption-key-here

# Gmail OAuth2 Configuration
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback

# Gmail Account Tokens (obtain via OAuth2 flow)
GMAIL_ACCESS_TOKEN_account1=your-access-token
GMAIL_REFRESH_TOKEN_account1=your-refresh-token

# Additional Gmail accounts
GMAIL_ACCESS_TOKEN_account2=your-access-token-2
GMAIL_REFRESH_TOKEN_account2=your-refresh-token-2

# IMAP Account Configuration
IMAP_HOST_myimap=imap.example.com
IMAP_PORT_myimap=993
IMAP_SECURE_myimap=true
IMAP_USER_myimap=user@example.com
IMAP_PASSWORD_myimap=encrypted_password_here

# XServer Account Configuration (simplified setup)
XSERVER_DOMAIN_mydomain=mydomain.com
XSERVER_USERNAME_mydomain=username
XSERVER_PASSWORD_mydomain=encrypted_password_here

# Gmail APIタイムアウト（デフォルト: 60000ms = 60秒）
GMAIL_TIMEOUT_MS=60000

# IMAP接続タイムアウト（デフォルト: 30000ms = 30秒）
IMAP_CONNECTION_TIMEOUT_MS=30000

# IMAP操作タイムアウト（デフォルト: 60000ms = 60秒）
IMAP_OPERATION_TIMEOUT_MS=60000

# タイムゾーン設定（優先順位：TZ > EMAIL_DEFAULT_TIMEZONE > システム検出 > Asia/Tokyo）
EMAIL_DEFAULT_TIMEZONE=Asia/Tokyo
```

### Gmail設定

1. **Google Cloud プロジェクトの作成**:
   - [Google Cloud Console](https://console.cloud.google.com/)にアクセス
   - 新しいプロジェクトを作成または既存のプロジェクトを選択
   - Gmail APIを有効化

2. **OAuth2の設定**:
   - 「認証情報」 → 「認証情報を作成」 → 「OAuth 2.0 クライアント ID」
   - アプリケーションの種類: 「デスクトップアプリケーション」
   - クライアントIDとクライアントシークレットをメモ

3. **アクセストークンの取得**:
   - 自動化されたトークン管理ツールを使用（推奨）
   - トークンを環境変数に保存

### Gmailトークン管理

`tools/refresh-gmail-tokens.js`スクリプトで自動化されたトークン管理が可能です：

#### **クイックスタート**
```bash
# 全Gmailアカウントの状態確認
node tools/refresh-gmail-tokens.js --check-all

# 特定アカウントのトークン更新
node tools/refresh-gmail-tokens.js <アカウント名>

# 対話式モード
node tools/refresh-gmail-tokens.js
```

#### **使用例**

1. **トークン状態の確認**:
   ```bash
   node tools/refresh-gmail-tokens.js --check-all
   ```
   出力例:
   ```
   📊 チェック結果:
   ✅ 有効: 4/4
   ❌ 無効: 0/4
   ```

2. **期限切れトークンの更新**:
   ```bash
   node tools/refresh-gmail-tokens.js kentaroh7
   ```
   - OAuth2 URLが表示されます
   - リダイレクト後のURL全体を貼り付け（自動でコード抽出）
   - .envファイルが自動更新されます

3. **新規アカウント追加**:
   ```bash
   node tools/refresh-gmail-tokens.js
   # オプション3を選択: "新規アカウント追加"
   ```

#### **機能**

- **自動コード抽出**: リダイレクトURL全体を貼り付けるだけで認証コードを自動抽出
- **トークン検証**: 更新前に既存トークンの有効性をテスト
- **一括状態確認**: 設定済み全アカウントを一度にチェック
- **自動.env更新**: 環境変数を自動的に更新
- **エラー検出**: `invalid_grant`などのOAuth2エラーを識別

#### **トラブルシューティング**

`invalid_grant`エラーが表示された場合:
```bash
🔄 再認証が必要なアカウント:
  - kentaroh7
  - kabucoh

再認証するには: node tools/refresh-gmail-tokens.js <account_name>
```

提案されたコマンドを実行してトークンを更新してください。

### IMAP Setup

1. **Standard IMAP Server**:
   ```bash
   IMAP_HOST_myaccount=imap.provider.com
   IMAP_PORT_myaccount=993
   IMAP_SECURE_myaccount=true
   IMAP_USER_myaccount=user@provider.com
   IMAP_PASSWORD_myaccount=encrypted_password
   ```

2. **XServer (Japanese hosting)**:
   ```bash
   XSERVER_DOMAIN_mydomain=example.com
   XSERVER_USERNAME_mydomain=username
   XSERVER_PASSWORD_mydomain=encrypted_password
   ```

### Password Encryption

Use the crypto utility to encrypt passwords:

```bash
node -e "
const crypto = require('./dist/crypto');
const encrypted = crypto.encrypt('your-password', process.env.EMAIL_ENCRYPTION_KEY);
console.log('Encrypted password:', encrypted);
"
```

## タイムゾーン設定

### タイムゾーンの優先順位

日時指定時のタイムゾーン解釈は以下の優先順位で決定されます：

1. **TZ環境変数** (最優先)
2. **EMAIL_DEFAULT_TIMEZONE環境変数**
3. **システムのタイムゾーン検出** (Intl.DateTimeFormat)
4. **デフォルト** (Asia/Tokyo)

### 対応する日時形式

- **Unix timestamp**: `1640995200` (秒単位)
- **ISO 8601 (タイムゾーン付き)**: `2024-01-01T10:00:00+09:00`, `2024-01-01T01:00:00Z`
- **ISO 8601 (タイムゾーンなし)**: `2024-01-01T10:00:00` (デフォルトタイムゾーンで解釈)
- **日付形式**: `2024/01/01` (Gmail API形式)
- **日時形式**: `2024/01/01 10:00:00` (デフォルトタイムゾーンで解釈)

### 設定例

```bash
# システム全体のタイムゾーン設定（最優先）
export TZ=America/New_York

# または、メール専用のタイムゾーン設定
EMAIL_DEFAULT_TIMEZONE=Europe/London
```

### 使用例

```javascript
// 異なるタイムゾーンでの検索例
{
  "tool": "search_emails",
  "arguments": {
    "query": "meeting",
    "date_after": "2024-01-01T09:00:00+09:00",  // JST指定
    "date_before": "2024-01-01T18:00:00Z"       // UTC指定
  }
}
```

## Available Tools

### Unified Tools (Cross-Account)

- **`list_accounts`**: List all configured accounts with status
- **`test_connection`**: Test connection to specific account
- **`search_all_emails`**: Search across all Gmail/IMAP accounts
- **`get_account_stats`**: Get statistics for all accounts
- **`send_email`**: Send emails from Gmail or IMAP accounts (auto-detects account type)
- **`archive_email`**: Archive emails (Gmail) or move to archive folder (IMAP)

### Gmail Tools

- **`list_emails`**: List emails from Gmail account
- **`search_emails`**: Search emails in Gmail account
- **`get_email_detail`**: Get detailed email content
- **`get_unread_count`**: Get unread email count

### IMAP Tools

- **`list_imap_emails`**: List emails from IMAP account
- **`search_imap_emails`**: Search emails in IMAP account
- **`get_imap_email_detail`**: Get detailed email content from IMAP
- **`get_imap_unread_count`**: Get unread count from IMAP

## Testing

### Automated Tests

```bash
# Run all tests
npm test

# Run timeout prevention tests
npm run test:imap-timeout

# Run health check
npm run health:check
```

### Test Coverage

- **Timeout Prevention**: Ensures IMAP tools respond within timeout limits
- **Error Handling**: Validates graceful handling of invalid accounts
- **Health Monitoring**: Basic system health validation

### Manual Testing

```bash
# Test specific IMAP account
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_imap_emails","arguments":{"account_name":"your_account","limit":1}}}' | npx tsx run-email-server.ts

# Test with timeout
gtimeout 10s bash -c 'echo "..." | npx tsx run-email-server.ts && echo "COMMAND_COMPLETED"'
```

## Usage Examples

### Basic Email Search

```javascript
// Search across all accounts
{
  "tool": "search_all_emails",
  "arguments": {
    "query": "invoice",
    "accounts": "ALL",
    "limit": 10,
    "sortBy": "date"
  }
}
```

### Account Management

```javascript
// List all accounts and their status
{
  "tool": "list_accounts",
  "arguments": {}
}

// Test specific account connection
{
  "tool": "test_connection",
  "arguments": {
    "account_name": "myaccount"
  }
}
```

### Account Statistics

```javascript
// Get comprehensive account statistics
{
  "tool": "get_account_stats",
  "arguments": {}
}
```

### Email Sending

```javascript
// Send simple email
{
  "tool": "send_email",
  "arguments": {
    "account_name": "business_gmail",
    "to": "recipient@example.com",
    "subject": "Meeting Schedule",
    "text": "Hi, let's schedule our meeting for next week."
  }
}

// Send HTML email with CC/BCC
{
  "tool": "send_email",
  "arguments": {
    "account_name": "business_gmail",
    "to": ["recipient1@example.com", "recipient2@example.com"],
    "cc": "manager@example.com",
    "bcc": "archive@example.com",
    "subject": "Project Update",
    "html": "<h1>Project Status</h1><p>Current progress: <strong>80%</strong></p>",
    "text": "Project Status\nCurrent progress: 80%"
  }
}

// Reply to existing email
{
  "tool": "send_email",
  "arguments": {
    "account_name": "business_gmail",
    "to": "original_sender@example.com",
    "subject": "Re: Original Subject",
    "text": "Thank you for your message. I'll get back to you soon.",
    "in_reply_to": "original-message-id@gmail.com",
    "references": ["thread-ref-1@gmail.com", "thread-ref-2@gmail.com"]
  }
}
```

### Email Archiving

```javascript
// Archive single email
{
  "tool": "archive_email",
  "arguments": {
    "account_name": "business_gmail",
    "email_id": "email_id_here"
  }
}

// Archive multiple emails
{
  "tool": "archive_email",
  "arguments": {
    "account_name": "business_gmail",
    "email_id": ["email_id_1", "email_id_2", "email_id_3"]
  }
}
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Test Gmail connection
node test_gmail.js

# Test IMAP connection
node test_imap.js

# Test complete integration
node test-connection.js
```

### Development Mode

```bash
npm run dev
```

## Troubleshooting

### Common Issues

1. **Gmail Authentication Errors**:
   - Verify OAuth2 credentials
   - Check token expiration
   - Ensure Gmail API is enabled

2. **IMAP Connection Failures**:
   - Verify server settings (host, port, security)
   - Check encrypted password
   - Test with email client first

3. **Password Decryption Errors**:
   - Verify EMAIL_ENCRYPTION_KEY matches encryption key
   - Re-encrypt passwords if key changed

4. **MCP Connection Issues**:
   - Check absolute path in mcp-config.json
   - Verify build completed successfully
   - Check Node.js version (>=18 required)

### Debug Mode

Set debug environment variables:

```bash
DEBUG=1 npm start
```

### Logs

Check application logs for detailed error information:

```bash
tail -f logs/mcp-email-server.log
```

## Security Notes

- **Never commit plaintext passwords** to version control
- **Use strong encryption keys** for password storage
- **Rotate OAuth2 tokens** regularly
- **Use environment variables** for all sensitive data
- **Review access logs** regularly

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review logs for error details
- Create an issue with detailed information