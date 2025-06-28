/**
 * テストログ解析ユーティリティ
 * テスト実行時のログを体系的に分析し、重要な問題を見逃さないようにする
 */

export interface LogAnalysisResult {
  criticalErrors: string[];
  apiCalls: {
    type: 'gmail' | 'imap' | 'smtp';
    operation: string;
    account: string;
    status: 'success' | 'error';
    message: string;
  }[];
  dataModifications: {
    operation: string;
    account: string;
    impact: 'read-only' | 'modification' | 'deletion';
    details: string;
  }[];
  recommendations: string[];
}

export class TestLogAnalyzer {
  /**
   * テストログを解析し、重要な問題を抽出
   */
  static analyzeTestOutput(testOutput: string): LogAnalysisResult {
    const lines = testOutput.split('\n');
    const result: LogAnalysisResult = {
      criticalErrors: [],
      apiCalls: [],
      dataModifications: [],
      recommendations: []
    };

    for (const line of lines) {
      // 重要なエラーパターンの検出
      this.detectCriticalErrors(line, result);
      
      // API呼び出しの検出
      this.detectApiCalls(line, result);
      
      // データ変更操作の検出
      this.detectDataModifications(line, result);
    }

    // 推奨事項の生成
    this.generateRecommendations(result);

    return result;
  }

  private static detectCriticalErrors(line: string, result: LogAnalysisResult): void {
    // Gmail APIエラーの検出
    if (line.includes('Gmail archive failed') || line.includes('Invalid id value')) {
      result.criticalErrors.push(`CRITICAL: Gmail API called with invalid data - ${line}`);
    }

    // 実際のメール操作の検出
    if (line.includes('Archive error for') && !line.includes('non_existent_account')) {
      result.criticalErrors.push(`CRITICAL: Real email archive attempted - ${line}`);
    }

    // SMTP送信の検出
    if (line.includes('SMTP send') && !line.includes('test') && !line.includes('mock')) {
      result.criticalErrors.push(`CRITICAL: Real SMTP send attempted - ${line}`);
    }
  }

  private static detectApiCalls(line: string, result: LogAnalysisResult): void {
    // Gmail API呼び出し
    if (line.includes('gmail.googleapis.com')) {
      const account = this.extractAccountFromLine(line);
      result.apiCalls.push({
        type: 'gmail',
        operation: this.extractOperationFromLine(line),
        account,
        status: line.includes('error') ? 'error' : 'success',
        message: line
      });
    }

    // IMAP操作
    if (line.includes('IMAP') && (line.includes('connection') || line.includes('fetch'))) {
      const account = this.extractAccountFromLine(line);
      result.apiCalls.push({
        type: 'imap',
        operation: this.extractOperationFromLine(line),
        account,
        status: line.includes('error') || line.includes('failed') ? 'error' : 'success',
        message: line
      });
    }
  }

  private static detectDataModifications(line: string, result: LogAnalysisResult): void {
    // アーカイブ操作（メール移動）
    if (line.includes('archive') && !line.includes('test') && !line.includes('dummy')) {
      result.dataModifications.push({
        operation: 'archive',
        account: this.extractAccountFromLine(line),
        impact: 'modification',
        details: 'Real email archive operation detected'
      });
    }

    // メール送信
    if (line.includes('send') && line.includes('email') && !line.includes('test')) {
      result.dataModifications.push({
        operation: 'send_email',
        account: this.extractAccountFromLine(line),
        impact: 'modification',
        details: 'Real email send operation detected'
      });
    }

    // メール削除
    if (line.includes('delete') && line.includes('email')) {
      result.dataModifications.push({
        operation: 'delete',
        account: this.extractAccountFromLine(line),
        impact: 'deletion',
        details: 'Email deletion detected'
      });
    }
  }

  private static generateRecommendations(result: LogAnalysisResult): void {
    if (result.criticalErrors.length > 0) {
      result.recommendations.push('🚨 Critical errors detected - review test design');
    }

    const realDataModifications = result.dataModifications.filter(
      mod => mod.impact !== 'read-only'
    );
    if (realDataModifications.length > 0) {
      result.recommendations.push('⚠️ Real data modifications detected - consider mocking');
    }

    const gmailApiCalls = result.apiCalls.filter(call => call.type === 'gmail');
    if (gmailApiCalls.length > 10) {
      result.recommendations.push('📊 High Gmail API usage - consider rate limiting');
    }
  }

  private static extractAccountFromLine(line: string): string {
    // アカウント名抽出のロジック
    const accountMatch = line.match(/account[:\s]+([a-zA-Z0-9_]+)/i) ||
                        line.match(/for\s+([a-zA-Z0-9_]+):/);
    return accountMatch ? accountMatch[1] : 'unknown';
  }

  private static extractOperationFromLine(line: string): string {
    if (line.includes('archive')) return 'archive';
    if (line.includes('send')) return 'send';
    if (line.includes('list')) return 'list';
    if (line.includes('search')) return 'search';
    if (line.includes('detail')) return 'detail';
    return 'unknown';
  }

  /**
   * 解析結果をわかりやすい形式で出力
   */
  static formatAnalysisResult(result: LogAnalysisResult): string {
    let output = '\n🔍 TEST LOG ANALYSIS REPORT\n';
    output += '='.repeat(50) + '\n\n';

    if (result.criticalErrors.length > 0) {
      output += '🚨 CRITICAL ERRORS:\n';
      result.criticalErrors.forEach(error => {
        output += `  - ${error}\n`;
      });
      output += '\n';
    }

    if (result.dataModifications.length > 0) {
      output += '📝 DATA MODIFICATIONS:\n';
      result.dataModifications.forEach(mod => {
        output += `  - ${mod.operation} (${mod.account}): ${mod.details}\n`;
      });
      output += '\n';
    }

    output += `📊 API CALLS: ${result.apiCalls.length} total\n`;
    const gmailCalls = result.apiCalls.filter(c => c.type === 'gmail').length;
    const imapCalls = result.apiCalls.filter(c => c.type === 'imap').length;
    output += `  - Gmail: ${gmailCalls}, IMAP: ${imapCalls}\n\n`;

    if (result.recommendations.length > 0) {
      output += '💡 RECOMMENDATIONS:\n';
      result.recommendations.forEach(rec => {
        output += `  ${rec}\n`;
      });
    }

    return output;
  }
} 