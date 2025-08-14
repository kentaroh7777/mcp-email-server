import { FastMCP } from "fastmcp";
import { z } from "zod";
import McpEmailServer from '../src/index.js';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

// FastMCPサーバーのインスタンスを作成
const server = new FastMCP({
  name: "Email MCP Server",
  version: "1.0.0"
});

// 既存のMcpEmailServerインスタンスを作成
const emailServer = new McpEmailServer();

// list_emails ツール
server.addTool({
  name: "list_emails",
  description: "List emails from a specified account. Automatically detects account type (Gmail/IMAP).",
  parameters: z.object({
    account_name: z.string().describe("Name of the email account"),
    limit: z.number().optional().default(20).describe("Maximum number of emails to return"),
    folder: z.string().optional().default("INBOX").describe("Folder to list emails from"),
    unread_only: z.boolean().optional().describe("Only return unread emails")
  }),
  execute: async (args) => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'list_emails',
          arguments: args
        }
      };
      const response = await emailServer.handleRequest(request);
        if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// search_emails ツール
server.addTool({
  name: "search_emails",
  description: "Search emails in a specified account. Automatically detects account type (Gmail/IMAP).",
  parameters: z.object({
    account_name: z.string().describe("Name of the email account"),
    // Backward-compatible: if 'query' is provided it will be treated as 'text'
    query: z.string().optional().describe("Deprecated. Use text/since/before. If provided, treated as text."),
    text: z.string().optional().describe("Free text to match (subject/from/body; server + local filter)"),
    since: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    before: z.string().optional().describe("End date (YYYY-MM-DD, exclusive)"),
    folders: z.array(z.string()).optional().describe("Folders to search (IMAP). Defaults include archives."),
    matchFields: z.array(z.enum(["subject","from","body"]))
      .optional()
      .describe("Fields to match text against (default: subject,from)"),
    decodeMime: z.boolean().optional().describe("Decode MIME-encoded headers before matching (default: true)"),
    limit: z.number().optional().default(20).describe("Maximum number of emails to return")
  }),
  execute: async (args) => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'search_emails',
          arguments: args
        }
      };
      const response = await emailServer.handleRequest(request);
      if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// get_email_detail ツール
server.addTool({
  name: "get_email_detail",
  description: "Get detailed information about a specific email from a specified account.",
  parameters: z.object({
    account_name: z.string().describe("Name of the email account"),
    email_id: z.string().describe("ID of the email to get details for")
  }),
  execute: async (args) => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'get_email_detail',
          arguments: args
        }
      };
      const response = await emailServer.handleRequest(request);
      if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// archive_email ツール
server.addTool({
  name: "archive_email",
  description: "Archive an email in a specified account. Automatically detects account type (Gmail/IMAP).",
  parameters: z.object({
    account_name: z.string().describe("Name of the email account"),
    email_id: z.string().describe("ID of the email to archive"),
    remove_unread: z.boolean().optional().default(false).describe("Whether to mark the email as read")
  }),
  execute: async (args) => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'archive_email',
          arguments: args
        }
      };
      const response = await emailServer.handleRequest(request);
      if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// send_email ツール
server.addTool({
  name: "send_email",
  description: "Send an email from a specified account. Automatically detects account type (Gmail/IMAP).",
  parameters: z.object({
    account_name: z.string().describe("Name of the email account"),
    to: z.union([z.string(), z.array(z.string())]).describe("Recipient email address(es)"),
    subject: z.string().describe("Email subject"),
    text: z.string().optional().describe("Plain text content of the email"),
    html: z.string().optional().describe("HTML content of the email"),
    cc: z.union([z.string(), z.array(z.string())]).optional().describe("CC recipient email address(es)"),
    bcc: z.union([z.string(), z.array(z.string())]).optional().describe("BCC recipient email address(es)"),
    replyTo: z.string().optional().describe("Reply-To email address"),
    inReplyTo: z.string().optional().describe("Message-ID of the message this is a reply to"),
    references: z.array(z.string()).optional().describe("Message-IDs of messages this message references"),
    attachments: z.array(z.object({
      filename: z.string(),
      content: z.string(),
      contentType: z.string().optional()
    })).optional().describe("Array of attachment objects")
  }).refine(data => data.text || data.html, {
    message: "Either text or html content must be provided"
  }),
  execute: async (args) => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'send_email',
          arguments: args
        }
      };
      const response = await emailServer.handleRequest(request);
      if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// list_accounts ツール
