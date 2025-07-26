# MCP Browser Control Server

A powerful Model Context Protocol (MCP) server for browser automation and control. Provides AI agents with comprehensive web browser capabilities including navigation, interaction, and content extraction.

## 🚀 Features

- **Browser Automation**: Launch, control, and manage Chrome/Chromium instances
- **Web Interaction**: Click elements, type text, navigate pages
- **Content Extraction**: Take screenshots, extract DOM content
- **Session Management**: Persistent browser profiles for authenticated sessions
- **Configuration**: Flexible environment-based configuration system
- **Modular Architecture**: Easy to extend with new tools
- **Feature Flags**: Enable/disable tool categories as needed

## 📦 Installation

### Prerequisites
- Node.js 18+
- Chrome or Chromium browser

### Setup
```bash
git clone <repository-url>
cd cdp-browser-control
npm install
```

## 🎯 Quick Start

### Start the Server
```bash
node mcpServer.js
```

### Available Tools
- `browser_launch` - Launch browser instances
- `browser_navigate` - Navigate to web pages
- `browser_click` - Click page elements
- `browser_type` - Type text into inputs
- `browser_screenshot` - Capture page screenshots
- `browser_dom` - Extract page content
- `browser_close` - Close browser instances

### Basic Usage Example
```json
// Launch browser
{
  "method": "tools/call",
  "params": {
    "name": "browser_launch",
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
