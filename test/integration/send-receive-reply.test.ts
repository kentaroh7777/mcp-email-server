import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { TestHelper } from '../utils/helpers.js';

interface SentEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  accountName: string;
}

interface ReceivedEmail {
  id: string;
  subject: string;
  from: string;
  to: string[];
  messageId?: string;
  accountName: string;
}

describe('Send-Receive-Reply Integration Tests', () => {
  let helper: TestHelper;
  const sentEmails: SentEmail[] = [];
  const receivedEmails: ReceivedEmail[] = [];
  const emailsToArchive: { accountName: string; emailId: string }[] = [];
  
  // テスト用のユニークなキーワード
  const testTimestamp = Date.now();
  const testKeyword = `MCP_TEST_${testTimestamp}`;

  beforeAll(async () => {
    helper = new TestHelper();
    console.log(`[TEST] Starting send-receive-reply tests with keyword: ${testKeyword}`);
  });

  afterAll(async () => {
    console.log(`[CLEANUP] Archiving ${emailsToArchive.length} test emails...`);
    
    // テスト完了後、全ての受信メールをアーカイブ
    for (const { accountName, emailId } of emailsToArchive) {
      try {
        const response = await helper.callTool('archive_email', {
          account_name: accountName,
          email_id: emailId,
          remove_unread: true
        });
        
        if (response.error) {
          console.log(`[CLEANUP WARNING] Failed to archive ${emailId} from ${accountName}: ${response.error.message}`);
        } else {
          console.log(`[CLEANUP] Successfully archived email ${emailId} from ${accountName}`);
        }
      } catch (error) {
        console.log(`[CLEANUP ERROR] Exception while archiving ${emailId}: ${error}`);
      }
      
      // API制限を避けるために少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('[CLEANUP] Cleanup completed');
  });

  test('Gmail → IMAP: kentaroh7 → kh', async () => {
    const subject = `${testKeyword} Gmail to IMAP Test`;
    const messageText = `This is a test email from Gmail (kentaroh7) to IMAP (kh@h-fpo.com).\nTimestamp: ${new Date().toISOString()}`;
    
    console.log('[TEST] Sending email from Gmail (kentaroh7) to IMAP (kh@h-fpo.com)...');
    
    const response = await helper.callTool('send_email', {
      account_name: 'kentaroh7',  // Gmail account
      to: 'kh@h-fpo.com',         // IMAP account
      subject: subject,
      text: messageText,
      html: `<p>${messageText.replace(/\n/g, '<br>')}</p>`
    });

    expect(response.error).toBeUndefined();
    expect(response.result?.content?.[0]?.text).toBeDefined();
    
    const result = JSON.parse(response.result.content[0].text);
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();

    sentEmails.push({
      messageId: result.messageId,
      from: 'kentaroh7',
      to: 'kh@h-fpo.com',
      subject: subject,
      accountName: 'kentaroh7'
    });

    console.log(`[TEST] ✅ Gmail → IMAP email sent. MessageID: ${result.messageId}`);
  }, 30000);

  test('IMAP → Gmail: info → kabucoh', async () => {
    const subject = `${testKeyword} IMAP to Gmail Test`;
    const messageText = `This is a test email from IMAP (info@h-fpo.com) to Gmail (kabucoh).\nTimestamp: ${new Date().toISOString()}`;
    
    console.log('[TEST] Sending email from IMAP (info@h-fpo.com) to Gmail (kabucoh)...');
    
    const response = await helper.callTool('send_email', {
      account_name: 'info_h_fpo_com',  // IMAP account
      to: 'kabuco.h@gmail.com',        // Gmail account
      subject: subject,
      text: messageText,
      html: `<p>${messageText.replace(/\n/g, '<br>')}</p>`
    });

    expect(response.error).toBeUndefined();
    expect(response.result?.content?.[0]?.text).toBeDefined();
    
    const result = JSON.parse(response.result.content[0].text);
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();

    sentEmails.push({
      messageId: result.messageId,
      from: 'info_h_fpo_com',
      to: 'kabuco.h@gmail.com',
      subject: subject,
      accountName: 'info_h_fpo_com'
    });

    console.log(`[TEST] ✅ IMAP → Gmail email sent. MessageID: ${result.messageId}`);
  }, 30000);

  test('メール受信確認と返信テスト', async () => {
    console.log('[TEST] Waiting for emails to be delivered...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機

    // kh@h-fpo.com での受信確認
    console.log('[TEST] Checking received emails in kh_h_fpo_com account...');
    let khReceivedEmails = await searchForTestEmails('kh_h_fpo_com', testKeyword);
    
    // Gmail (kabucoh) での受信確認
    console.log('[TEST] Checking received emails in kabucoh account...');
    let kabucohReceivedEmails = await searchForTestEmails('kabucoh', testKeyword);

    // 最大3回リトライ (メール配信に時間がかかる場合がある)
    for (let retry = 0; retry < 3 && (khReceivedEmails.length === 0 || kabucohReceivedEmails.length === 0); retry++) {
      console.log(`[TEST] Retry ${retry + 1}/3: Waiting additional 10 seconds for email delivery...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      if (khReceivedEmails.length === 0) {
        khReceivedEmails = await searchForTestEmails('kh_h_fpo_com', testKeyword);
      }
      
      if (kabucohReceivedEmails.length === 0) {
        kabucohReceivedEmails = await searchForTestEmails('kabucoh', testKeyword);
      }
    }

    // 受信確認
    expect(khReceivedEmails.length).toBeGreaterThan(0);
    expect(kabucohReceivedEmails.length).toBeGreaterThan(0);
    
    console.log(`[TEST] ✅ Received ${khReceivedEmails.length} emails in kh account`);
    console.log(`[TEST] ✅ Received ${kabucohReceivedEmails.length} emails in kabucoh account`);

    // 受信メールの詳細を取得してアーカイブリストに追加
    for (const email of [...khReceivedEmails, ...kabucohReceivedEmails]) {
      emailsToArchive.push({
        accountName: email.accountName,
        emailId: email.id
      });
      receivedEmails.push(email);
    }

    // 最初の受信メールに返信
    if (khReceivedEmails.length > 0) {
      await testReply(khReceivedEmails[0], 'kh_h_fpo_com', 'kentaroh7@gmail.com');
    }
    
    if (kabucohReceivedEmails.length > 0) {
      await testReply(kabucohReceivedEmails[0], 'kabucoh', 'info@h-fpo.com');
    }
  }, 120000); // 2分のタイムアウト

  test('返信メール受信確認', async () => {
    console.log('[TEST] Waiting for reply emails to be delivered...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10秒待機

    const replyKeyword = `Re: ${testKeyword}`;
    
    // 返信メールの受信確認
    const kentarohReplyEmails = await searchForTestEmails('kentaroh7', replyKeyword);
    const infoReplyEmails = await searchForTestEmails('info_h_fpo_com', replyKeyword);
    
    console.log(`[TEST] Found ${kentarohReplyEmails.length} reply emails in kentaroh7 account`);
    console.log(`[TEST] Found ${infoReplyEmails.length} reply emails in info account`);

    // 返信メールもアーカイブリストに追加
    for (const email of [...kentarohReplyEmails, ...infoReplyEmails]) {
      emailsToArchive.push({
        accountName: email.accountName,
        emailId: email.id
      });
    }

    expect(kentarohReplyEmails.length + infoReplyEmails.length).toBeGreaterThan(0);
    console.log('[TEST] ✅ Reply emails received and confirmed');
  }, 60000);

  // ヘルパー関数: 指定したアカウントでテストメールを検索
  async function searchForTestEmails(accountName: string, keyword: string): Promise<ReceivedEmail[]> {
    try {
      const response = await helper.callTool('search_emails', {
        account_name: accountName,
        query: keyword,
        limit: 10
      });

      if (response.error) {
        console.log(`[WARNING] Search failed for ${accountName}: ${response.error.message}`);
        return [];
      }

      const result = JSON.parse(response.result.content[0].text);
      const emails = result.emails || [];
      
      return emails.map((email: any) => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        to: email.to || [],
        messageId: email.messageId,
        accountName: accountName
      }));
    } catch (error) {
      console.log(`[ERROR] Exception during search for ${accountName}: ${error}`);
      return [];
    }
  }

  // ヘルパー関数: 返信メール送信
  async function testReply(originalEmail: ReceivedEmail, fromAccount: string, replyToEmail: string): Promise<void> {
    console.log(`[TEST] Sending reply from ${fromAccount} to ${replyToEmail}...`);
    
    // 元のメールの詳細を取得してMessage-IDを取得
    const detailResponse = await helper.callTool('get_email_detail', {
      account_name: originalEmail.accountName,
      email_id: originalEmail.id
    });

    let messageId: string | undefined;
    if (!detailResponse.error) {
      const detailResult = JSON.parse(detailResponse.result.content[0].text);
      // Message-IDを抽出 (簡単な実装)
      messageId = detailResult.messageId || `<${originalEmail.id}@test>`;
    }

    const replySubject = originalEmail.subject.startsWith('Re: ') 
      ? originalEmail.subject 
      : `Re: ${originalEmail.subject}`;
    
    const replyText = `This is a reply to your email.\n\nOriginal message:\n> ${originalEmail.subject}\n> From: ${originalEmail.from}`;
    
    const replyParams: any = {
      account_name: fromAccount,
      to: replyToEmail,
      subject: replySubject,
      text: replyText,
      html: `<p>${replyText.replace(/\n/g, '<br>')}</p>`
    };

    // 返信ヘッダーを追加
    if (messageId) {
      replyParams.in_reply_to = messageId;
      replyParams.references = [messageId];
    }

    const response = await helper.callTool('send_email', replyParams);
    
    expect(response.error).toBeUndefined();
    const result = JSON.parse(response.result.content[0].text);
    expect(result.success).toBe(true);
    
    console.log(`[TEST] ✅ Reply sent from ${fromAccount} to ${replyToEmail}`);
  }
}); 