server.addTool({
  name: "list_accounts",
  description: "List all configured email accounts.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'list_accounts',
          arguments: {}
        }
      };
      const response = await emailServer.handleRequest(request);
      if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// test_connection ツール
server.addTool({
  name: "test_connection",
  description: "Test the connection for a specific email account.",
  parameters: z.object({
    account_name: z.string().describe("Name of the account to test connection for")
  }),
  execute: async (args) => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'test_connection',
          arguments: args
        }
      };
      const response = await emailServer.handleRequest(request);
      if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// get_account_stats ツール
server.addTool({
  name: "get_account_stats",
  description: "Get statistics about configured email accounts.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'get_account_stats',
          arguments: {}
        }
      };
      const response = await emailServer.handleRequest(request);
      if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// search_all_emails ツール
server.addTool({
  name: "search_all_emails",
  description: "Search emails across all Gmail and IMAP accounts.",
  parameters: z.object({
    // Backward-compatible: if 'query' is provided it will be treated as 'text'
    query: z.string().optional().describe("Deprecated. Use text/since/before. If provided, treated as text."),
    text: z.string().optional().describe("Free text to match (subject/from/body; server + local filter)"),
    since: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    before: z.string().optional().describe("End date (YYYY-MM-DD, exclusive)"),
    folders: z.array(z.string()).optional().describe("Folders to search (IMAP). Defaults include archives."),
    matchFields: z.array(z.enum(["subject","from","body"]))
      .optional()
      .describe("Fields to match text against (default: subject,from)"),
    decodeMime: z.boolean().optional().describe("Decode MIME-encoded headers before matching (default: true)"),
    accounts: z.enum(["ALL", "GMAIL_ONLY", "IMAP_ONLY"]).optional().default("ALL").describe("Which accounts to search"),
    limit: z.number().optional().default(20).describe("Maximum number of results to return"),
    sortBy: z.enum(["date", "relevance"]).optional().default("date").describe("Sort results by date or relevance")
  }),
  execute: async (args) => {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'search_all_emails',
          arguments: args
        }
      };
      const response = await emailServer.handleRequest(request);
      if ('error' in response && response.error) {
        throw new Error(response.error.message);
      }
      return JSON.stringify(response.result);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});


// サーバーを起動
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3456;

server.start({
  transportType: "httpStream",
  httpStream: {
    port: PORT,
    endpoint: "/mcp" as const
  }
}).then(() => {
  console.log(`🚀 FastMCP Email Server started successfully`);
  console.log(`📡 HTTP Streaming: http://localhost:${PORT}/mcp`);
  console.log(`🛠️  Available tools:`);
  console.log(`   Email Operations:`);
  console.log(`   - list_emails: List emails from account`);
  console.log(`   - search_emails: Search emails in account`);
  console.log(`   - get_email_detail: Get email details`);
  console.log(`   - archive_email: Archive email`);
  console.log(`   - send_email: Send email`);
  console.log(`   Account Management:`);
  console.log(`   - list_accounts: List all configured accounts`);
  console.log(`   - test_connection: Test account connection`);
  console.log(`   - get_account_stats: Get account statistics`);
  console.log(`   - search_all_emails: Search across all accounts`);
}).catch((error) => {
  console.error("サーバーの起動に失敗しました:", error);
  process.exit(1);
});