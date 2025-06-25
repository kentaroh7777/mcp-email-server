# Task 4: 統合・テスト

## 概要
Gmail/IMAP統合、全アカウント横断機能、テスト機能、本番運用準備を実装し、完全なMCPメールサーバーを完成させる。

## 依存関係
- 本実装の元となる設計書: `doc/design/mcp-email-server.mdc`
- Task 1: 基盤実装（MCP標準、暗号化） - 完了
- Task 2: Gmail実装（OAuth2、API操作） - 完了  
- Task 3: IMAP実装（認証、メール操作） - 完了

### 前提条件
- Task 1-3: 基盤、Gmail、IMAP実装完了
- TypeScriptビルド成功
- 基本MCPツール動作確認済み

### 成果物
- `src/index.ts` - 統合機能追加（全アカウント横断、テスト機能）
- `README.md` - 完全な使用方法説明
- `.env.example` - 詳細な環境変数設定例
- `mcp-config.json` - Cursor MCP設定ファイル
- `test-connection.js` - 接続テストスクリプト

### 影響範囲
- 全MCPツールの統合と最適化
- 本番運用のための設定とドキュメント整備

## 実装要件

### 【必須制約】完全統合とテスト機能
- **全アカウント横断機能**: Gmail/IMAP混在での統一操作
- **接続テスト機能**: 各アカウントの接続状態確認
- **アカウント管理機能**: 設定済みアカウント一覧と状態表示
- **本番運用対応**: MCP設定、詳細ドキュメント、エラーガイド

### 技術仕様
```typescript
// 統合機能の型定義（必須）
interface UnifiedEmailSearch {
  query: string;
  accounts: 'ALL' | 'GMAIL_ONLY' | 'IMAP_ONLY' | string[];
  limit?: number;
  sortBy?: 'date' | 'relevance';
}

interface AccountStatus {
  name: string;
  type: 'gmail' | 'imap';
  status: 'connected' | 'error' | 'not_configured';
  lastChecked: string;
  errorMessage?: string;
}

// 新しいMCPツール（必須）
const unifiedTools: Tool[] = [
  'list_accounts',      // 全アカウント一覧と状態
  'test_connection',    // 指定アカウント接続テスト
  'search_all_emails',  // Gmail/IMAP横断検索
  'get_account_stats'   // アカウント別統計情報
];
```

### 設計パターン
**参考**: 既存のGmail/IMAPハンドラーパターンを統合し、統一インターフェースを提供
**理由**: 複数プロバイダーの透明な操作と、ユーザビリティの向上

## 実装ガイド

### ステップ1: 統合機能実装
```typescript
// src/index.ts に追加
private async handleSearchAllEmails(args: any, requestId: any): Promise<MCPResponse> {
  try {
    const results: EmailMessage[] = [];
    
    // Gmail検索
    if (args.accounts === 'ALL' || args.accounts === 'GMAIL_ONLY') {
      const gmailAccounts = this.gmailHandler.getAvailableAccounts();
      for (const account of gmailAccounts) {
        try {
          const emails = await this.gmailHandler.searchEmails(account, args.query, args.limit || 10);
          results.push(...emails);
        } catch (error) {
          console.error(`Gmail search failed for ${account}:`, error);
        }
      }
    }
    
    // IMAP検索
    if (args.accounts === 'ALL' || args.accounts === 'IMAP_ONLY') {
      const imapAccounts = this.imapHandler.getAvailableAccounts();
      for (const account of imapAccounts) {
        try {
          const emails = await this.imapHandler.searchEmails(account, args.query, args.limit || 10);
          results.push(...emails);
        } catch (error) {
          console.error(`IMAP search failed for ${account}:`, error);
        }
      }
    }
    
    // 結果をソートして返す
    const sortedResults = results.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ).slice(0, args.limit || 20);
    
    return this.createResponse(requestId, { 
      emails: sortedResults,
      totalFound: results.length,
      searchQuery: args.query
    });
  } catch (error) {
    throw error;
  }
}
```

### ステップ2: アカウント管理機能
```typescript
private async handleListAccounts(args: any, requestId: any): Promise<MCPResponse> {
  try {
    const accounts: AccountStatus[] = [];
    
    // Gmail アカウント
    const gmailAccounts = this.gmailHandler.getAvailableAccounts();
    for (const account of gmailAccounts) {
      try {
        // 簡単な接続テスト（メール数取得）
        await this.gmailHandler.getUnreadCount(account);
        accounts.push({
          name: account,
          type: 'gmail',
          status: 'connected',
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        accounts.push({
          name: account,
          type: 'gmail',
          status: 'error',
          lastChecked: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // IMAP アカウント
    const imapAccounts = this.imapHandler.getAvailableAccounts();
    for (const account of imapAccounts) {
      try {
        await this.imapHandler.getUnreadCount(account);
        accounts.push({
          name: account,
          type: 'imap',
          status: 'connected',
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        accounts.push({
          name: account,
          type: 'imap',
          status: 'error',
          lastChecked: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return this.createResponse(requestId, { accounts });
  } catch (error) {
    throw error;
  }
}
```

