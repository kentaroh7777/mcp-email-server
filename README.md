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

### 4. Cursor連携

CursorのMCP設定に追加します：

```json
{
  "mcpServers": {
    "mcp-email-server": {
      "command": "/Users/taroken/.nvm/versions/node/v23.7.0/bin/tsx",
      "args": ["/Users/taroken/src/git/mcp-email-server/run-email-server.ts"],
      "cwd": "/Users/taroken/src/git/mcp-email-server",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
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

### Gmail Setup

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Gmail API

2. **Configure OAuth2**:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Desktop application"
   - Note the Client ID and Client Secret

3. **Get Access Tokens**:
   - Run the OAuth2 flow to get access and refresh tokens
   - Store tokens in environment variables

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