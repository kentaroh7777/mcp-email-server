# MCP Email Server テスト構成ドキュメント

## 概要
このドキュメントはmcp-email-serverプロジェクトのテストファイル構成と各テストの役割を説明します。

## 📁 整理後のテストディレクトリ構造

```
test/
├── core/                    # コア機能テスト
│   ├── config.test.ts       # 設定・環境テスト
│   ├── simple-imap.test.ts  # IMAP基本機能テスト
│   ├── mcp-protocol.test.ts # MCPプロトコルテスト
│   └── unified-tools.test.ts # 統合ツールテスト
├── integration/             # 統合テスト
│   ├── connection.test.ts   # 接続・統合テスト
│   ├── email-detail.test.ts # メール詳細取得テスト
│   └── imap-timeout.test.ts # タイムアウト防止テスト
├── utils/                   # テストユーティリティ
│   ├── helpers.ts           # 統合テストヘルパー
│   └── setup.ts             # テスト環境設定
├── debug/                   # デバッグ・開発用ツール
│   ├── quick-test.ts        # クイックテスト
│   ├── monitor-imap-health.ts # IMAPヘルスモニター
│   ├── final-success-test.ts # 最終成功テスト
│   ├── final-archive-test.ts # 最終アーカイブテスト
│   ├── direct-gmail-archive.ts # 直接Gmailアーカイブテスト
│   ├── debug-inbox-state.ts # 受信箱状態デバッグ
│   ├── test-mcp-archive-tool.ts # MCPアーカイブツールテスト
│   ├── test-stdin-archive.ts # 標準入力アーカイブテスト
│   ├── test-unread-archive.ts # 未読メールアーカイブテスト
│   ├── test-unread-removal.ts # 未読削除テスト
│   └── mail-archive/        # アーカイブ関連デバッグ
│       ├── debug-kh-archive.ts # KHアーカイブデバッグ
│       ├── check-folders.ts # フォルダ確認
│       ├── debug-account-loading.ts # アカウント読み込みデバッグ
│       ├── debug-move-operation.ts # 移動操作デバッグ
│       └── simple-folder-test.ts # シンプルフォルダテスト
└── test.md                  # このドキュメント
```

## 📋 テストファイル詳細

### 🔧 Core Tests（コア機能テスト）

#### **config.test.ts** - 設定・環境テスト
- **目的**: プロジェクト設定と環境の検証
- **テスト内容**:
  - 暗号化キーの設定確認
  - 必須ファイルの存在確認
  - package.jsonの妥当性
  - 必須依存関係の確認
  - TypeScriptコンパイル確認
  - アカウント設定の確認
  - ログファイルの記録確認

#### **simple-imap.test.ts** - IMAP基本機能テスト
- **目的**: IMAP基本機能の動作確認
- **テスト内容**:
  - IMAPアカウント一覧
  - 未読メール数取得
  - メール一覧取得

#### **mcp-protocol.test.ts** - MCPプロトコルテスト
- **目的**: MCPプロトコルハンドラーの詳細動作検証
- **テスト内容**:
  - 基本MCPプロトコル処理（初期化、ツール一覧、リソース一覧）
  - リクエスト検証（不正なリクエストの処理）
  - ツール呼び出し（統合ツール含む）
  - レスポンス形式の検証
  - 複数メールアーカイブ対応

#### **unified-tools.test.ts** - 統合ツールテスト
- **目的**: Gmail+IMAP統合ツールの動作検証
- **テスト内容**:
  - 統合ツールの定義確認
  - スキーマ検証
  - エラーハンドリング
  - 改良されたget_account_stats
  - 下位互換性
  - 複数メールアーカイブ対応

### 🔗 Integration Tests（統合テスト）

#### **connection.test.ts** - 接続・統合テスト
- **目的**: 各アカウントの接続と統合機能の検証
- **テスト内容**:
  - アカウント一覧の取得
  - Gmail/IMAPアカウントの認識
  - 個別アカウント接続テスト
  - 未読メール数の取得
  - 統合検索機能
  - 統合ツール（list_emails, search_emails, get_email_detail, archive_email）

#### **email-detail.test.ts** - メール詳細取得テスト
- **目的**: メール詳細取得機能の検証
- **テスト内容**:
  - Gmailアカウントからのメール詳細取得
  - IMAPアカウントからのメール詳細取得
  - 複数アカウント横断での統一動作
  - エラーハンドリング（存在しないメールID、アカウント）

#### **imap-timeout.test.ts** - タイムアウト防止テスト
- **目的**: IMAP操作のタイムアウト防止とパフォーマンス検証
- **テスト内容**:
  - list_emailsのタイムアウト防止
  - unread_only検索のタイムアウト防止
  - 無効なアカウントの適切な処理
  - 複数アカウント同時処理
  - 日付範囲検索
  - タイムゾーン処理