### ステップ3: MCP設定ファイル作成
```json
// mcp-config.json
{
  "mcpServers": {
    "email": {
      "command": "node",
      "args": ["/Users/taroken/src/git/mcp-email-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### ステップ4: 詳細ドキュメント作成
```markdown
# MCP Email Server

完全なGmail + IMAP対応メールMCPサーバー

## 機能
- 複数Gmailアカウント対応（OAuth2認証）
- IMAPサーバー対応（xserver等独自ドメイン）
- 全アカウント横断検索
- 暗号化パスワード対応
- 接続テスト・アカウント管理

## セットアップ
1. 環境変数設定（.env.exampleを参考）
2. npm install
3. npm run build
4. MCP設定をCursorに追加

## 環境変数
詳細は.env.exampleを参照
```

## 検証基準【ユーザー承認済み】

### 機能検証
- [ ] 全MCPツール（12個）が正常に動作する
- [ ] Gmail/IMAP横断検索が動作する
- [ ] アカウント一覧・接続テストが動作する
- [ ] 複数アカウント同時操作が可能
- [ ] エラー時に適切なメッセージが表示される

### 技術検証
- [ ] TypeScript strict modeでコンパイル成功
- [ ] ESLintエラー0件
- [ ] 応答時間1分以内（通常操作）
- [ ] メモリ使用量500MB以下

### 統合検証
- [ ] Cursor MCP設定で正常に動作する
- [ ] 環境変数設定が正しく読み込まれる
- [ ] 暗号化・復号化が正常に動作する
- [ ] 接続失敗時に適切なエラーハンドリングが動作する

## 実装例
```typescript
// 完全に動作する統合機能実装例
export class MCPEmailServer {
  // 統合検索機能
  private async handleSearchAllEmails(args: UnifiedEmailSearch, requestId: any): Promise<MCPResponse> {
    const startTime = Date.now();
    const results: EmailMessage[] = [];
    const errors: string[] = [];
    
    try {
      // Gmail + IMAP 並列検索
      const searchPromises: Promise<EmailMessage[]>[] = [];
      
      if (args.accounts === 'ALL' || args.accounts === 'GMAIL_ONLY') {
        const gmailAccounts = this.gmailHandler.getAvailableAccounts();
        searchPromises.push(...gmailAccounts.map(account => 
          this.gmailHandler.searchEmails(account, args.query, Math.floor((args.limit || 20) / 2))
            .catch(error => {
              errors.push(`Gmail ${account}: ${error.message}`);
              return [];
            })
        ));
      }
      
      if (args.accounts === 'ALL' || args.accounts === 'IMAP_ONLY') {
        const imapAccounts = this.imapHandler.getAvailableAccounts();
        searchPromises.push(...imapAccounts.map(account => 
          this.imapHandler.searchEmails(account, args.query, Math.floor((args.limit || 20) / 2))
            .catch(error => {
              errors.push(`IMAP ${account}: ${error.message}`);
              return [];
            })
        ));
      }
      
      const searchResults = await Promise.all(searchPromises);
      results.push(...searchResults.flat());
      
      // ソートと制限
      const sortedResults = results.sort((a, b) => {
        if (args.sortBy === 'relevance') {
          // 簡単な関連度スコア（タイトル一致優先）
          const aScore = a.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
          const bScore = b.subject.toLowerCase().includes(args.query.toLowerCase()) ? 1 : 0;
          return bScore - aScore;
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }).slice(0, args.limit || 20);
      
      return this.createResponse(requestId, {
        emails: sortedResults,
        totalFound: results.length,
        searchQuery: args.query,
        responseTime: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      return this.createErrorResponse(requestId, -32603, 
        `Unified search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
```

## 注意事項

### 【厳守事項】
- 全アカウント横断機能は必須実装すること
- 接続テスト・アカウント管理機能を必須実装すること
- MCP設定ファイルとREADMEを完全作成すること
- エラーハンドリングを強化すること

### 【推奨事項】
- パフォーマンス最適化（並列処理活用）
- ユーザビリティ重視（分かりやすいエラーメッセージ）
- 運用性重視（設定・ドキュメント充実）

### 【禁止事項】
- 部分的な統合（Gmail/IMAPどちらかのみの対応）
- テスト・検証機能の省略
- 不完全なドキュメント

## 参考情報
- [設計書](../../design/mcp-email-server.mdc): 全体設計仕様
- [Task 1-3](./): 既存実装パターン
- [MCP仕様](https://spec.modelcontextprotocol.io/): プロトコル詳細 