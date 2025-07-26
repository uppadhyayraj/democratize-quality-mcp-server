# Configuration Guide

Comprehensive guide to configuring the MCP Browser Control Server.

---

## Configuration Structure

The configuration system supports multiple sources with clear precedence:

1. **Environment Variables** (highest precedence)
2. **Environment-specific files** (`environments/`)
3. **Tool-specific files** (`tools/`)
4. **Default configuration** (lowest precedence)

```
src/config/
├── index.js                 # Configuration manager
├── server.js                # Server settings
├── tools/
│   ├── default.js          # Default tool settings
│   └── browser.js          # Browser tool settings
└── environments/
    ├── development.js      # Development overrides
    └── production.js       # Production overrides
```

## Environment Variables

All configuration can be overridden using environment variables with the prefix `MCP_`.

### Format
`MCP_SECTION_SUBSECTION_KEY=value`

### Examples

```bash
# Feature flags
MCP_FEATURES_ENABLEBROWSERTOOLS=false
MCP_FEATURES_ENABLEDEBUGMODE=true

# Server settings
MCP_SERVER_PORT=8080
MCP_SERVER_NAME="custom-server"

# Tool settings
MCP_TOOLS_BROWSER_TIMEOUT=60000
MCP_TOOLS_BROWSER_MAXINSTANCES=5
```

## Feature Flags

Control which tool categories are available:

| Flag | Description | Default |
|------|-------------|---------|
| `enableBrowserTools` | Browser automation tools | `true` |
| `enableFileTools` | File system tools | `false` |
| `enableNetworkTools` | Network tools | `false` |
| `enableDebugMode` | Debug logging and features | `true` in dev |

### Usage

```bash
# Environment variable
MCP_FEATURES_ENABLEBROWSERTOOLS=false node mcpServer.js

# Or in environment config file
// src/config/environments/production.js
module.exports = {
  features: {
    enableBrowserTools: true,
    enableDebugMode: false
  }
};
```

## Tool Configuration

### Browser Tools

```javascript
// src/config/tools/browser.js
module.exports = {
  browser_launch: {
    defaultHeadless: true,
    maxInstances: 10,
    launchTimeout: 30000,
    chromeFlags: [
      '--disable-gpu',
      '--no-sandbox'
    ]
  },
  
  browser_screenshot: {
    defaultQuality: 80,
    maxFileSize: '10MB',
    outputDirectory: './output'
  }
};
```

### Default Tool Settings

Applied to all tools unless overridden:

```javascript
// src/config/tools/default.js
module.exports = {
  timeout: 30000,
  retryAttempts: 3,
  enableInputValidation: true,
  logErrors: true
};
```

## Environment-Specific Configuration

### Development

```javascript
// src/config/environments/development.js
module.exports = {
  features: {
    enableDebugMode: true
  },
  
  tools: {
    browser: {
      browser_launch: {
        defaultHeadless: false, // Show browser UI
        enableScreenshotOnError: true
      }
    }
  },
  
  logging: {
    level: 'debug'
  }
};
```

### Production

```javascript
// src/config/environments/production.js
module.exports = {
  features: {
    enableDebugMode: false
  },
  
  tools: {
    browser: {
      browser_launch: {
        defaultHeadless: true,
        maxInstances: 3 // Conservative limit
      }
    }
  },
  
  logging: {
    level: 'error'
  }
};
```

## Accessing Configuration in Tools

### Basic Access

```javascript
class MyTool extends ToolBase {
  async execute(parameters) {
    // Get tool-specific configuration
    const timeout = this.getConfig('timeout', 30000);
    const retries = this.getConfig('retryAttempts', 3);
    
    // Check feature flags
    if (this.config.isFeatureEnabled('enableDebugMode')) {
      console.error('Debug mode enabled');
    }
    
    // Get global configuration
    const serverPort = this.config.get('server.port');
  }
}
```

### Configuration Hierarchy

Tools receive configuration in this order:
1. Tool-specific config (`tools.browser.browser_launch`)
2. Category config (`tools.browser`)
3. Default config (`tools.default`)

## Advanced Configuration

### Custom Environments

Create custom environment configurations:

```javascript
// src/config/environments/testing.js
module.exports = {
  tools: {
    browser: {
      browser_launch: {
        defaultHeadless: true,
        maxInstances: 1,
        launchTimeout: 10000
      }
    }
  }
};
```

Run with custom environment:
```bash
NODE_ENV=testing node mcpServer.js
```

### Runtime Configuration

Some settings can be modified at runtime:

```javascript
// In your tool
async execute(parameters) {
  // Override default timeout for this execution
  const customTimeout = parameters.timeout || this.getConfig('timeout');
  
  // Use custom timeout
  await this.executeWithTimeout(customTimeout);
}
```

### Configuration Validation

The system validates configuration at startup:

```javascript
// Example validation in tool
constructor() {
  super();
  
  const maxInstances = this.getConfig('maxInstances');
  if (maxInstances > 20) {
    console.warn('maxInstances > 20 may cause performance issues');
  }
}
```

## Configuration Examples

### High-Performance Setup

```bash
NODE_ENV=production \
MCP_TOOLS_BROWSER_MAXINSTANCES=2 \
MCP_TOOLS_BROWSER_LAUNCHTIMEOUT=15000 \
node mcpServer.js
```

### Debug Development

```bash
MCP_FEATURES_ENABLEDEBUGMODE=true \
MCP_LOGGING_LEVEL=debug \
MCP_TOOLS_BROWSER_ENABLESCREENSHOTONERROR=true \
node mcpServer.js
```

### Minimal Setup

```bash
MCP_FEATURES_ENABLEFILETOOLS=false \
MCP_FEATURES_ENABLENETWORKTOOLS=false \
MCP_TOOLS_BROWSER_MAXINSTANCES=1 \
node mcpServer.js
```

## Configuration Reference

### Complete Configuration Schema

```javascript
{
  server: {
    name: 'browser-control-server',
    version: '1.0.0',
    port: 3000
  },
  
  features: {
    enableBrowserTools: true,
    enableFileTools: false,
    enableNetworkTools: false,
    enableDebugMode: true
  },
  
  tools: {
    autoDiscovery: true,
    validationLevel: 'strict',
    
    // Default settings for all tools
    default: {
      timeout: 30000,
      retryAttempts: 3,
      enableInputValidation: true
    },
    
    // Browser tool settings
    browser: {
      browser_launch: {
        defaultHeadless: true,
        maxInstances: 10,
        launchTimeout: 30000
      }
      // ... other browser tools
    }
  },
  
  logging: {
    level: 'debug',
    enableToolDebug: true
  }
}
```

---

*Configuration is loaded at server startup. Restart the server after making changes.*
