# 🎯 Democratize Quality MCP Server

A comprehensive **Model Context Protocol (MCP)** server that democratizes quality through comprehensive API testing capabilities.

## 📋 Overview

This MCP server offers **3 powerful API testing tools** for comprehensive API quality assurance:

### 🔗 API Testing Tools
- **`api_request`**: HTTP requests with validation and session management
- **`api_session_status`**: Query API test session status and logs  
- **`api_session_report`**: Generate comprehensive HTML test reports

**Key Features:**
- ✅ **Enhanced Validation**: Shows "expected vs actual" values in validation failures
- 🔗 **Request Chaining**: Use response data in subsequent requests
- 📊 **Session Management**: Track API test sequences across multiple requests
- 📈 **HTML Reports**: Beautiful, interactive test reports with detailed validation results
- 🎯 **Comprehensive Testing**: Support for all HTTP methods with advanced validation options

## �️ Installation & Setup

### Prerequisites
- Node.js 14+ 
- MCP-compatible client (Claude Desktop, VS Code, etc.)

### Quick Start

**Option 1: Use with npx (Recommended)**
```bash
# Run directly without installation
npx @democratize-quality/mcp-server --help

# Use in Claude Desktop (see integration section below)
```

**Option 2: Global Installation**
```bash
# Install globally 
npm install -g @democratize-quality/mcp-server

# Then run anywhere
democratize-quality-mcp --help
dq-mcp-server --help
```

**Option 3: Local Development**
```bash
# Clone and install dependencies
git clone https://github.com/democratize-quality/mcp-server.git
cd mcp-server
npm install

# Test the server
npm test

# Start the server (API-only mode by default)
npm start
```

## 🔌 Integration Methods

