# トラブルシューティング記録

## 2025-07-22: Gmail APIハング問題

### 問題
MCPサーバー経由でGmail APIを呼び出すと、認証は成功するがAPI呼び出し（`gmail.users.getProfile`、`gmail.users.messages.list`）でハングアップする現象が発生。

### 症状
- 直接スクリプト実行: Gmail API正常動作 ✅
- MCPサーバー内直接実行: Gmail API正常動作 ✅  
- MCPサーバー + 本体GmailHandler: ハング ❌
- MCPサーバー + シンプルGmailHandler: 正常動作 ✅

### 根本原因
**同期ファイル書き込み（`fs.appendFileSync`）とGmail APIの非同期処理のデッドロック**

```typescript
// 問題のあるコード（src/gmail.ts の logToFileDetailed メソッド）
private logToFileDetailed(level: string, message: string, data?: any) {
  const logLine = `[${timestamp}] [${level}] ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}\n`;
  
  // ❌ 同期ファイル書き込みがイベントループをブロック
  fs.appendFileSync(logPath, logLine);
  
  console.error(`[GMAIL-${level}] ${message}`, data || '');
}
```

### 解決方法
同期ファイル書き込みを非同期に変更：

```typescript
// 修正後のコード
private logToFileDetailed(level: string, message: string, data?: any) {
  const logLine = `[${timestamp}] [${level}] ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}\n`;
  
  // ✅ 非同期ファイル書き込みに変更
  fs.appendFile(logPath, logLine, (err) => {
    if (err) {
      console.error('Log write error:', err);
    }
  });
  
  console.error(`[GMAIL-${level}] ${message}`, data || '');
}
```

### 教訓

#### 1. 同期I/Oの危険性
- **同期ファイル操作（`fs.appendFileSync`）は絶対に避ける**
- 特に非同期API呼び出しと組み合わせる場合は危険
- Node.jsのイベントループをブロックしてデッドロックを引き起こす

#### 2. 段階的デバッグの重要性
- 複雑なシステムの問題は一気に解決しようとせず、段階的に要素を追加
- 最小動作モデルから少しずつ複雑さを追加して問題箇所を特定
- 今回の成功例：
  1. Step1: 直接Gmail API ✅
  2. Step2: GmailHandlerクラス ❌
  3. Step3: ログ無しGmailHandler ✅
  4. Step4: ログ付きGmailHandler ✅
  5. ...

#### 3. ログ出力の設計原則
- ログ出力自体がシステムを壊してはいけない
- 高頻度ログは非同期処理必須
- ログエラーでメイン処理を止めない

#### 4. 推論の落とし穴
- 「ハング」と決めつけず、出力がないだけの可能性も考慮
- 環境問題、ネットワーク問題と決めつけず、コード内の問題を疑う
- 成功例と失敗例の差分を正確に特定する

#### 5. MCPサーバー特有の注意点
- 標準入出力を使った通信とファイルI/Oの競合に注意
- プロセス終了タイミングの制御が重要
- 非同期処理の完了を確実に待つ

### 対策
1. **同期I/O禁止**: プロジェクト全体で`fs.*Sync`系メソッドの使用を禁止
2. **ログライブラリ使用**: 適切な非同期ログライブラリの導入検討
3. **コードレビュー**: 同期I/Oのチェックを必須項目に追加
4. **テスト戦略**: 段階的テストケースの作成

### 修正ファイル
- `src/gmail.ts`: `fs.appendFileSync` → `fs.appendFile`
- その他の複雑な処理（Promise.race、タイムアウト）もシンプル化

この問題により、約2時間のデバッグ時間を要したが、段階的アプローチにより根本原因を特定し解決できた。 