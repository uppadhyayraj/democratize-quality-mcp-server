# 🚀 CDP Browser Control MCP Server

A comprehensive **Model Context Protocol (MCP)** server that provides browser automation and API testing capabilities through Chrome DevTools Protocol.

## 📋 Overview

This MCP server offers **20 powerful tools** for complete end-to-end testing:

### 🌐 Browser Automation Tools (17)
- **Core Navigation**: `browser_launch`, `browser_navigate`, `browser_close`
- **Interaction**: `browser_click`, `browser_type`, `browser_mouse`, `browser_keyboard`
- **Content Capture**: `browser_screenshot`, `browser_pdf`
- **Advanced Features**: `browser_evaluate`, `browser_wait`, `browser_tabs`, `browser_network`, `browser_console`, `browser_dialog`, `browser_file`, `browser_dom`

### 🔗 API Testing Tools (3)
- **`api_request`**: HTTP requests with validation and session management
- **`api_session_status`**: Query API test session status and logs
- **`api_session_report`**: Generate comprehensive HTML test reports

## �️ Installation & Setup

### Prerequisites
- Node.js 14+ 
- Chrome/Chromium browser
- MCP-compatible client (Claude Desktop, VS Code, etc.)

### Quick Start

**Option 1: Use with npx (Recommended)**
```bash
# Run directly without installation
npx @cdp-browser-control/mcp-server --help

# Use in Claude Desktop (see integration section below)
```

**Option 2: Global Installation**
```bash
# Install globally 
npm install -g @cdp-browser-control/mcp-server

# Then run anywhere
cdp-browser-control --help
```

**Option 3: Local Development**
```bash
# Clone and install dependencies
git clone <repository-url>
cd cdp-browser-control
npm install

# Test the server
npm test

# Start the server
npm start
```

## 🔌 Integration Methods

### Method 1: Claude Desktop Integration (with npx)

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "npx",
      "args": ["@cdp-browser-control/mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Method 2: Claude Desktop Integration (global install)

If you prefer to install globally first:

```bash
npm install -g @cdp-browser-control/mcp-server
```

Then configure Claude Desktop:

```json
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "cdp-browser-control"
    }
  }
}
```

### Method 3: MCP Inspector (Development/Testing)

```bash
npx @modelcontextprotocol/inspector npx @cdp-browser-control/mcp-server
```

### Method 4: Direct Usage

```bash
# Run the server directly
npx @cdp-browser-control/mcp-server

# Or if installed globally
cdp-browser-control
```

## 📚 Usage Examples

### Browser Automation Workflow

```javascript
// 1. Launch browser
await tools.browser_launch({ headless: false })

// 2. Navigate to website  
await tools.browser_navigate({ 
  browserId: "browser_123", 
  url: "https://example.com" 
})

// 3. Take screenshot
await tools.browser_screenshot({ 
  browserId: "browser_123", 
  options: { fullPage: true }
})
```

### API Testing Workflow

```javascript
// 1. API request with validation
await tools.api_request({
  sessionId: "test-session",
  method: "GET", 
  url: "https://api.example.com/users",
  expect: { status: 200 }
})

// 2. Generate HTML report
await tools.api_session_report({
  sessionId: "test-session",
  outputPath: "test_report.html"
})
```

## ⚙️ Configuration

### Environment Variables
```bash
NODE_ENV=production          # Production mode
OUTPUT_DIR=./output         # Output directory (optional)
```

### Output Directory Behavior
- **VS Code/Local**: Uses `./output` in your project directory
- **Claude Desktop**: Uses `~/.mcp-browser-control` (in your home directory)
- **Custom**: Set `OUTPUT_DIR` environment variable to specify location

### Feature Flags (src/config/server.js)
```javascript
features: {
  enableBrowserTools: true,   // Browser automation tools
  enableOtherTools: true,     // API testing tools
  enableDebugMode: false      // Debug logging
}
```

## 🔧 Troubleshooting

### Common Issues

**1. "No such file or directory: mkdir /mcp-output"**
- This happens when Claude Desktop runs the server with restricted permissions
- The server automatically creates `~/.mcp-browser-control` in your home directory
- Screenshots and PDFs will be saved there instead of your project folder

**2. Output files not appearing in expected location**
- Check the actual output directory: `~/.mcp-browser-control/`
- You can set a custom location with: `OUTPUT_DIR=/your/custom/path`

**3. Server not starting in Claude Desktop**
- Verify the npx package is published: `npx @cdp-browser-control/mcp-server --help`
- Check Claude Desktop logs for detailed error messages
- Try running directly in terminal first to test functionality

### Debug Mode
```bash
# Enable debug output
npx @cdp-browser-control/mcp-server --debug
```

## 🔍 Advanced Features

- **Session Management**: Track API test sequences
- **Request Chaining**: Use response data in subsequent requests  
- **PDF Generation**: Convert pages to PDF with custom options
- **Network Monitoring**: Track and analyze network requests
- **File Operations**: Handle uploads and downloads
- **Interactive Reports**: Beautiful HTML test reports

## 📄 License

ISC License

---

**Ready to automate browsers and test APIs with MCP!** 🎯
    "arguments": { "headless": true }
  }
}

// Navigate to page
{
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "browserId": "browser-123",
      "url": "https://example.com"
    }
  }
}
```

## ⚙️ Configuration

### Environment Modes
```bash
# Development (shows browser UI)
node mcpServer.js

# Production (headless mode)
NODE_ENV=production node mcpServer.js
```

### Feature Flags
```bash
# Disable browser tools
MCP_FEATURES_ENABLEBROWSERTOOLS=false node mcpServer.js

# Enable debug mode
MCP_FEATURES_ENABLEDEBUGMODE=true node mcpServer.js
```

## 📚 Documentation

- [📖 Getting Started](docs/getting-started.md) - Quick start guide
- [🔧 Tool Reference](docs/api/tool-reference.md) - Complete tool documentation
- [👨‍💻 Developer Guide](docs/development/adding-tools.md) - Extending the server
- [⚙️ Configuration](docs/development/configuration.md) - Advanced configuration
- [💡 Examples](docs/examples/) - Real-world usage examples

## 🏗️ Architecture

```
src/
├── tools/          # Modular tool system
├── services/       # Core browser management
├── config/         # Configuration management
└── utils/          # Utility functions
```

### Key Features
- **Automatic Tool Discovery**: Tools are automatically loaded and registered
- **Configuration System**: Environment-based configuration with overrides
- **Error Handling**: Comprehensive error handling and validation
- **Feature Flags**: Control tool availability at runtime

## 🔧 Development

### Adding New Tools
1. Create tool file in `src/tools/{category}/`
2. Extend `ToolBase` class
3. Define tool schema and implementation
4. Tools are automatically discovered!

### Example Tool
```javascript
class MyTool extends ToolBase {
  static definition = {
    name: "my_tool",
    description: "Does something useful",
    input_schema: { /* JSON schema */ },
    output_schema: { /* JSON schema */ }
  };

  async execute(parameters) {
    // Tool implementation
    return { success: true };
  }
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📄 License

[License Type] - see [LICENSE](LICENSE) file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your changes with tests
4. Update documentation
5. Submit a pull request

## 📞 Support

- [Issues](link-to-issues) - Bug reports and feature requests
- [Discussions](link-to-discussions) - Questions and community support
- [Documentation](docs/) - Comprehensive guides and references

---

*Generated automatically from tool definitions and configuration*
