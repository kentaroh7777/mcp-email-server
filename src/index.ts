import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { MCPRequest, MCPResponse, InitializeResult } from './types';

dotenv.config();

export class MCPEmailServer {
  // Task 2, 3で使用予定
  // private encryptionKey: string;

  constructor() {
    // this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key';
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        
        case 'tools/list':
          return this.handleToolsList(request);
        
        case 'tools/call':
          return this.handleToolsCall(request);
        
        case 'resources/list':
          return this.handleResourcesList(request);
        
        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    const result: InitializeResult = {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true }
      },
      serverInfo: {
        name: 'mcp-email-server',
        version: '1.0.0'
      }
    };

    return {
      jsonrpc: '2.0',
      id: request.id,
      result
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { tools: [] }
    };
  }

  private handleToolsCall(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32601,
        message: 'Tool not found'
      }
    };
  }

  private handleResourcesList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { resources: [] }
    };
  }

  // 暗号化・復号化メソッド（Task 2, 3で使用予定）
  // private encrypt(text: string): string {
  //   return encrypt(text, this.encryptionKey);
  // }

  // private decrypt(encryptedText: string): string {
  //   return decrypt(encryptedText, this.encryptionKey);
  // }
}

const server = new MCPEmailServer();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line: string) => {
  try {
    const request = JSON.parse(line.trim());
    const response = await server.handleRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0' as const,
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
});

process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rl.close();
  process.exit(0);
});