### 🛠️ Utils（テストユーティリティ）

#### **helpers.ts** - 統合テストヘルパー
- **目的**: テスト共通機能の統合提供
- **機能**:
  - **MCPプロトコル関連**:
    - MCPリクエスト送信 (`callTool`, `callMCPMethod`)
    - レスポンスデータ抽出 (`extractMCPData`)
  - **アカウント検証**:
    - アカウント存在確認 (`verifyAccountExists`)
    - 接続確認 (`verifyAccountConnection`)
    - 未読数確認 (`verifyUnreadCount`)
    - 検索結果確認 (`verifySearchResults`)
  - **環境設定**:
    - 設定アカウント取得 (`getConfiguredAccounts`)
    - 暗号化キー検証 (`isEncryptionKeyValid`)
    - 必須ファイル確認 (`verifyRequiredFiles`)
  - **テスト環境判定**:
    - テスト環境確認 (`getTestEnvironment`)
    - 前提条件チェック (`checkTestPrerequisites`)
    - アカウント名取得 (`getTestAccountName`)
    - 日付範囲生成 (`getTestDateRange`)
    - テストログ (`testLog`)

#### **setup.ts** - テスト環境設定
- **目的**: テスト実行前の環境設定
- **機能**:
  - 環境変数読み込み
  - テスト用暗号化キー設定

### 🐛 Debug（デバッグ・開発用ツール）

デバッグディレクトリには開発・トラブルシューティング用のツールが含まれています。これらは正式なテストスイートには含まれませんが、開発時の動作確認や問題調査に使用します。

## 🚀 テスト実行方法

### 全テスト実行
```bash
npm test
# または
npx vitest run
```

### カテゴリ別テスト実行
```bash
# コア機能テスト
npx vitest run test/core/

# 統合テスト
npx vitest run test/integration/

# 特定テストファイル
npx vitest run test/core/config.test.ts
```

### 開発用ツール実行
```bash
# クイックテスト
npx tsx test/debug/quick-test.ts

# ヘルスモニター
npx tsx test/debug/monitor-imap-health.ts

# 複数メールアーカイブテスト
npx tsx test/debug/mail-archive/debug-kh-archive.ts
```

## 📊 テスト環境要件

### 必須環境変数
- `EMAIL_ENCRYPTION_KEY`: 暗号化キー
- `GMAIL_REFRESH_TOKEN_*`: Gmailアカウント設定
- `IMAP_HOST_*`, `IMAP_USER_*`, `IMAP_PASSWORD_*`: IMAPアカウント設定

### 推奨テスト環境
- 最低1つのGmailアカウントまたはIMAPアカウント
- 実際のメールデータ（テスト用）
- 安定したネットワーク接続

## ✅ テストカバレッジ

### 機能カバレッジ
- ✅ アカウント管理
- ✅ メール一覧取得
- ✅ メール検索
- ✅ メール詳細取得
- ✅ メールアーカイブ（単一・複数対応）
- ✅ エラーハンドリング
- ✅ タイムアウト防止
- ✅ MCPプロトコル準拠

### アカウントタイプカバレッジ
- ✅ Gmail
- ✅ IMAP
- ✅ XServer（IMAP経由）

## 🔄 整理内容（2025年6月実施）

### 実施した整理
1. **ディレクトリ構造の合理化**:
   - `core/` - コア機能テスト
   - `integration/` - 統合テスト
   - `utils/` - テストユーティリティ
   - `debug/` - デバッグ・開発用ツール

2. **重複ファイルの統合**:
   - `helpers.ts` + `test-helpers.ts` → `utils/helpers.ts`（統合）
   - `mcp-protocol.test.ts` + `mcp-protocol-simple.test.ts` → `core/mcp-protocol.test.ts`（詳細版を採用）

3. **importパスの修正**:
   - 新しいディレクトリ構造に合わせて全ファイルのimportパスを更新
   - vitest設定ファイルのsetupファイルパスを更新

4. **機能の重複削除**:
   - 2つのヘルパーファイルの機能を1つに統合
   - 重複するMCPプロトコルテストを統合

### 削除されたファイル
- `test/mcp-protocol.test.ts`（簡易版、詳細版に統合）
- `test/test-helpers.ts`（helpers.tsに統合）

### 整理の効果
- ✅ テストファイル構造が明確化
- ✅ 重複機能の削除
- ✅ importパスの一貫性確保
- ✅ 機能別のテスト分離
- ✅ デバッグツールの整理

## 🎯 最近の主要変更

### 複数メールアーカイブ対応（2025年6月実装）
- `archive_email`ツールが単一・複数メール両対応
- 詳細なレスポンス形式（成功/失敗の個別報告）
- 関連テストの更新・追加

### 統合ツール実装
- Gmail + IMAP統合ツールの実装
- 従来の個別ツールから統合ツールへの移行
- アカウントタイプ自動判別機能 