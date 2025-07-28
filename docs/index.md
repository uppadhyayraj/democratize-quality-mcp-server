# Documentation Index

Welcome to the Democratize Quality MCP Server documentation!

## 📚 Table of Contents

### Getting Started
- [🚀 Getting Started](getting-started.md) - Quick start guide and basic usage
- [📦 Installation](getting-started.md#installation) - Setup and prerequisites

### API Reference
- [🔧 Tool Reference](api/tool-reference.md) - Complete documentation for all tools
- [⚙️ Feature Flags](api/tool-reference.md#feature-flags) - Tool control and configuration

### Development
- [👨‍💻 Adding Tools](development/adding-tools.md) - Developer guide for extending the server
- [🏗️ Architecture](development/adding-tools.md#architecture-overview) - System architecture overview
- [⚙️ Configuration](development/configuration.md) - Advanced configuration options
- [🧪 Testing](development/adding-tools.md#testing) - Testing guidelines and examples

### Examples
- [🤖 Basic Automation](examples/basic-automation.md) - Essential browser automation workflows
- [🔐 Authentication](examples/authentication.md) - Login flows and session management

### Additional Resources
- [📄 Main README](../README.md) - Project overview and quick reference
- [📋 Package Info](../package.json) - Project dependencies and scripts

## 🎯 Quick Navigation

### By Use Case
- **First-time setup**: [Getting Started](getting-started.md)
- **Tool usage**: [Tool Reference](api/tool-reference.md)
- **Extending functionality**: [Adding Tools](development/adding-tools.md)
- **Configuration tuning**: [Configuration Guide](development/configuration.md)
- **Real-world examples**: [Examples](examples/)

### By Role
- **🤖 AI Agent Developers**: Start with [Tool Reference](api/tool-reference.md)
- **🛠️ Server Developers**: Read [Adding Tools](development/adding-tools.md)
- **⚙️ System Administrators**: Check [Configuration Guide](development/configuration.md)
- **📊 Integration Teams**: Review [Examples](examples/)

## 🔄 Keeping Documentation Updated

Documentation is automatically generated from the codebase:

```bash
# Regenerate all documentation
npm run docs:generate

# Watch for changes and regenerate
npm run docs:watch

# Clean and regenerate
npm run docs:clean && npm run docs:generate
```

---

*Documentation generated automatically from tool definitions and configuration - Last updated: ${new Date().toISOString().split('T')[0]}*
