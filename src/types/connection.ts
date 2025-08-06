// 設計書Line 129-147から転記した具体的な型定義
// ConnectionManager実装用の接続関連型定義

import { GmailHandler } from '../services/gmail.js';
import { ImapFlowHandler } from '../services/imapflow-handler.js';

export interface ConnectionResult {
  success: boolean;
  accountName: string;
  accountType: 'gmail' | 'imap';
  message: string;
}

export interface PoolStatusInfo {
  gmail: {
    active: number;
    accounts: string[];
  };
  imap: {
    active: number;
    accounts: string[];
  };
}

export interface ConnectionManagerInterface {
  getGmailHandler(accountName: string): Promise<GmailHandler>;
  getImapHandler(accountName: string): Promise<ImapFlowHandler>;
  testConnection(accountName: string): Promise<ConnectionResult>;
  cleanup(): Promise<void>;
  getPoolStatus(): PoolStatusInfo;
}