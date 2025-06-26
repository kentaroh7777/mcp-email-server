// Simple test to verify Gmail implementation
const { GmailHandler } = require('./dist/gmail.js');

// Test Gmail handler instantiation
try {
    const handler = new GmailHandler();
    console.log('✓ GmailHandler instantiated successfully');
    
    // Test available accounts
    const accounts = handler.getAvailableAccounts();
    console.log('✓ Available accounts:', accounts);
    
    console.log('✓ Gmail implementation test passed');
} catch (error) {
    console.error('✗ Gmail implementation test failed:', error.message);
}