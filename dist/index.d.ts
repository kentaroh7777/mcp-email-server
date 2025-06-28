import { MCPRequest, MCPResponse } from './types.js';
export declare class MCPEmailServer {
    private handler;
    constructor();
    handleRequest(request: MCPRequest): Promise<MCPResponse>;
    addImapAccount(accountName: string, host: string, port: number, secure: boolean, user: string, encryptedPassword: string): void;
    addXServerAccount(accountName: string, server: string, domain: string, username: string, encryptedPassword: string): void;
}
