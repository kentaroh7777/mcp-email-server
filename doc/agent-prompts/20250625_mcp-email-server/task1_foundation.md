# Task 1: 基盤実装

## 目的
MCPサーバーの基本構造と暗号化機能を実装する

## 実装ファイル
1. `package.json` - 依存関係設定
2. `tsconfig.json` - TypeScript設定
3. `src/index.ts` - メインサーバー
4. `src/types.ts` - 型定義
5. `src/crypto.ts` - 暗号化機能
6. `.env.example` - 設定例

## 成功基準
- MCP基本機能（initialize, tools/list, tools/call）動作
- 暗号化・復号化機能動作
- TypeScriptコンパイル成功

## 依存関係
- 本実装の元となる設計書: `doc/design/mcp-email-server.mdc`
- 前提条件: なし（最初のタスク）

### 前提条件
なし

### 成果物
- `package.json` - プロジェクト設定と依存関係
- `tsconfig.json` - TypeScript設定
- `src/index.ts` - メインサーバーファイル
- `src/types.ts` - 型定義
- `src/crypto.ts` - 暗号化・復号化機能
- `.env.example` - 環境変数設定例

### 影響範囲
- プロジェクト全体の基盤となる
- 後続のTask 2, Task 3で利用される

## 実装要件

### 【必須制約】MCPプロトコル標準準拠
- **MCP標準準拠**: Model Context Protocol v2024-11-05に完全準拠
- **JSONRPC通信**: stdin/stdoutでのJSONRPC通信
- **標準メソッド**: initialize, tools/list, tools/call, resources/listを実装

### 技術仕様
```typescript
// 基本型定義（必須）
interface MCPRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: any
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: MCPError
}

interface MCPError {
  code: number
  message: string
  data?: any
}

// メインサーバークラス（必須）
export class MCPEmailServer {
  private gmailAccounts: Map<string, GmailConfig>
  private imapAccounts: Map<string, IMAPConfig>
  private encryptionKey: string
  
  constructor()
  async handleRequest(request: MCPRequest): Promise<MCPResponse>
  private encrypt(text: string): string
  private decrypt(encryptedText: string): string
}
```

### 設計パターン
**参考**: `/Users/taroken/src/git/mcp-todoist/packages/mcp-server/server/mcp-handler.ts`のMCPプロトコル実装パターンを踏襲
**理由**: 既存の動作実績があり、標準的なMCP実装パターンが確立されている

## 実装ガイド

### ステップ1: プロジェクト初期化
```bash
npm init -y
npm install @modelcontextprotocol/sdk googleapis node-imap dotenv
npm install -D typescript @types/node @types/node-imap ts-node
```

### ステップ2: TypeScript設定
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### ステップ3: 暗号化機能実装
```typescript
// src/crypto.ts
import * as crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const SALT = 'mcp-email-salt'

export function encrypt(text: string, key: string): string {
  const derivedKey = crypto.scryptSync(key, SALT, 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipher(ALGORITHM, derivedKey)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(encryptedText: string, key: string): string {
  const derivedKey = crypto.scryptSync(key, SALT, 32)
  const [ivHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipher(ALGORITHM, derivedKey)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
```

### ステップ4: MCPサーバー基本構造
```typescript
// src/index.ts
import { MCPEmailServer } from './server'
import * as readline from 'readline'
import * as dotenv from 'dotenv'

dotenv.config()

const server = new MCPEmailServer()

// stdin/stdoutでのJSONRPC通信
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
})

rl.on('line', async (line: string) => {
  try {
    const request = JSON.parse(line.trim())
    const response = await server.handleRequest(request)
    console.log(JSON.stringify(response))
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0' as const,
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    }
    console.log(JSON.stringify(errorResponse))
  }
})

// グレースフルシャットダウン
process.on('SIGINT', () => {
  rl.close()
  process.exit(0)
})
```

## 検証基準【ユーザー承認済み】

### 機能検証
- [ ] MCPプロトコルのinitializeメソッドが正常に応答する
- [ ] tools/listメソッドで空のツール一覧を返す
- [ ] 暗号化・復号化が正常に動作する
- [ ] 環境変数が正しく読み込まれる

### 技術検証
- [ ] TypeScript strict modeでコンパイル成功
- [ ] ESLintエラー0件
- [ ] npm run buildで正常にビルドできる
- [ ] node dist/index.jsで起動できる

### 統合検証
- [ ] stdin/stdoutでのJSONRPC通信が動作する
- [ ] エラーハンドリングが適切に機能する
- [ ] プロセス終了が正常に処理される

## 実装例
```typescript
// 完全に動作する基本実装例
export class MCPEmailServer {
  private encryptionKey: string

  constructor() {
    this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key'
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: true },
                resources: { subscribe: true, listChanged: true }
              },
              serverInfo: {
                name: 'mcp-email-server',
                version: '1.0.0'
              }
            }
          }

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: { tools: [] } // 基盤実装では空
          }

        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          }
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  private encrypt(text: string): string {
    return encrypt(text, this.encryptionKey)
  }

  private decrypt(encryptedText: string): string {
    return decrypt(encryptedText, this.encryptionKey)
  }
}
```

## 注意事項

### 【厳守事項】
- MCPプロトコル v2024-11-05に完全準拠すること
- stdin/stdoutでのJSONRPC通信を必ず実装すること
- 暗号化キーは環境変数から取得すること
- エラーハンドリングを適切に実装すること

### 【推奨事項】
- 型安全性を重視したTypeScript実装
- 明確なエラーメッセージの提供
- ログ出力の適切な実装

### 【禁止事項】
- HTTP通信の実装（MCPはstdin/stdout通信）
- 平文でのパスワード保存
- 例外の握りつぶし

## 参考情報
- [MCP仕様](https://spec.modelcontextprotocol.io/): プロトコル詳細
- [既存実装](../../../src/git/mcp-todoist/): 参考となるMCP実装例
- [設計書](../../design/mcp-email-server.mdc): 詳細設計仕様 