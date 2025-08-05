import { GmailAccount, ImapAccount, Account } from '../types';

function loadGmailAccounts(): GmailAccount[] {
  const gmailAccounts: GmailAccount[] = [];
  
  for (const key in process.env) {
    if (key.startsWith('GMAIL_REFRESH_TOKEN_')) {
      const accountName = key.replace('GMAIL_REFRESH_TOKEN_', '');
      
      gmailAccounts.push({
        name: accountName,
        type: 'gmail',
        clientId: process.env.GMAIL_CLIENT_ID || '',
        clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
        refreshToken: process.env[key] || '',
      });
    }
  }
  
  return gmailAccounts;
}

function loadImapAccounts(): ImapAccount[] {
  const imapAccounts: ImapAccount[] = [];
  const imapAccountNames = new Set<string>();
  
  // IMAPアカウント名を収集
  for (const key in process.env) {
    if (key.startsWith('IMAP_HOST_')) {
      const accountName = key.replace('IMAP_HOST_', '');
      imapAccountNames.add(accountName);
    }
  }
  
  // IMAPアカウントを構築
  for (const accountName of imapAccountNames) {
    const imapAccount: ImapAccount = {
      name: accountName,
      type: 'imap',
      host: process.env[`IMAP_HOST_${accountName}`] || '',
      user: process.env[`IMAP_USER_${accountName}`] || '',
      password: process.env[`IMAP_PASSWORD_${accountName}`] || '',
      port: parseInt(process.env[`IMAP_PORT_${accountName}`] || '993', 10),
      tls: process.env[`IMAP_TLS_${accountName}`] !== 'false',
    };
    
    imapAccounts.push(imapAccount);
  }
  
  return imapAccounts;
}

export function loadAccounts(): Account[] {
  
  const gmailAccounts = loadGmailAccounts();
  const imapAccounts = loadImapAccounts();
  const allAccounts = [...gmailAccounts, ...imapAccounts];
  
  return allAccounts;
}