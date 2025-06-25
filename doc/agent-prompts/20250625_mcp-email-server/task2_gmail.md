# Task 2: Gmail実装

## 目的
Gmail OAuth2認証とAPI操作を実装する

## 実装ファイル
1. `src/gmail.ts` - Gmail操作機能
2. Gmail OAuth2認証処理
3. Gmail API操作（一覧、検索、詳細）

## 依存関係
Task 1完了後

## 成功基準
- Gmail OAuth2認証成功
- Gmail APIでメール操作可能
- MCPツールとして統合完了

## 概要
Gmail OAuth2認証とAPI操作を実装し、複数Gmailアカウントからのメール操作を可能にする。

## 依存関係
- 本実装の元となる設計書: `doc/design/mcp-email-server.mdc`
- 本実装が依存するTask 1の基盤実装: 必ずTask 1で実装されたMCPEmailServerクラスを拡張すること

### 前提条件
- Task 1: 基盤実装 - MCPサーバー基本構造と暗号化機能が完了していること

### 成果物
- `src/gmail.ts` - Gmail操作機能
- `src/server.ts` - MCPEmailServerクラスの拡張（Gmail機能追加）
- Gmail MCPツール実装（list_emails, search_emails, get_email_detail, get_unread_count）

### 影響範囲
- MCPEmailServerクラスにGmail操作機能を追加
- tools/listレスポンスにGmailツールを追加
- tools/callでGmail関連ツールの実行を処理

## 実装要件

### 【必須制約】Gmail API v1準拠
- **Gmail API v1**: Google Gmail API v1に完全準拠
- **OAuth2認証**: 複数アカウント対応（最大10個）
- **アカウント識別**: 環境変数でアカウント名を明示（MAIN, WORK等）

### 技術仕様
```typescript
// Gmail設定型定義（必須）
interface GmailConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  displayName: string
}

// Gmail操作クラス（必須）
export class GmailHandler {
  private configs: Map<string, GmailConfig>
  
  constructor()
  async authenticate(accountName: string): Promise<gmail_v1.Gmail>
  async listEmails(accountName: string, params: ListEmailsParams): Promise<EmailMessage[]>
  async searchEmails(accountName: string, query: string, limit: number): Promise<EmailMessage[]>
  async getEmailDetail(accountName: string, emailId: string): Promise<EmailDetail>
  async getUnreadCount(accountName: string, folder: string): Promise<number>
}

// 実装例（必須）
export const gmailTools = [
  {
    name: 'list_emails',
    description: 'Get email list from Gmail account',
    inputSchema: {
      type: 'object',
      properties: {
        account_name: { 
          type: 'string', 
          enum: ['MAIN', 'WORK', 'ALL'],
          default: 'ALL'
        },
        limit: { type: 'number', default: 20, maximum: 100 },
        folder: { type: 'string', default: 'INBOX' },
        unread_only: { type: 'boolean', default: false }
      }
    }
  }
  // 他のツールも同様に定義
]
```

### 設計パターン
**参考**: 既存のGoogle Calendar MCPの認証方式（`~/.config/google-calendar-mcp/gcp-oauth.keys.json`）を参考に、環境変数ベースの認証を実装
**理由**: 既存のGoogle認証インフラとの整合性を保ち、設定の一貫性を確保

## 実装ガイド

### ステップ1: Gmail API設定
```typescript
// src/gmail.ts
import { google, gmail_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export class GmailHandler {
  private configs: Map<string, GmailConfig> = new Map()

  constructor() {
    this.loadGmailConfigs()
  }

  private loadGmailConfigs() {
    // 環境変数からGmailアカウント設定を読み込み
    const accountNames = ['MAIN', 'WORK'] // 実際は動的に検出
    
    for (const accountName of accountNames) {
      const clientId = process.env[`EMAIL_GMAIL_${accountName}_CLIENT_ID`]
      const clientSecret = process.env[`EMAIL_GMAIL_${accountName}_CLIENT_SECRET`]
      const refreshToken = process.env[`EMAIL_GMAIL_${accountName}_REFRESH_TOKEN`]
      const displayName = process.env[`EMAIL_GMAIL_${accountName}_DISPLAY_NAME`]

      if (clientId && clientSecret && refreshToken) {
        this.configs.set(accountName, {
          clientId,
          clientSecret,
          refreshToken,
          displayName: displayName || accountName
        })
      }
    }
  }
}
```

### ステップ2: OAuth2認証実装
```typescript
async authenticate(accountName: string): Promise<gmail_v1.Gmail> {
  const config = this.configs.get(accountName)
  if (!config) {
    throw new Error(`Gmail account ${accountName} not configured`)
  }

  const oauth2Client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: 'http://localhost'
  })

  oauth2Client.setCredentials({
    refresh_token: config.refreshToken
  })

  // アクセストークンの自動更新
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // 必要に応じてリフレッシュトークンを更新
    }
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}
```

