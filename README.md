# MCP Email Server

Complete Gmail + IMAP email server implementing the Model Context Protocol (MCP) for AI assistants.

## Features

- **Multiple Gmail Account Support**: OAuth2 authentication for multiple Gmail accounts
- **IMAP Server Support**: Connect to any IMAP server (including xserver and custom domains)
- **Unified Cross-Account Search**: Search across all Gmail and IMAP accounts simultaneously
- **Account Management**: List accounts, test connections, and view status
- **Encrypted Password Storage**: Secure password encryption for IMAP accounts
- **Connection Testing**: Built-in connection testing and diagnostics
- **MCP Protocol Compliance**: Full MCP 2024-11-05 specification support

## Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd mcp-email-server
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration](#configuration) below).

### 3. Build and Test

```bash
npm run build
node test-connection.js  # Test your configuration
```

### 4. Cursor Integration

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "email": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-email-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```bash
# Encryption key for password storage (change this!)
EMAIL_ENCRYPTION_KEY=your-secret-encryption-key-here

# Gmail OAuth2 Configuration
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback

# Gmail Account Tokens (obtain via OAuth2 flow)
GMAIL_ACCESS_TOKEN_account1=your-access-token
GMAIL_REFRESH_TOKEN_account1=your-refresh-token

# Additional Gmail accounts
GMAIL_ACCESS_TOKEN_account2=your-access-token-2
GMAIL_REFRESH_TOKEN_account2=your-refresh-token-2

# IMAP Account Configuration
IMAP_HOST_myimap=imap.example.com
IMAP_PORT_myimap=993
IMAP_SECURE_myimap=true
IMAP_USER_myimap=user@example.com
IMAP_PASSWORD_myimap=encrypted_password_here

# XServer Account Configuration (simplified setup)
XSERVER_DOMAIN_mydomain=mydomain.com
XSERVER_USERNAME_mydomain=username
XSERVER_PASSWORD_mydomain=encrypted_password_here
```

### Gmail Setup

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Gmail API

2. **Configure OAuth2**:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Desktop application"
   - Note the Client ID and Client Secret

3. **Get Access Tokens**:
   - Run the OAuth2 flow to get access and refresh tokens
   - Store tokens in environment variables

### IMAP Setup

1. **Standard IMAP Server**:
   ```bash
   IMAP_HOST_myaccount=imap.provider.com
   IMAP_PORT_myaccount=993
   IMAP_SECURE_myaccount=true
   IMAP_USER_myaccount=user@provider.com
   IMAP_PASSWORD_myaccount=encrypted_password
   ```

2. **XServer (Japanese hosting)**:
   ```bash
   XSERVER_DOMAIN_mydomain=example.com
   XSERVER_USERNAME_mydomain=username
   XSERVER_PASSWORD_mydomain=encrypted_password
   ```

### Password Encryption

Use the crypto utility to encrypt passwords:

```bash
node -e "
const crypto = require('./dist/crypto');
const encrypted = crypto.encrypt('your-password', process.env.EMAIL_ENCRYPTION_KEY);
console.log('Encrypted password:', encrypted);
"
```

## Available Tools

### Unified Tools (Cross-Account)

- **`list_accounts`**: List all configured accounts with status
- **`test_connection`**: Test connection to specific account
- **`search_all_emails`**: Search across all Gmail/IMAP accounts
- **`get_account_stats`**: Get statistics for all accounts

### Gmail Tools

- **`list_emails`**: List emails from Gmail account
- **`search_emails`**: Search emails in Gmail account
- **`get_email_detail`**: Get detailed email content
- **`get_unread_count`**: Get unread email count

### IMAP Tools

- **`list_imap_emails`**: List emails from IMAP account
- **`search_imap_emails`**: Search emails in IMAP account
- **`get_imap_email_detail`**: Get detailed email content from IMAP
- **`get_imap_unread_count`**: Get unread count from IMAP

## Usage Examples

### Basic Email Search

```javascript
// Search across all accounts
{
  "tool": "search_all_emails",
  "arguments": {
    "query": "invoice",
    "accounts": "ALL",
    "limit": 10,
    "sortBy": "date"
  }
}
```

### Account Management

```javascript
// List all accounts and their status
{
  "tool": "list_accounts",
  "arguments": {}
}

// Test specific account connection
{
  "tool": "test_connection",
  "arguments": {
    "account_name": "myaccount"
  }
}
```

### Account Statistics

```javascript
// Get comprehensive account statistics
{
  "tool": "get_account_stats",
  "arguments": {}
}
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Test Gmail connection
node test_gmail.js

# Test IMAP connection
node test_imap.js

# Test complete integration
node test-connection.js
```

### Development Mode

```bash
npm run dev
```

## Troubleshooting

### Common Issues

1. **Gmail Authentication Errors**:
   - Verify OAuth2 credentials
   - Check token expiration
   - Ensure Gmail API is enabled

2. **IMAP Connection Failures**:
   - Verify server settings (host, port, security)
   - Check encrypted password
   - Test with email client first

3. **Password Decryption Errors**:
   - Verify EMAIL_ENCRYPTION_KEY matches encryption key
   - Re-encrypt passwords if key changed

4. **MCP Connection Issues**:
   - Check absolute path in mcp-config.json
   - Verify build completed successfully
   - Check Node.js version (>=18 required)

### Debug Mode

Set debug environment variables:

```bash
DEBUG=1 npm start
```

### Logs

Check application logs for detailed error information:

```bash
tail -f logs/mcp-email-server.log
```

## Security Notes

- **Never commit plaintext passwords** to version control
- **Use strong encryption keys** for password storage
- **Rotate OAuth2 tokens** regularly
- **Use environment variables** for all sensitive data
- **Review access logs** regularly

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review logs for error details
- Create an issue with detailed information