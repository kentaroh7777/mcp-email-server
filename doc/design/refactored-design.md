# MCP Email Server 修正設計書

## 1. はじめに

### 1.1 目的
本ドキュメントは、既存の `mcp-email-server` の以下の課題を解決するための修正設計を定義する。
- **保守性の低さ:** アカウント追加・削除のたびにコード修正が必要。
- **セキュリティリスク:** ソースコード内に個人情報（アカウント名）がハードコードされている。
- **拡張性の欠如:** アカウント設定のロジックが固定化されている。
- **不十分なエラー通知:** Gmailトークン期限切れ時の情報がユーザーに分かりにくい。

### 1.2 設計目標
- **動的設定:** 環境変数に基づいてアカウント設定を動的に読み込み、コード修正なしでアカウントの増減を可能にする。
- **汎用化:** コードから個人情報やアカウント固有の情報を完全に排除する。
- **責務の分離:** 設定読み込み、アカウント管理、各プロトコル処理の責務を明確に分離し、モジュール性を高める。
- **明確なエラーハンドリング:** 特にGmailのトークン期限切れエラー発生時に、原因と解決策を明記したMCPエラーレスポンスを返す。

---

## 2. 修正アーキテクチャ

### 2.1 全体構成
環境変数から動的に設定を読み込む `AccountLoader` と、それを管理する `AccountManager` を中心としたアーキテクチャに変更する。

```mermaid
graph TD
    A[環境変数 .env] -->|読み込み| B(AccountLoader)
    B -->|設定オブジェクト生成| C(AccountManager)
    C -->|設定提供| D[MCP Server (index.ts)]

    subgraph "Tool Handlers"
        direction LR
        E[gmail.ts]
        F[imap.ts]
    end

    D --> E
    D --> F

    C -.->|Gmail設定| E
    C -.->|IMAP設定| F
```

### 2.2 ファイル構成の変更
```
src/
├── index.ts                 # (修正) メインエントリーポイント、モジュール連携
├── types.ts                 # (変更なし)
├── config/
│   └── account-loader.ts    # (新規) 環境変数を解析しアカウント設定を動的に生成
├── services/
│   ├── account-manager.ts   # (新規) 全アカウント設定を一元管理
│   ├── gmail.ts             # (修正) ハードコード削除、AccountManager利用
│   └── imap.ts              # (新規) IMAP関連ロジックを分離
└── utils/
    └── crypto.ts            # (新規) 暗号化・復号ロジックを分離
```

---

## 3. 動的アカウント設定

### 3.1 命名規則
環境変数の命名規則に基づき、アカウント情報を自動で構築する。

- **Gmail:**
  - 共通設定: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
  - アカウント別設定: `GMAIL_REFRESH_TOKEN_<ACCOUNT_NAME>`
  - 例: `GMAIL_REFRESH_TOKEN_kabucoh` -> `kabucoh` という名前のGmailアカウントを生成。

- **XSERVER (IMAP):**
  - アカウント別設定: `XSERVER_<PROPERTY>_<ACCOUNT_NAME>`
  - 例: `XSERVER_SERVER_info_h_fpo_com`, `XSERVER_DOMAIN_info_h_fpo_com` 等から `info_h_fpo_com` という名前のIMAPアカウントを生成。

- **汎用IMAP:**
  - アカウント別設定: `IMAP_<PROPERTY>_<ACCOUNT_NAME>`
  - 例: `IMAP_HOST_myimap`, `IMAP_USER_myimap` 等から `myimap` という名前のIMAPアカウントを生成。

### 3.2 実装 (`account-loader.ts`)
`process.env` を走査し、上記の命名規則に一致するキーを正規表現でマッチングさせ、アカウント設定オブジェクトの配列を生成する。

---

## 4. エラーハンドリングの強化

### 4.1 Gmailトークン期限切れの対応
`gmail.ts` 内でGmail API呼び出し時に `invalid_grant` エラーを捕捉した場合、以下の情報を含むMCPエラーレスポンスを生成する。

- **エラーコード:** `-32001` (Auth Error)
- **メッセージ:** どのGmailアカウントで認証エラーが発生したかを明記。
- **データ:**
  - `accountName`: エラーが発生したアカウント名。
  - `errorDetail`: "Refresh token is expired or revoked."
  - `suggestion`: ユーザーが実行すべき具体的な解決策を提示。

### 4.2 エラーレスポンス例
```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "error": {
    "code": -32001,
    "message": "Authentication failed for Gmail account: kabucoh",
    "data": {
      "accountName": "kabucoh",
      "accountType": "gmail",
      "errorDetail": "Refresh token is expired or revoked.",
      "suggestion": "Please re-authenticate this account by running the following command in the mcp-email-server directory: 'node scripts/gmail-desktop-auth.mjs kabucoh'"
    }
  }
}
```
この詳細なエラー情報により、ユーザーは迅速に問題を自己解決できるようになる。

---

## 5. 実装計画
1. 本設計書を `doc/design/refactored-design.md` として保存する。
2. `src/utils/crypto.ts` を作成。
3. `src/config/account-loader.ts` を作成。
4. `src/services/imap.ts` を作成。
5. `src/services/account-manager.ts` を作成。
6. `src/services/gmail.ts` をリファクタリング。
7. `src/index.ts` をリファクタリングし、全体を統合する。
