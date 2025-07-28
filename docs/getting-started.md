# Getting Started

Quick start guide for the Democratize Quality MCP Server.

---

## Installation

### Prerequisites

- Node.js 18+ 
- Chrome/Chromium browser
- Git

### Clone and Setup

```bash
git clone https://github.com/democratize-quality/mcp-server.git
cd mcp-server
npm install
```

## Basic Usage

### 1. Start the Server

```bash
node mcpServer.js
```

The server will start and display available tools:

```
[Tools] Tool system initialized successfully:
[Tools] - Total tools: 7
[Tools] - Available tools: browser_launch, browser_navigate, browser_screenshot, ...
```

### 2. Connect an MCP Client

The server communicates via JSON-RPC over stdin/stdout. Example client integration:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

### 3. Basic Browser Automation

Here's a complete example of launching a browser, navigating to a page, and taking a screenshot:

```json
// 1. Launch browser
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "browser_launch",
    "arguments": { "headless": true }
  }
}

// 2. Navigate to page
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "browserId": "browser-123",
      "url": "https://example.com"
    }
  }
}

// 3. Take screenshot
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "browser_screenshot",
    "arguments": {
      "browserId": "browser-123",
      "fileName": "example.png"
    }
  }
}
```

## Configuration

### Environment Modes

**Development Mode** (default):
- Shows browser UI
- Detailed logging
- Debug features enabled

**Production Mode**:
```bash
NODE_ENV=production node mcpServer.js
```
- Headless browsers only
- Minimal logging
- Optimized performance

### Feature Flags

Disable specific tool categories:

```bash
# Disable browser tools
MCP_FEATURES_ENABLEBROWSERTOOLS=false node mcpServer.js

# Run with only specific tools
MCP_FEATURES_ENABLEFILETOOLS=false \
MCP_FEATURES_ENABLENETWORKTOOLS=false \
node mcpServer.js
```

### Custom Configuration

Create environment-specific configs in `src/config/environments/`:

```javascript
// src/config/environments/testing.js
module.exports = {
  tools: {
    browser: {
      browser_launch: {
        defaultHeadless: true,
        maxInstances: 1
      }
    }
  }
};
```

Run with custom environment:
```bash
NODE_ENV=testing node mcpServer.js
```

## Common Use Cases

### Web Scraping
1. Launch browser with persistent profile
2. Navigate to login page
3. Fill credentials
4. Navigate to target pages
5. Extract data
6. Close browser

### Automated Testing
1. Launch browser in headless mode
2. Navigate to application
3. Perform user interactions
4. Take screenshots for verification
5. Assert expected outcomes

### Content Generation
1. Navigate to webpage
2. Take full-page screenshots
3. Extract text content
4. Generate reports

## Troubleshooting

### Common Issues

**Browser fails to launch:**
- Ensure Chrome/Chromium is installed
- Check user permissions
- Try running with `--no-sandbox` flag

**Tools not loading:**
- Check feature flags are enabled
- Verify file permissions
- Review server logs for errors

**Connection issues:**
- Ensure proper JSON-RPC formatting
- Check stdin/stdout communication
- Verify MCP client implementation

### Debug Mode

Enable detailed logging:
```bash
MCP_FEATURES_ENABLEDEBUGMODE=true node mcpServer.js
```

### Logs Location

- Server logs: stderr output
- Screenshots: `./output/` directory
- Browser data: Temporary profiles in system temp

## Next Steps

- [Tool Reference](api/tool-reference.md) - Complete tool documentation
- [Developer Guide](development/adding-tools.md) - Extend the server
- [Configuration Guide](development/configuration.md) - Advanced configuration
- [Examples](examples/) - Real-world usage examples

---

*For more help, check the documentation or open an issue on GitHub.*
