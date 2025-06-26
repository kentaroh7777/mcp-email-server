const { MCPEmailServer } = require('./dist/index.js');
const { encrypt } = require('./dist/crypto.js');

// Test IMAP functionality
async function testIMAPIntegration() {
  try {
    console.log('Testing IMAP integration...');
    
    // Create server instance
    const server = new MCPEmailServer();
    
    // Test with fake encrypted password (for demonstration)
    const testPassword = 'test_password';
    const encryptedPassword = encrypt(testPassword, 'test-key');
    
    // Add a test xServer account
    server.addXServerAccount('test-xserver', 'sv1234.xserver.jp', 'test@example.com', encryptedPassword);
    
    console.log('✓ XServer account added successfully');
    
    // Test tools list
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    };
    
    const toolsResponse = await server.handleRequest(toolsRequest);
    console.log('✓ Tools list retrieved');
    console.log('Available tools:', toolsResponse.result.tools.map(t => t.name));
    
    // Check if IMAP tools are included
    const imapTools = toolsResponse.result.tools.filter(t => t.name.includes('imap'));
    console.log('✓ IMAP tools found:', imapTools.length);
    
    console.log('IMAP integration test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  testIMAPIntegration();
}

module.exports = { testIMAPIntegration };