### Claude Desktop Integration (Recommended)

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "democratize-quality": {
      "command": "npx",
      "args": ["@democratize-quality/mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

> **Note:** The server runs in `api-only` mode by default, providing secure and lightweight API testing capabilities.

### Alternative Integration Methods

**Global Installation:**
```bash
npm install -g @democratize-quality/mcp-server
```

Then configure Claude Desktop:
```json
{
  "mcpServers": {
    "democratize-quality": {
      "command": "democratize-quality-mcp"
    }
  }
}
```

**MCP Inspector (Development/Testing):**
```bash
npx @modelcontextprotocol/inspector npx @democratize-quality/mcp-server
```

**Direct Usage:**
```bash
# Run the server directly
npx @democratize-quality/mcp-server

# Or if installed globally
democratize-quality-mcp
```

## 📚 Usage Examples

### Basic API Testing

```javascript
// Single API request with validation
await tools.api_request({
  method: "GET", 
  url: "https://jsonplaceholder.typicode.com/users/1",
  expect: { 
    status: 200,
    contentType: "application/json"
  }
})
```

### Advanced API Testing with Session Management

```javascript
// 1. Start a test session
await tools.api_request({
  sessionId: "user-workflow-test",
  method: "POST", 
  url: "https://jsonplaceholder.typicode.com/users",
  data: {
    name: "John Doe",
    email: "john@example.com"
  },
  expect: { status: 201 }
})

// 2. Follow up request in same session
await tools.api_request({
  sessionId: "user-workflow-test",
  method: "GET",
  url: "https://jsonplaceholder.typicode.com/users/1",
  expect: { 
    status: 200,
    body: { name: "John Doe" }
  }
})

// 3. Generate comprehensive HTML report
await tools.api_session_report({
  sessionId: "user-workflow-test",
  outputPath: "user_workflow_test_report.html"
})
```

### Request Chaining Example

```javascript
// Chain requests using response data
await tools.api_request({
  sessionId: "chained-test",
  chain: [
    {
      name: "create_user",
      method: "POST",
      url: "https://jsonplaceholder.typicode.com/users",
      data: { name: "Jane Doe", email: "jane@example.com" },
      expect: { status: 201 },
      extract: { userId: "id" }
    },
    {
      name: "get_user",
      method: "GET", 
      url: "https://jsonplaceholder.typicode.com/users/{{ create_user.userId }}",
      expect: { 
        status: 200,
        body: { name: "Jane Doe" }
      }
    }
  ]
})
```

📖 **For comprehensive API testing examples and advanced usage patterns, see:** [API Tools Usage Guide](docs/api_tools_usage.md)

## ⚙️ Configuration

### Environment Settings

The server runs in **API-only mode** by default for secure, lightweight deployments focused on API testing.

```bash
NODE_ENV=production                    # Default: API-only mode
OUTPUT_DIR=./output                   # Output directory for reports
MCP_FEATURES_ENABLEDEBUGMODE=true     # Enable debug logging
```

### Command Line Options
```bash
npx @democratize-quality/mcp-server [options]

Options:
  --help, -h                Show help
  --version, -v             Show version
  --debug                   Enable debug mode
  --port <number>           Set server port
```

### Configuration Examples

#### Basic Claude Desktop Configuration
```json
{
  "mcpServers": {
    "democratize-quality": {
      "command": "npx",
      "args": ["@democratize-quality/mcp-server"],
      "env": {
        "OUTPUT_DIR": "~/api-test-reports"
      }
    }
  }
}
```

#### Debug Mode Configuration
```json
{
  "mcpServers": {
    "democratize-quality": {
      "command": "npx",
      "args": ["@democratize-quality/mcp-server", "--debug"],
      "env": {
        "MCP_FEATURES_ENABLEDEBUGMODE": "true"
      }
    }
  }
}
```

### Output Directory Behavior
- **VS Code/Local**: Uses `./output` in your project directory
- **Claude Desktop**: Uses `~/.mcp-browser-control` (in your home directory)  
- **Custom**: Set `OUTPUT_DIR` environment variable to specify location

> **Note:** API test reports and session data will be saved to the configured output directory.

## 🔧 Troubleshooting

### Common Issues

**1. "No such file or directory: mkdir /mcp-output"**
- This happens when Claude Desktop runs the server with restricted permissions
- The server automatically creates `~/.mcp-browser-control` in your home directory
- API test reports will be saved there instead of your project folder

**2. Output files not appearing in expected location**
- Check the actual output directory: `~/.mcp-browser-control/`
- You can set a custom location with: `OUTPUT_DIR=/your/custom/path`

**3. Server not starting in Claude Desktop**
- Verify the npx package is published: `npx @democratize-quality/mcp-server --help`
- Check Claude Desktop logs for detailed error messages
- Try running directly in terminal first to test functionality

**4. API validation failures not showing details**
- The enhanced validation feature shows "expected vs actual" values
- Check the generated HTML reports for detailed comparison views
- Enable debug mode for more detailed logging

### Debug Mode

```bash
# Enable debug output with CLI tool
npx @democratize-quality/mcp-server --debug

# Or via environment variable
MCP_FEATURES_ENABLEDEBUGMODE=true node mcpServer.js
```

**Logging Levels:**
- **Production Mode**: Shows only essential startup messages and errors
- **Debug Mode**: Shows detailed API request/response logs and validation details

## 🔍 Advanced API Testing Features

- **📊 Session Management**: Track API test sequences across multiple requests
- **🔗 Request Chaining**: Use response data from one request in subsequent requests  
- **✅ Enhanced Validation**: Shows "expected vs actual" values when validation fails
- **📈 Interactive Reports**: Beautiful HTML test reports with detailed validation results
- **🎯 Comprehensive Testing**: Support for all HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
- **🔄 Response Extraction**: Extract and reuse data from API responses
- **📝 Detailed Logging**: Complete request/response logging for debugging

## 📄 License

ISC License

---

**Ready to democratize quality through comprehensive API testing with MCP!** 🎯

## 📚 Documentation

- [📖 Getting Started](docs/getting-started.md) - Quick start guide
- [🔧 Tool Reference](docs/api/tool-reference.md) - Complete tool documentation
- [🎯 API Tools Usage Guide](docs/api_tools_usage.md) - Comprehensive API testing examples and patterns
- [👨‍💻 Developer Guide](docs/development/adding-tools.md) - Extending the server
- [⚙️ Configuration](docs/development/configuration.md) - Advanced configuration
- [💡 Examples](docs/examples/) - Real-world usage examples

## 🏗️ Architecture

```
src/
├── tools/api/      # API testing tools
├── config/         # Configuration management
└── utils/          # Utility functions
```

### Key Features
- **Automatic Tool Discovery**: API tools are automatically loaded and registered
- **Configuration System**: Environment-based configuration with sensible defaults
- **Error Handling**: Comprehensive error handling and validation with detailed reporting
- **Session Management**: Track and manage API test sessions

## 🔧 Development

### Adding New API Tools
1. Create tool file in `src/tools/api/`
2. Extend `ToolBase` class
3. Define tool schema and implementation
4. Tools are automatically discovered!

### Example API Tool
```javascript
class MyApiTool extends ToolBase {
  static definition = {
    name: "my_api_tool",
    description: "Performs API testing operations",
    input_schema: { /* JSON schema */ },
    output_schema: { /* JSON schema */ }
  };

  async execute(parameters) {
    // API tool implementation
    return { success: true, data: responseData };
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
- **API-Only Mode**: Enabled by default for secure, lightweight deployments
- **HTTP Requests**: All API requests are performed using standard HTTP libraries
- **No File System Access**: API tools don't access local file system (except for report generation)
- **No Browser Automation**: No browser processes are launched in API-only mode

### Production Deployment Recommendations
```json
{
  "mcpServers": {
    "democratize-quality": {
      "command": "npx",
      "args": ["@democratize-quality/mcp-server"],
      "env": {
        "NODE_ENV": "production",
        "OUTPUT_DIR": "~/api-test-reports"
      }
    }
  }
}
```

### Security Levels
- **🟢 Low Risk**: API Tools - HTTP requests with validation and reporting

### Best Practices
1. **Secure Output Directory**: Ensure output directories have appropriate permissions
2. **Regular Updates**: Keep the package updated for security patches
3. **Environment Separation**: Use different configurations for development vs production
4. **Monitoring**: Enable debug mode during initial deployment to monitor API usage

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
