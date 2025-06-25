import { MCPRequest, MCPResponse } from './types';
export declare class MCPEmailServer {
    private gmailHandler;
    constructor();
    handleRequest(request: MCPRequest): Promise<MCPResponse>;
    private handleInitialize;
    private handleToolsList;
    private handleToolsCall;
    private handleResourcesList;
    private handleListEmails;
    private handleSearchEmails;
    private handleGetEmailDetail;
    private handleGetUnreadCount;
    private getAllGmailEmails;
    private createResponse;
}
