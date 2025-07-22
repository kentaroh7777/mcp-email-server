import * as readline from "readline";
import { google } from "googleapis";
import * as dotenv from "dotenv";

dotenv.config();

class WorkingMCPServer {
  constructor() {
    console.error("[MCP] Working MCP Server 起動");
  }

  async initializeGmail() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN_kentaroh7;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.gmail({ version: "v1", auth: oauth2Client });
  }

  async handleListEmails(args) {
    console.error("[MCP] Gmail listEmails開始");
    
    const gmail = await this.initializeGmail();
    const limit = Math.min(args.limit || 20, 5);
    
    console.error(`[MCP] Gmail API呼び出し: limit=${limit}`);
    const response = await gmail.users.messages.list({
      userId: "me",
      q: args.unread_only ? "is:unread" : "in:inbox",
      maxResults: limit
    });

    console.error(`[MCP] Gmail API成功: ${response.data.messages?.length || 0}件取得`);

    if (!response.data.messages) return { emails: [] };

    const emails = [];
    for (const message of response.data.messages.slice(0, 2)) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"]
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name === name)?.value || "";

      emails.push({
        id: message.id,
        subject: getHeader("Subject") || "(件名なし)",
        from: getHeader("From") || "(送信者不明)",
        date: getHeader("Date") || "",
        snippet: detail.data.snippet || ""
      });
    }

    console.error(`[MCP] listEmails完了: ${emails.length}件`);
    return { emails };
  }

  createResponse(id, result) {
    return {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    };
  }

  async handleRequest(request) {
    console.error(`[MCP] リクエスト処理: ${request.method}`);

    if (request.method === "tools/call" && request.params.name === "list_emails") {
      const result = await this.handleListEmails(request.params.arguments);
      return this.createResponse(request.id, result);
    }
    
    return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Unknown method" } };
  }
}

const server = new WorkingMCPServer();
const rl = readline.createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  try {
    const request = JSON.parse(line);
    const response = await server.handleRequest(request);
    console.log(JSON.stringify(response));
    process.exit(0);
  } catch (error) {
    console.error("[ERROR]", error);
  }
});
