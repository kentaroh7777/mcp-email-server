#!/usr/bin/env node

import { MCPEmailProtocolHandlerFast } from './mcp-handler-fast.js';

async function main() {
  const handler = new MCPEmailProtocolHandlerFast();

  // Set up stdin/stdout for MCP communication
  process.stdin.setEncoding('utf8');
  
  let buffer = '';
  
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    
    // Process complete JSON lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const request = JSON.parse(line);
          const response = await handler.handleRequest(request);
          
          // Send response immediately
          process.stdout.write(JSON.stringify(response) + '\n');
        } catch (error) {
          // Send error response for invalid JSON
          const errorResponse = {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error'
            }
          };
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fast Email Server Error:', error);
  process.exit(1);
}); 