### ステップ3: メール操作実装
```typescript
async listEmails(accountName: string, params: ListEmailsParams): Promise<EmailMessage[]> {
  const gmail = await this.authenticate(accountName)
  
  let query = ''
  if (params.unread_only) query += 'is:unread '
  if (params.folder && params.folder !== 'INBOX') query += `label:${params.folder} `

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query.trim() || undefined,
    maxResults: params.limit
  })

  const messages = response.data.messages || []
  const emailPromises = messages.map(async (message) => {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: message.id!,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date']
    })

    return this.formatEmailMessage(detail.data, accountName)
  })

  return Promise.all(emailPromises)
}

private formatEmailMessage(message: any, accountName: string): EmailMessage {
  const headers = message.payload?.headers || []
  const getHeader = (name: string) => 
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  return {
    id: message.id,
    accountName,
    accountType: 'gmail',
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: [getHeader('To')],
    date: getHeader('Date'),
    snippet: message.snippet || '',
    isUnread: message.labelIds?.includes('UNREAD') || false,
    hasAttachments: message.payload?.parts?.some((part: any) => 
      part.filename && part.filename.length > 0) || false
  }
}
```

### ステップ4: MCPサーバー統合
```typescript
// src/server.ts（MCPEmailServerクラスの拡張）
import { GmailHandler } from './gmail'

export class MCPEmailServer {
  private gmailHandler: GmailHandler
  // ... 既存のプロパティ

  constructor() {
    // ... 既存の初期化
    this.gmailHandler = new GmailHandler()
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: [
                ...this.getGmailTools(),
                // 他のツール（IMAP等）も追加予定
              ]
            }
          }

        case 'tools/call':
          const { name, arguments: args } = request.params || {}
          return await this.handleToolCall(name, args, request.id)

        // ... 既存のメソッド
      }
    } catch (error) {
      // ... エラーハンドリング
    }
  }

  private async handleToolCall(toolName: string, args: any, requestId: any): Promise<MCPResponse> {
    try {
      switch (toolName) {
        case 'list_emails':
          if (args.account_name === 'ALL') {
            // 全Gmailアカウントから取得
            const allEmails = await this.getAllGmailEmails(args)
            return this.createResponse(requestId, { emails: allEmails })
          } else {
            // 指定アカウントから取得
            const emails = await this.gmailHandler.listEmails(args.account_name, args)
            return this.createResponse(requestId, { emails })
          }

        case 'search_emails':
          const searchResults = await this.gmailHandler.searchEmails(
            args.account_name, args.query, args.limit
          )
          return this.createResponse(requestId, { emails: searchResults })

        // ... 他のツール実装

        default:
          return this.createErrorResponse(requestId, {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          })
      }
    } catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { toolName, args }
      })
    }
  }
}
```

## 検証基準【ユーザー承認済み】

### 機能検証
- [ ] Gmail OAuth2認証が正常に動作する
- [ ] 複数アカウント（MAIN, WORK）の認証が可能
- [ ] list_emailsツールでメール一覧を取得できる
- [ ] search_emailsツールで検索が動作する
- [ ] get_email_detailツールで詳細取得が可能
- [ ] get_unread_countツールで未読数を取得できる

### 技術検証
- [ ] TypeScript strict modeでコンパイル成功
- [ ] Gmail API v1の全機能が正常に動作
- [ ] エラーハンドリングが適切に機能
- [ ] レスポンス時間が1分以内

### 統合検証
- [ ] Task 1の基盤実装との統合が正常
- [ ] MCPツールとしての応答が正しい
- [ ] 複数アカウント横断機能が動作
- [ ] 認証エラー時の適切なエラー通知

## 実装例
```typescript
// 完全に動作するGmail実装例
export class GmailHandler {
  async listEmails(accountName: string, params: ListEmailsParams): Promise<EmailMessage[]> {
    try {
      const gmail = await this.authenticate(accountName)
      
      // クエリ構築
      let query = ''
      if (params.unread_only) query += 'is:unread '
      if (params.folder && params.folder !== 'INBOX') {
        query += `label:${params.folder} `
      }

      // Gmail API呼び出し
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query.trim() || undefined,
        maxResults: params.limit || 20
      })

      const messages = response.data.messages || []
      
      // 並列でメッセージ詳細を取得
      const emailPromises = messages.map(async (message) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date']
        })
        return this.formatEmailMessage(detail.data, accountName)
      })

      return await Promise.all(emailPromises)
    } catch (error) {
      throw new Error(`Failed to list emails for ${accountName}: ${error.message}`)
    }
  }
}
```

## 注意事項

### 【厳守事項】
- Task 1で実装されたMCPEmailServerクラスを必ず拡張すること
- Gmail API v1の仕様に完全準拠すること
- OAuth2トークンの適切な管理を実装すること
- 複数アカウント対応を必ず実装すること

### 【推奨事項】
- アクセストークンの自動更新機能
- 適切なレート制限の実装
- 詳細なログ出力

### 【禁止事項】
- 平文でのOAuth2トークン保存
- 認証エラーの握りつぶし
- Gmail API制限の無視

## 参考情報
- [Gmail API v1](https://developers.google.com/gmail/api/v1/reference): API詳細仕様
- [Google OAuth2](https://developers.google.com/identity/protocols/oauth2): 認証仕様
- [既存Google Calendar MCP](~/.config/google-calendar-mcp/): 認証方式の参考 