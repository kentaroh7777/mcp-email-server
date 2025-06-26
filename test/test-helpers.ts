import { GmailHandler } from '../src/gmail.js';
import { IMAPHandler } from '../src/imap.js';

export interface TestEnvironment {
  hasGmail: boolean;
  hasImap: boolean;
  firstGmailAccount?: string;
  firstImapAccount?: string;
  allGmailAccounts: string[];
  allImapAccounts: string[];
}

/**
 * テスト環境の設定状況を確認
 */
export function getTestEnvironment(): TestEnvironment {
  const gmailHandler = new GmailHandler();
  const imapHandler = new IMAPHandler();
  
  const allGmailAccounts = gmailHandler.getAvailableAccounts();
  const allImapAccounts = imapHandler.getAvailableAccounts();
  
  return {
    hasGmail: allGmailAccounts.length > 0,
    hasImap: allImapAccounts.length > 0,
    firstGmailAccount: allGmailAccounts[0],
    firstImapAccount: allImapAccounts[0],
    allGmailAccounts,
    allImapAccounts
  };
}

/**
 * テスト実行の前提条件をチェック
 */
export function checkTestPrerequisites(): { canRun: boolean; message: string } {
  const env = getTestEnvironment();
  
  if (!env.hasGmail && !env.hasImap) {
    return {
      canRun: false,
      message: 'テスト実行には最低1つのGmailアカウントまたは1つのIMAPアカウントの設定が必要です。.envファイルを確認してください。'
    };
  }
  
  if (!env.hasGmail) {
    return {
      canRun: true,
      message: `IMAPアカウントのみでテスト実行: ${env.allImapAccounts.length}アカウント`
    };
  }
  
  if (!env.hasImap) {
    return {
      canRun: true,
      message: `Gmailアカウントのみでテスト実行: ${env.allGmailAccounts.length}アカウント`
    };
  }
  
  return {
    canRun: true,
    message: `完全なテスト環境: Gmail ${env.allGmailAccounts.length}アカウント, IMAP ${env.allImapAccounts.length}アカウント`
  };
}

/**
 * テスト環境でのログ出力（本番環境では抑制）
 */
export function testLog(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message);
  }
}

/**
 * テストで使用するサンプルアカウント名を取得
 */
export function getTestAccountName(type: 'gmail' | 'imap'): string | null {
  const env = getTestEnvironment();
  
  if (type === 'gmail') {
    return env.firstGmailAccount || null;
  } else {
    return env.firstImapAccount || null;
  }
}

/**
 * 日付範囲検索用のテスト日付を取得（昨日）
 */
export function getTestDateRange(): { dateAfter: string; dateBefore: string } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  
  return {
    dateAfter: `${year}/${month}/${day} 00:00:00`,
    dateBefore: `${year}/${month}/${day} 23:59:59`
  };
} 