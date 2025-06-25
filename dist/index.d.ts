import { MCPRequest, MCPResponse } from './types';
export declare class MCPEmailServer {
    constructor();
    handleRequest(request: MCPRequest): Promise<MCPResponse>;
    private handleInitialize;
    private handleToolsList;
    private handleToolsCall;
    private handleResourcesList;
}
