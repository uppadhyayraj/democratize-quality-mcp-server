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

> **Note:** By default, the server runs in `api-only` mode, which enables only API testing tools for security and performance. To enable browser automation, use `NODE_ENV=development` or specific feature flags.

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

### Tool Categories

The server supports granular control over which tools are available. By default, **API tools are enabled in api-only mode** for lightweight, secure deployments focused on API testing.

#### Available Tool Categories:
- **🔗 API Tools** (`enableApiTools`): API testing, session management, and report generation
- **🌐 Browser Tools** (`enableBrowserTools`): Core browser automation (launch, navigate, click, etc.)
- **⚡ Advanced Tools** (`enableAdvancedTools`): Advanced browser features (console, network, PDF, etc.)
- **📁 File Tools** (`enableFileTools`): File system operations (disabled by default for security)
- **🌐 Network Tools** (`enableNetworkTools`): Network-related operations (disabled by default for security)
- **🔧 Other Tools** (`enableOtherTools`): Miscellaneous utilities

### Quick Start Configurations

#### 🔗 API-Only Mode (Recommended for API Testing)
```bash
# Command line
npx @cdp-browser-control/mcp-server --api-only

# Environment variable
NODE_ENV=api-only

# Claude Desktop config
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "npx",
      "args": ["@cdp-browser-control/mcp-server", "--api-only"]
    }
  }
}
```

#### 🌐 Browser-Only Mode
```bash
# Command line
npx @cdp-browser-control/mcp-server --browser-only

# Environment variables
MCP_FEATURES_ENABLEAPITOOLS=false
MCP_FEATURES_ENABLEBROWSERTOOLS=true
MCP_FEATURES_ENABLEADVANCEDTOOLS=true
```

#### 🚀 Enable All Tools
```bash
# Command line
npx @cdp-browser-control/mcp-server --enable-all

# Environment variable
NODE_ENV=development
```

### Environment Variables

#### Core Settings
```bash
NODE_ENV=production                           # Environment (api-only|development|production) - default: api-only
OUTPUT_DIR=./output                          # Output directory (optional)
MCP_FEATURES_ENABLEDEBUGMODE=true            # Enable debug logging
```

#### Tool Category Control
```bash
MCP_FEATURES_ENABLEAPITOOLS=true             # API testing tools (default: true)
MCP_FEATURES_ENABLEBROWSERTOOLS=false        # Browser automation tools (default: false in api-only)
MCP_FEATURES_ENABLEADVANCEDTOOLS=false       # Advanced browser tools (default: false)
MCP_FEATURES_ENABLEFILETOOLS=false           # File system tools (default: false)
MCP_FEATURES_ENABLENETWORKTOOLS=false        # Network tools (default: false)
MCP_FEATURES_ENABLEOTHERTOOLS=false          # Other utilities (default: false)
```

### Command Line Options
```bash
npx @cdp-browser-control/mcp-server [options]

Options:
  --help, -h                Show help
  --version, -v             Show version
  --debug                   Enable debug mode
  --port <number>           Set server port
  --env <environment>       Set environment (development|production|api-only)
  
Tool Category Options:
  --api-only                Enable only API tools
  --browser-only            Enable only browser tools  
  --no-api                  Disable API tools
  --no-browser              Disable browser tools
  --no-advanced             Disable advanced browser tools
  --enable-all              Enable all tool categories
```

### Configuration Examples

#### Claude Desktop - API Testing Only
```json
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "npx",
      "args": ["@cdp-browser-control/mcp-server", "--api-only"],
      "env": {
        "OUTPUT_DIR": "~/api-test-reports"
      }
    }
  }
}
```

#### Claude Desktop - Full Browser Automation
```json
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "npx", 
      "args": ["@cdp-browser-control/mcp-server", "--enable-all"],
      "env": {
        "NODE_ENV": "development",
        "MCP_FEATURES_ENABLEDEBUGMODE": "true"
      }
    }
  }
}
```

#### Production Environment - API + Core Browser Tools
```json
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "npx",
      "args": ["@cdp-browser-control/mcp-server"],
      "env": {
        "NODE_ENV": "production",
        "MCP_FEATURES_ENABLEAPITOOLS": "true",
        "MCP_FEATURES_ENABLEBROWSERTOOLS": "true",
        "MCP_FEATURES_ENABLEADVANCEDTOOLS": "false"
      }
    }
  }
}
```

### Output Directory Behavior
- **VS Code/Local**: Uses `./output` in your project directory
- **Claude Desktop**: Uses `~/.mcp-browser-control` (in your home directory)  
- **Custom**: Set `OUTPUT_DIR` environment variable to specify location

### Feature Flags (Advanced Configuration)
For custom deployments, you can modify the configuration files:

```javascript
// src/config/environments/production.js
features: {
  enableApiTools: true,        // API testing tools
  enableBrowserTools: true,    // Browser automation tools  
  enableAdvancedTools: false,  // Advanced browser features
  enableFileTools: false,      // File operations (security)
  enableNetworkTools: false,   // Network operations (security)
  enableOtherTools: false,     // Other utilities
  enableDebugMode: false       // Debug logging
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

The server supports different logging modes for various use cases:

```bash
# Production mode (minimal logging) - Default for Claude Desktop
npm start
# or
NODE_ENV=production node mcpServer.js

# Debug mode (detailed logging) - For development and troubleshooting
npm run dev
# or  
MCP_FEATURES_ENABLEDEBUGMODE=true node mcpServer.js

# Enable debug output with CLI tool
npx @cdp-browser-control/mcp-server --debug
```

**Logging Levels:**
- **Production Mode**: Shows only essential startup messages and errors
- **Debug Mode**: Shows detailed request/response logs, tool registration, and configuration loading

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

## � Security Considerations

### Default Security Posture
- **File Tools**: Disabled by default to prevent unauthorized file system access
- **Network Tools**: Disabled by default to prevent network-based attacks
- **Advanced Tools**: Disabled by default for conservative security posture
- **API Tools**: Enabled by default as they're generally safer for testing

### Production Deployment Recommendations
```json
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "npx",
      "args": ["@cdp-browser-control/mcp-server"],
      "env": {
        "NODE_ENV": "production",
        "MCP_FEATURES_ENABLEAPITOOLS": "true",
        "MCP_FEATURES_ENABLEBROWSERTOOLS": "true",
        "MCP_FEATURES_ENABLEADVANCEDTOOLS": "false",
        "MCP_FEATURES_ENABLEFILETOOLS": "false",
        "MCP_FEATURES_ENABLENETWORKTOOLS": "false"
      }
    }
  }
}
```

### Tool Category Security Levels
- **🟢 Low Risk**: API Tools - HTTP requests with validation
- **🟡 Medium Risk**: Browser Tools - Automated browsing with sandboxed browser
- **🟡 Medium Risk**: Advanced Tools - Extended browser capabilities
- **🔴 High Risk**: File Tools - Direct file system access
- **🔴 High Risk**: Network Tools - Raw network operations

### Best Practices
1. **Principle of Least Privilege**: Only enable tool categories you need
2. **Environment Separation**: Use different configurations for development vs production
3. **Output Directory**: Ensure output directories have appropriate permissions
4. **Regular Updates**: Keep the package updated for security patches
5. **Monitoring**: Enable debug mode during initial deployment to monitor tool usage

## �📄 License

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
