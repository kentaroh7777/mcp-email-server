#!/usr/bin/env tsx

import * as readline from 'readline'

class MinimalMCPHandler {
  async handleRequest(request: any) {
    const validationResult = this.validateRequest(request)
    if (!validationResult.isValid) {
      return this.createErrorResponse(request?.id ?? 0, validationResult.error)
    }

    const mcpRequest = request
    try {
      switch (mcpRequest.method) {
        case 'initialize':
          const initializeResult = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: true, listChanged: true },
              prompts: { listChanged: true }
            },
            serverInfo: {
              name: 'minimal-test-server',
              version: '1.0.0'
            }
          }
          return this.createResponse(mcpRequest.id, initializeResult)
        case 'tools/list':
          return this.createResponse(mcpRequest.id, {
            tools: [
              {
                name: 'test_tool',
                description: 'Simple test tool',
                inputSchema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', description: 'Test message' }
                  }
                }
              }
            ]
          })
        case 'tools/call':
          const { name, arguments: args } = mcpRequest.params || {}
          return await this.handleToolCall(name, args, mcpRequest.id)
        default:
          return this.createErrorResponse(mcpRequest.id, {
            code: -32601,
            message: 'Method not found'
          })
      }
    }
    catch (error) {
      return this.createErrorResponse(mcpRequest.id, {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async handleToolCall(toolName: string, args: any, requestId: any) {
    try {
      switch (toolName) {
        case 'test_tool':
          return this.createResponse(requestId, {
            content: [
              {
                type: 'text',
                text: `Test successful! Message: ${args?.message || 'No message provided'}`
              }
            ]
          })
        default:
          return this.createErrorResponse(requestId, {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          })
      }
    }
    catch (error) {
      return this.createErrorResponse(requestId, {
        code: -32603,
        message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }

  validateRequest(request: any) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      }
    }

    if (request.jsonrpc !== '2.0') {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      }
    }

    if (!('id' in request)) {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      }
    }

    if (!request.method) {
      return {
        isValid: false,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      }
    }

    return {
      isValid: true
    }
  }

  createResponse(id: any, result: any) {
    return {
      jsonrpc: '2.0',
      id,
      result
    }
  }

  createErrorResponse(id: any, error: any) {
    return {
      jsonrpc: '2.0',
      id: id === null ? 0 : id,
      error
    }
  }
}

const handler = new MinimalMCPHandler()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
})

rl.on('line', async (line: string) => {
  try {
    const request = JSON.parse(line.trim())
    const response = await handler.handleRequest(request)
    console.log(JSON.stringify(response))
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    }
    console.log(JSON.stringify(errorResponse))
  }
})

process.on('SIGINT', () => {
  rl.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  rl.close()
  process.exit(0)
})