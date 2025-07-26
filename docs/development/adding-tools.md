# Developer Guide

A comprehensive guide for extending and contributing to the MCP Browser Control Server.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Adding New Tools](#adding-new-tools)
- [Tool Development Best Practices](#tool-development-best-practices)
- [Configuration System](#configuration-system)
- [Testing](#testing)
- [Contributing](#contributing)

## Architecture Overview

The MCP Browser Control Server follows a modular architecture:

```
src/
├── tools/
│   ├── base/
│   │   ├── ToolBase.js      # Base class for all tools
│   │   └── ToolRegistry.js  # Tool discovery and management
│   ├── browser/             # Browser automation tools
│   └── index.js             # Tool system entry point
├── services/
│   └── browserService.js    # Core browser management
├── config/                  # Configuration management
└── utils/                   # Utility functions
```

### Key Components

1. **ToolBase**: Abstract base class providing common functionality
2. **ToolRegistry**: Manages tool discovery, loading, and execution
3. **Configuration System**: Environment-based configuration management
4. **Browser Service**: Core browser automation functionality

## Adding New Tools

### Step 1: Create Tool File

Create a new file in the appropriate category directory:

```javascript
// src/tools/browser/my-new-tool.js
const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

class MyNewTool extends ToolBase {
    static definition = {
        name: "browser_my_action",
        description: "Performs a custom browser action",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "Browser instance ID" 
                },
                // Add your parameters here
            },
            required: ["browserId"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean" },
                // Add your output fields here
            },
            required: ["success"]
        }
    };

    async execute(parameters) {
        const { browserId } = parameters;
        
        // Your tool implementation here
        
        return { success: true };
    }
}

module.exports = MyNewTool;
```

### Step 2: Tool Discovery

The tool will be automatically discovered and registered when the server starts. No manual registration required!

### Step 3: Add Configuration (Optional)

Add tool-specific configuration in `src/config/tools/`:

```javascript
// src/config/tools/browser.js
module.exports = {
    // ... existing config
    browser_my_action: {
        timeout: 5000,
        retryAttempts: 3,
        customSetting: 'value'
    }
};
```

### Step 4: Access Configuration in Tool

```javascript
async execute(parameters) {
    const timeout = this.getConfig('timeout', 30000);
    const customSetting = this.getConfig('customSetting');
    
    // Use configuration in your tool logic
}
```

## Tool Development Best Practices

### 1. Error Handling

```javascript
async execute(parameters) {
    try {
        // Your logic here
        return result;
    } catch (error) {
        // Provide meaningful error messages
        throw new Error(`Failed to perform action: ${error.message}`);
    }
}
```

### 2. Parameter Validation

Use the JSON schema in the `input_schema` for automatic validation:

```javascript
static definition = {
    input_schema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                pattern: "^https?://", // Regex validation
                description: "Must be a valid HTTP/HTTPS URL"
            },
            timeout: {
                type: "number",
                minimum: 1000,
                maximum: 60000
            }
        }
    }
};
```

### 3. Logging

Use consistent logging patterns:

```javascript
async execute(parameters) {
    const toolName = this.constructor.definition.name;
    const enableDebug = this.config.isFeatureEnabled('enableDebugMode');
    
    if (enableDebug) {
        console.error(`[${toolName}] Starting execution with:, parameters);
    }
    
    // Your logic here
    
    if (enableDebug) {
        console.error(`[${toolName}] Execution completed successfully`);
    }
}
```

### 4. Configuration Usage

```javascript
async execute(parameters) {
    // Get tool-specific config with fallback
    const timeout = this.getConfig('timeout', 30000);
    const retries = this.getConfig('retryAttempts', 3);
    
    // Check feature flags
    if (this.config.isFeatureEnabled('enableDetailedLogging')) {
        // Enhanced logging
    }
}
```

## Configuration System

### Environment-Based Configuration

- `development.js` - Development settings
- `production.js` - Production optimizations
- `server.js` - Server-level settings
- `tools/` - Tool-specific configurations

### Environment Variable Overrides

Override any configuration using environment variables:

```bash
# Feature flags
MCP_FEATURES_ENABLEBROWSERTOOLS=false

# Tool settings
MCP_TOOLS_BROWSER_TIMEOUT=60000

# Server settings
MCP_SERVER_PORT=8080
```

## Testing

### Unit Testing Tools

```javascript
// tests/tools/browser/my-tool.test.js
const MyNewTool = require('../../../src/tools/browser/my-new-tool');

describe('MyNewTool', () => {
    let tool;
    
    beforeEach(() => {
        tool = new MyNewTool();
    });
    
    test('should validate required parameters', async () => {
        await expect(tool.run({})).rejects.toThrow('Missing required parameter');
    });
    
    test('should execute successfully with valid parameters', async () => {
        const result = await tool.run({ browserId: 'test-123' });
        expect(result.content[0].text).toContain('success');
    });
});
```

### Integration Testing

Test tools with actual browser instances in development environment.

## Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/my-new-tool`
3. **Add your tool** following the patterns above
4. **Add tests** for your tool
5. **Update documentation** by running `npm run docs:generate`
6. **Submit a pull request**

### Code Style

- Use descriptive variable names
- Add JSDoc comments for public methods
- Follow existing patterns for consistency
- Use async/await for asynchronous operations

### Commit Messages

- Use conventional commit format: `feat: add new browser tool`
- Include scope when relevant: `feat(browser): add scroll tool`
- Use present tense: "add" not "added"

---

*Generated automatically from tool definitions and code analysis*
