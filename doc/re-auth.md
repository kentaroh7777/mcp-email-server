# Gmail再認証ワークフロー（AI向けプロンプト）

このドキュメントは、AI（Claude、ChatGPT等）がMCP Email Serverの認証問題を診断・解決する際の標準ワークフローです。

## 🤖 AI向け実行プロンプト

MCP Email Serverで認証エラーが発生した場合、以下の手順を順番に実行してください：

### Phase 1: 問題診断

```bash
# 1. ヘルスチェック実行
npm run health:check
```

**出力の判定基準**:
- ✅ **HEALTHY (17/17)**: 問題なし、終了
- ❌ **UNHEALTHY**: Phase 2へ進む

### Phase 2: エラー分析

ヘルスチェックの出力から以下のパターンを判定：

#### パターンA: 個別アカウント認証エラー
```
❌ test_connection (account1): Authentication failed
❌ list_emails (account1): invalid_grant
```
→ **対処**: Gmail個別認証が必要

#### パターンB: サーバー再起動が必要
```
✅ test_connection (account1): 成功
✅ list_emails (account1): 成功
❌ gmail_token_check: invalid_grant
```
→ **対処**: サーバー再起動のみ必要

#### パターンC: IMAP認証エラー  
```
❌ test_connection (imap_account): AUTHENTICATIONFAILED
```
→ **対処**: IMAP設定確認（このドキュメントの範囲外）

### Phase 3: 解決実行

#### パターンAの場合: Gmail再認証

```bash
# 1. Gmail認証スクリプト実行
npx tsx scripts/gmail-desktop-auth.mjs

# 出力例:
# 📋 アカウント選択:
# 既存のアカウント:
#    1. account1 ✅  
#    2. account2 ⚠️  (トークン期限切れ - 再認証が必要)
#    3. account3 ✅
#    4. account4 ✅
#    5. 新規アカウントを追加

# エラーのあるアカウント番号を選択（例: 2）
```

**重要**: 認証完了後、必ずサーバー再起動が必要です。

#### パターンA・B共通: サーバー再起動

```bash
# 2. サーバー再起動
./scripts/server.sh restart

# 出力例:
# 🔄 MCP Email Server を再起動しています...
# サーバーを停止中...
# ✅ サーバーを停止しました
# サーバーを開始中...
# ✅ サーバーの再起動が完了しました
```

### Phase 4: 動作確認

```bash
# 3. 再度ヘルスチェック
npm run health:check

# 期待結果:
# 📊 Overall Status: ✅ HEALTHY
# Tests Passed: 17/17
```

## 🔍 トラブルシューティング

### よくある問題と解決法

#### 1. 認証スクリプトで全アカウント✅だが、ヘルスチェックで❌
**原因**: サーバープロセスが古い環境変数でキャッシュされている  
**解決**: `./scripts/server.sh restart`

#### 2. `scripts/server.sh`が見つからない  
**原因**: スクリプトが実行権限なし、または存在しない  
**解決**:
```bash
chmod +x scripts/server.sh
# または手動で:
launchctl unload ~/Library/LaunchAgents/com.user.mcp-email-server.plist
launchctl load ~/Library/LaunchAgents/com.user.mcp-email-server.plist
```

#### 3. launchctlが応答しない
**解決**:
```bash
# プロセスを強制終了
pkill -f "mcp-email-server"

# サーバー状態確認
./scripts/server.sh status

# 必要に応じて手動起動
./scripts/server.sh start
```

## 🎯 成功判定基準

最終的に以下の状態になれば成功：

```bash
npm run health:check
```

```
📊 Overall Status: ✅ HEALTHY
Tests Passed: 17/17

🔗 統合ツール:
  ✅ list_accounts
  ✅ get_account_stats

📧 アカウント別テスト結果:
  ✅ test_connection (gmail_account1)
  ✅ list_emails (gmail_account1)
  ✅ test_connection (gmail_account2)
  ✅ list_emails (gmail_account2)
  ✅ test_connection (gmail_account3)
  ✅ list_emails (gmail_account3)
  ✅ test_connection (gmail_account4)
  ✅ list_emails (gmail_account4)
  ✅ test_connection (imap_account1)
  ✅ list_emails (imap_account1)
  ✅ test_connection (imap_account2)
  ✅ list_emails (imap_account2)
  ✅ test_connection (imap_account3)
  ✅ list_emails (imap_account3)
```

## 📋 AI実行チェックリスト

AIが作業完了時に確認すべき項目：

- [ ] `npm run health:check`を実行した
- [ ] エラーパターンを正しく判定した
- [ ] 必要に応じて`npx tsx scripts/gmail-desktop-auth.mjs`を実行した
- [ ] `./scripts/server.sh restart`でサーバーを再起動した
- [ ] 最終確認でHEALTHY（17/17）を確認した
- [ ] ユーザーに結果を報告した

## 🚨 エラー時の追加調査

ワークフロー完了後も問題が解決しない場合：

```bash
# サーバーログ確認
./scripts/server.sh logs

# エラーログ確認  
./scripts/server.sh logs error

# 詳細な検索テスト
./scripts/test-search-all.sh

# 個別アカウントテスト（例: account1）
curl -X POST http://localhost:3456/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"list_emails","arguments":{"account_name":"account1","limit":1}}}'
```

## 💡 予防策

定期的に実行することで問題を事前に防げます：

```bash
# 毎日の健康チェック
./scripts/server.sh health

# 週1回のサーバー再起動（推奨）
./scripts/server.sh restart
```

---

**更新日**: 2025-08-27  
**対象**: MCP Email Server v1.0.0  
**検証済み環境**: macOS (LaunchAgents), Node.js v23.7.0