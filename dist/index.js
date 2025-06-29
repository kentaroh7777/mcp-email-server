import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MCPEmailProtocolHandler } from './mcp-handler.js';
// 現在のファイルの場所から相対的に.envファイルを見つける
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });
export class MCPEmailServer {
    constructor() {
        this.handler = new MCPEmailProtocolHandler();
    }
    async handleRequest(request) {
        return await this.handler.handleRequest(request);
    }
    // IMAPアカウント追加メソッド（設定用）
    addImapAccount(accountName, host, port, secure, user, encryptedPassword) {
        this.handler.addImapAccount(accountName, host, port, secure, user, encryptedPassword);
    }
    addXServerAccount(accountName, server, domain, username, encryptedPassword) {
        this.handler.addXServerAccount(accountName, server, domain, username, encryptedPassword);
    }
}
// メイン実行部分
async function main() {
    const server = new MCPEmailServer();
    // 環境変数からIMAPアカウントを設定
    const imapAccounts = [
        {
            name: 'info_h_fpo_com',
            host: process.env.IMAP_HOST_info_h_fpo_com || '',
            port: parseInt(process.env.IMAP_PORT_info_h_fpo_com || '993'),
            secure: process.env.IMAP_SECURE_info_h_fpo_com === 'true',
            user: process.env.IMAP_USER_info_h_fpo_com || '',
            encryptedPassword: process.env.IMAP_PASSWORD_info_h_fpo_com || ''
        },
        {
            name: 'hello_foobar_taroken',
            host: process.env.IMAP_HOST_hello_foobar_taroken || '',
            port: parseInt(process.env.IMAP_PORT_hello_foobar_taroken || '993'),
            secure: process.env.IMAP_SECURE_hello_foobar_taroken === 'true',
            user: process.env.IMAP_USER_hello_foobar_taroken || '',
            encryptedPassword: process.env.IMAP_PASSWORD_hello_foobar_taroken || ''
        }
    ];
    // XServerアカウントを設定
    if (process.env.XSERVER_DOMAIN_xserver && process.env.XSERVER_USERNAME_xserver && process.env.XSERVER_PASSWORD_xserver) {
        server.addXServerAccount('xserver', 'sv14333.xserver.jp', process.env.XSERVER_DOMAIN_xserver, process.env.XSERVER_USERNAME_xserver, process.env.XSERVER_PASSWORD_xserver);
    }
    // IMAPアカウントを追加
    for (const account of imapAccounts) {
        if (account.host && account.user && account.encryptedPassword) {
            server.addImapAccount(account.name, account.host, account.port, account.secure, account.user, account.encryptedPassword);
        }
    }
    // 標準入力からJSONRPCリクエストを読み取り
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.on('line', async (line) => {
        try {
            const request = JSON.parse(line);
            const response = await server.handleRequest(request);
            console.log(JSON.stringify(response));
        }
        catch (error) {
            console.error(JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32700,
                    message: 'Parse error'
                }
            }));
        }
    });
    rl.on('close', () => {
        process.exit(0);
    });
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map