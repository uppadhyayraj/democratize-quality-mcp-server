#!/usr/bin/env node

/**
 * Documentation Generator for MCP Browser Control Server
 * Automatically generates markdown documentation from tool definitions and configurations
 */

const fs = require('fs');
const path = require('path');

class DocumentationGenerator {
    constructor() {
        this.toolsDir = path.join(__dirname, '../src/tools');
        this.docsDir = path.join(__dirname, '../docs');
        this.config = require('../src/config');
        
        // Ensure docs directory exists
        this.ensureDirectory(this.docsDir);
        this.ensureDirectory(path.join(this.docsDir, 'api'));
        this.ensureDirectory(path.join(this.docsDir, 'development'));
        this.ensureDirectory(path.join(this.docsDir, 'examples'));
    }

    /**
     * Ensure directory exists
     * @param {string} dirPath - Directory path
     */
    ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`);
        }
    }

    /**
     * Generate all documentation
     */
    async generateAll() {
        console.log('📚 Generating documentation...');
        
        try {
            // Discover and load tools
            const tools = await this.discoverTools();
            
            // Generate different types of documentation
            await this.generateToolReference(tools);
            await this.generateDeveloperGuide();
            await this.generateGettingStarted();
            await this.generateConfigurationGuide();
            await this.generateMainReadme();
            await this.generateExamples(tools);
            
            console.log('✅ Documentation generation complete!');
            console.log(`📂 Documentation available in: ${this.docsDir}`);
            
        } catch (error) {
            console.error('❌ Error generating documentation:', error.message);
            process.exit(1);
        }
    }

    /**
     * Discover and load all tools
     * @returns {Array} Array of tool information
     */
    async discoverTools() {
        const tools = [];
        await this.scanForTools(this.toolsDir, tools);
        return tools.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Recursively scan for tool files
     * @param {string} dir - Directory to scan
     * @param {Array} tools - Array to populate with tool info
     */
    async scanForTools(dir, tools) {
        if (!fs.existsSync(dir)) return;

        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory() && item !== 'base') {
                await this.scanForTools(itemPath, tools);
            } else if (stat.isFile() && item.endsWith('.js') && !item.startsWith('index')) {
                try {
                    const ToolClass = require(itemPath);
                    if (ToolClass && ToolClass.definition) {
                        const category = this.getToolCategory(ToolClass.definition.name);
                        tools.push({
                            ...ToolClass.definition,
                            category: category,
                            filePath: itemPath
                        });
                    }
                } catch (error) {
                    console.warn(`⚠️  Could not load tool from ${itemPath}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Get tool category from tool name
     * @param {string} toolName - The tool name
     * @returns {string} - The tool category
     */
    getToolCategory(toolName) {
        if (toolName.startsWith('browser_')) return 'Browser';
        if (toolName.startsWith('file_')) return 'File';
        if (toolName.startsWith('network_')) return 'Network';
        return 'Other';
    }

    /**
     * Generate tool reference documentation
     * @param {Array} tools - Array of tool information
     */
    async generateToolReference(tools) {
        console.log('📖 Generating tool reference...');
        
        const categories = this.groupToolsByCategory(tools);
        let content = this.generateHeader('Tool Reference', 'Complete reference for all available tools');
        
        // Table of Contents
        content += '\n## Table of Contents\n\n';
        for (const [category, categoryTools] of Object.entries(categories)) {
            content += `- [${category} Tools](#${category.toLowerCase()}-tools)\n`;
            for (const tool of categoryTools) {
                content += `  - [${tool.name}](#${tool.name.replace(/_/g, '-')})\n`;
            }
        }
        
        // Tool documentation by category
        for (const [category, categoryTools] of Object.entries(categories)) {
            content += `\n## ${category} Tools\n\n`;
            content += `Tools for ${category.toLowerCase()} automation and control.\n\n`;
            
            for (const tool of categoryTools) {
                content += this.generateToolDocumentation(tool);
            }
        }
        
        // Feature flags section
        content += this.generateFeatureFlagsSection();
        
        await this.writeFile(path.join(this.docsDir, 'api', 'tool-reference.md'), content);
    }

    /**
     * Group tools by category
     * @param {Array} tools - Array of tools
     * @returns {Object} - Tools grouped by category
     */
    groupToolsByCategory(tools) {
        const categories = {};
        for (const tool of tools) {
            const category = tool.category;
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(tool);
        }
        return categories;
    }

    /**
     * Generate documentation for a single tool
     * @param {Object} tool - Tool information
     * @returns {string} - Markdown documentation
     */
    generateToolDocumentation(tool) {
        let content = `### ${tool.name}\n\n`;
        content += `**Description:** ${tool.description}\n\n`;
        
        // Input schema
        content += '#### Input Parameters\n\n';
        if (tool.input_schema && tool.input_schema.properties) {
            content += '| Parameter | Type | Required | Description |\n';
            content += '|-----------|------|----------|-------------|\n';
            
            const required = tool.input_schema.required || [];
            for (const [param, schema] of Object.entries(tool.input_schema.properties)) {
                const isRequired = required.includes(param) ? '✅' : '❌';
                const type = schema.type || 'unknown';
                const description = schema.description || 'No description';
                content += `| \`${param}\` | ${type} | ${isRequired} | ${description} |\n`;
            }
        } else {
            content += 'No input parameters.\n';
        }
        
        // Output schema
        content += '\n#### Output\n\n';
        if (tool.output_schema && tool.output_schema.properties) {
            content += '| Field | Type | Description |\n';
            content += '|-------|------|-------------|\n';
            
            for (const [field, schema] of Object.entries(tool.output_schema.properties)) {
                const type = schema.type || 'unknown';
                const description = schema.description || 'No description';
                content += `| \`${field}\` | ${type} | ${description} |\n`;
            }
        } else {
            content += 'Returns standard MCP response format.\n';
        }
        
        // Example usage
        content += '\n#### Example Usage\n\n';
        content += this.generateExampleUsage(tool);
        
        content += '\n---\n\n';
        return content;
    }

    /**
     * Generate example usage for a tool
     * @param {Object} tool - Tool information
     * @returns {string} - Example usage markdown
     */
    generateExampleUsage(tool) {
        const examples = this.getToolExamples(tool);
        let content = '';
        
        for (const example of examples) {
            content += '```json\n';
            content += JSON.stringify({
                tool: tool.name,
                parameters: example.parameters
            }, null, 2);
            content += '\n```\n\n';
            
            if (example.description) {
                content += `*${example.description}*\n\n`;
            }
        }
        
        return content;
    }

    /**
     * Get example parameters for a tool
     * @param {Object} tool - Tool information
     * @returns {Array} - Array of examples
     */
    getToolExamples(tool) {
        const examples = {
            'browser_launch': [
                {
                    parameters: { headless: true },
                    description: 'Launch a headless browser instance'
                },
                {
                    parameters: { headless: false, userDataDir: './my_profile' },
                    description: 'Launch browser with custom profile for authenticated sessions'
                }
            ],
            'browser_navigate': [
                {
                    parameters: { browserId: 'browser-123', url: 'https://example.com' },
                    description: 'Navigate to a website'
                }
            ],
            'browser_screenshot': [
                {
                    parameters: { browserId: 'browser-123', fileName: 'page-capture.png' },
                    description: 'Take a screenshot and save it'
                }
            ],
            'browser_click': [
                {
                    parameters: { 
                        browserId: 'browser-123', 
                        locator: { type: 'css', value: '#submit-button' } 
                    },
                    description: 'Click a button using CSS selector'
                }
            ],
            'browser_type': [
                {
                    parameters: { 
                        browserId: 'browser-123', 
                        locator: { type: 'css', value: '#email-input' },
                        text: 'user@example.com'
                    },
                    description: 'Type text into an input field'
                }
            ]
        };
        
        return examples[tool.name] || [
            {
                parameters: this.generateDefaultParameters(tool),
                description: 'Basic usage example'
            }
        ];
    }

    /**
     * Generate default parameters for a tool based on its schema
     * @param {Object} tool - Tool information
     * @returns {Object} - Default parameters
     */
    generateDefaultParameters(tool) {
        const params = {};
        if (!tool.input_schema || !tool.input_schema.properties) return params;
        
        const required = tool.input_schema.required || [];
        for (const param of required) {
            const schema = tool.input_schema.properties[param];
            params[param] = this.getDefaultValue(schema);
        }
        
        return params;
    }

    /**
     * Get default value for a schema type
     * @param {Object} schema - JSON schema
     * @returns {any} - Default value
     */
    getDefaultValue(schema) {
        switch (schema.type) {
            case 'string': return 'example';
            case 'number': return 123;
            case 'boolean': return true;
            case 'object': return {};
            case 'array': return [];
            default: return null;
        }
    }

    /**
     * Generate feature flags section
     * @returns {string} - Feature flags documentation
     */
    generateFeatureFlagsSection() {
        let content = '\n## Feature Flags\n\n';
        content += 'Tools can be enabled or disabled using feature flags:\n\n';
        
        content += '| Feature Flag | Environment Variable | Description |\n';
        content += '|--------------|---------------------|-------------|\n';
        content += '| `enableBrowserTools` | `MCP_FEATURES_ENABLEBROWSERTOOLS` | Enable/disable all browser automation tools |\n';
        content += '| `enableFileTools` | `MCP_FEATURES_ENABLEFILETOOLS` | Enable/disable file system tools |\n';
        content += '| `enableNetworkTools` | `MCP_FEATURES_ENABLENETWORKTOOLS` | Enable/disable network tools |\n';
        content += '| `enableDebugMode` | `MCP_FEATURES_ENABLEDEBUGMODE` | Enable/disable debug mode |\n\n';
        
        content += '### Usage Examples\n\n';
        content += '```bash\n';
        content += '# Disable browser tools\n';
        content += 'MCP_FEATURES_ENABLEBROWSERTOOLS=false node mcpServer.js\n\n';
        content += '# Run in production mode\n';
        content += 'NODE_ENV=production node mcpServer.js\n\n';
        content += '# Enable debug mode\n';
        content += 'MCP_FEATURES_ENABLEDEBUGMODE=true node mcpServer.js\n';
        content += '```\n\n';
        
        return content;
    }

    /**
     * Generate header for markdown files
     * @param {string} title - Document title
     * @param {string} description - Document description
     * @returns {string} - Markdown header
     */
    generateHeader(title, description) {
        return `# ${title}\n\n${description}\n\n---\n`;
    }

    /**
     * Write content to file
     * @param {string} filePath - File path
     * @param {string} content - Content to write
     */
    async writeFile(filePath, content) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Generated: ${path.relative(process.cwd(), filePath)}`);
    }

    /**
     * Generate developer guide
     */
    async generateDeveloperGuide() {
        console.log('👨‍💻 Generating developer guide...');
        
        const content = `# Developer Guide

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

\`\`\`
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
\`\`\`

### Key Components

1. **ToolBase**: Abstract base class providing common functionality
2. **ToolRegistry**: Manages tool discovery, loading, and execution
3. **Configuration System**: Environment-based configuration management
4. **Browser Service**: Core browser automation functionality

## Adding New Tools

### Step 1: Create Tool File

Create a new file in the appropriate category directory:

\`\`\`javascript
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
\`\`\`

### Step 2: Tool Discovery

The tool will be automatically discovered and registered when the server starts. No manual registration required!

### Step 3: Add Configuration (Optional)

Add tool-specific configuration in \`src/config/tools/\`:

\`\`\`javascript
// src/config/tools/browser.js
module.exports = {
    // ... existing config
    browser_my_action: {
        timeout: 5000,
        retryAttempts: 3,
        customSetting: 'value'
    }
};
\`\`\`

### Step 4: Access Configuration in Tool

\`\`\`javascript
async execute(parameters) {
    const timeout = this.getConfig('timeout', 30000);
    const customSetting = this.getConfig('customSetting');
    
    // Use configuration in your tool logic
}
\`\`\`

## Tool Development Best Practices

### 1. Error Handling

\`\`\`javascript
async execute(parameters) {
    try {
        // Your logic here
        return result;
    } catch (error) {
        // Provide meaningful error messages
        throw new Error(\`Failed to perform action: \${error.message}\`);
    }
}
\`\`\`

### 2. Parameter Validation

Use the JSON schema in the \`input_schema\` for automatic validation:

\`\`\`javascript
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
\`\`\`

### 3. Logging

Use consistent logging patterns:

\`\`\`javascript
async execute(parameters) {
    const toolName = this.constructor.definition.name;
    const enableDebug = this.config.isFeatureEnabled('enableDebugMode');
    
    if (enableDebug) {
        console.error(\`[\${toolName}] Starting execution with:, parameters);
    }
    
    // Your logic here
    
    if (enableDebug) {
        console.error(\`[\${toolName}] Execution completed successfully\`);
    }
}
\`\`\`

### 4. Configuration Usage

\`\`\`javascript
async execute(parameters) {
    // Get tool-specific config with fallback
    const timeout = this.getConfig('timeout', 30000);
    const retries = this.getConfig('retryAttempts', 3);
    
    // Check feature flags
    if (this.config.isFeatureEnabled('enableDetailedLogging')) {
        // Enhanced logging
    }
}
\`\`\`

## Configuration System

### Environment-Based Configuration

- \`development.js\` - Development settings
- \`production.js\` - Production optimizations
- \`server.js\` - Server-level settings
- \`tools/\` - Tool-specific configurations

### Environment Variable Overrides

Override any configuration using environment variables:

\`\`\`bash
# Feature flags
MCP_FEATURES_ENABLEBROWSERTOOLS=false

# Tool settings
MCP_TOOLS_BROWSER_TIMEOUT=60000

# Server settings
MCP_SERVER_PORT=8080
\`\`\`

## Testing

### Unit Testing Tools

\`\`\`javascript
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
\`\`\`

### Integration Testing

Test tools with actual browser instances in development environment.

## Contributing

1. **Fork the repository**
2. **Create a feature branch**: \`git checkout -b feature/my-new-tool\`
3. **Add your tool** following the patterns above
4. **Add tests** for your tool
5. **Update documentation** by running \`npm run docs:generate\`
6. **Submit a pull request**

### Code Style

- Use descriptive variable names
- Add JSDoc comments for public methods
- Follow existing patterns for consistency
- Use async/await for asynchronous operations

### Commit Messages

- Use conventional commit format: \`feat: add new browser tool\`
- Include scope when relevant: \`feat(browser): add scroll tool\`
- Use present tense: "add" not "added"

---

*Generated automatically from tool definitions and code analysis*
`;
        
        await this.writeFile(path.join(this.docsDir, 'development', 'adding-tools.md'), content);
    }

    /**
     * Generate getting started guide
     */
    async generateGettingStarted() {
        console.log('🚀 Generating getting started guide...');
        
        const content = `# Getting Started

Quick start guide for the MCP Browser Control Server.

---

## Installation

### Prerequisites

- Node.js 18+ 
- Chrome/Chromium browser
- Git

### Clone and Setup

\`\`\`bash
git clone <repository-url>
cd cdp-browser-control
npm install
\`\`\`

## Basic Usage

### 1. Start the Server

\`\`\`bash
node mcpServer.js
\`\`\`

The server will start and display available tools:

\`\`\`
[Tools] Tool system initialized successfully:
[Tools] - Total tools: 7
[Tools] - Available tools: browser_launch, browser_navigate, browser_screenshot, ...
\`\`\`

### 2. Connect an MCP Client

The server communicates via JSON-RPC over stdin/stdout. Example client integration:

\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
\`\`\`

### 3. Basic Browser Automation

Here's a complete example of launching a browser, navigating to a page, and taking a screenshot:

\`\`\`json
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
\`\`\`

## Configuration

### Environment Modes

**Development Mode** (default):
- Shows browser UI
- Detailed logging
- Debug features enabled

**Production Mode**:
\`\`\`bash
NODE_ENV=production node mcpServer.js
\`\`\`
- Headless browsers only
- Minimal logging
- Optimized performance

### Feature Flags

Disable specific tool categories:

\`\`\`bash
# Disable browser tools
MCP_FEATURES_ENABLEBROWSERTOOLS=false node mcpServer.js

# Run with only specific tools
MCP_FEATURES_ENABLEFILETOOLS=false \\
MCP_FEATURES_ENABLENETWORKTOOLS=false \\
node mcpServer.js
\`\`\`

### Custom Configuration

Create environment-specific configs in \`src/config/environments/\`:

\`\`\`javascript
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
\`\`\`

Run with custom environment:
\`\`\`bash
NODE_ENV=testing node mcpServer.js
\`\`\`

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
- Try running with \`--no-sandbox\` flag

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
\`\`\`bash
MCP_FEATURES_ENABLEDEBUGMODE=true node mcpServer.js
\`\`\`

### Logs Location

- Server logs: stderr output
- Screenshots: \`./output/\` directory
- Browser data: Temporary profiles in system temp

## Next Steps

- [Tool Reference](api/tool-reference.md) - Complete tool documentation
- [Developer Guide](development/adding-tools.md) - Extend the server
- [Configuration Guide](development/configuration.md) - Advanced configuration
- [Examples](examples/) - Real-world usage examples

---

*For more help, check the documentation or open an issue on GitHub.*
`;
        
        await this.writeFile(path.join(this.docsDir, 'getting-started.md'), content);
    }

    /**
     * Generate configuration guide
     */
    async generateConfigurationGuide() {
        console.log('⚙️  Generating configuration guide...');
        
        const content = `# Configuration Guide

Comprehensive guide to configuring the MCP Browser Control Server.

---

## Configuration Structure

The configuration system supports multiple sources with clear precedence:

1. **Environment Variables** (highest precedence)
2. **Environment-specific files** (\`environments/\`)
3. **Tool-specific files** (\`tools/\`)
4. **Default configuration** (lowest precedence)

\`\`\`
src/config/
├── index.js                 # Configuration manager
├── server.js                # Server settings
├── tools/
│   ├── default.js          # Default tool settings
│   └── browser.js          # Browser tool settings
└── environments/
    ├── development.js      # Development overrides
    └── production.js       # Production overrides
\`\`\`

## Environment Variables

All configuration can be overridden using environment variables with the prefix \`MCP_\`.

### Format
\`MCP_SECTION_SUBSECTION_KEY=value\`

### Examples

\`\`\`bash
# Feature flags
MCP_FEATURES_ENABLEBROWSERTOOLS=false
MCP_FEATURES_ENABLEDEBUGMODE=true

# Server settings
MCP_SERVER_PORT=8080
MCP_SERVER_NAME="custom-server"

# Tool settings
MCP_TOOLS_BROWSER_TIMEOUT=60000
MCP_TOOLS_BROWSER_MAXINSTANCES=5
\`\`\`

## Feature Flags

Control which tool categories are available:

| Flag | Description | Default |
|------|-------------|---------|
| \`enableBrowserTools\` | Browser automation tools | \`true\` |
| \`enableFileTools\` | File system tools | \`false\` |
| \`enableNetworkTools\` | Network tools | \`false\` |
| \`enableDebugMode\` | Debug logging and features | \`true\` in dev |

### Usage

\`\`\`bash
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
\`\`\`

## Tool Configuration

### Browser Tools

\`\`\`javascript
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
\`\`\`

### Default Tool Settings

Applied to all tools unless overridden:

\`\`\`javascript
// src/config/tools/default.js
module.exports = {
  timeout: 30000,
  retryAttempts: 3,
  enableInputValidation: true,
  logErrors: true
};
\`\`\`

## Environment-Specific Configuration

### Development

\`\`\`javascript
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
\`\`\`

### Production

\`\`\`javascript
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
\`\`\`

## Accessing Configuration in Tools

### Basic Access

\`\`\`javascript
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
\`\`\`

### Configuration Hierarchy

Tools receive configuration in this order:
1. Tool-specific config (\`tools.browser.browser_launch\`)
2. Category config (\`tools.browser\`)
3. Default config (\`tools.default\`)

## Advanced Configuration

### Custom Environments

Create custom environment configurations:

\`\`\`javascript
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
\`\`\`

Run with custom environment:
\`\`\`bash
NODE_ENV=testing node mcpServer.js
\`\`\`

### Runtime Configuration

Some settings can be modified at runtime:

\`\`\`javascript
// In your tool
async execute(parameters) {
  // Override default timeout for this execution
  const customTimeout = parameters.timeout || this.getConfig('timeout');
  
  // Use custom timeout
  await this.executeWithTimeout(customTimeout);
}
\`\`\`

### Configuration Validation

The system validates configuration at startup:

\`\`\`javascript
// Example validation in tool
constructor() {
  super();
  
  const maxInstances = this.getConfig('maxInstances');
  if (maxInstances > 20) {
    console.warn('maxInstances > 20 may cause performance issues');
  }
}
\`\`\`

## Configuration Examples

### High-Performance Setup

\`\`\`bash
NODE_ENV=production \\
MCP_TOOLS_BROWSER_MAXINSTANCES=2 \\
MCP_TOOLS_BROWSER_LAUNCHTIMEOUT=15000 \\
node mcpServer.js
\`\`\`

### Debug Development

\`\`\`bash
MCP_FEATURES_ENABLEDEBUGMODE=true \\
MCP_LOGGING_LEVEL=debug \\
MCP_TOOLS_BROWSER_ENABLESCREENSHOTONERROR=true \\
node mcpServer.js
\`\`\`

### Minimal Setup

\`\`\`bash
MCP_FEATURES_ENABLEFILETOOLS=false \\
MCP_FEATURES_ENABLENETWORKTOOLS=false \\
MCP_TOOLS_BROWSER_MAXINSTANCES=1 \\
node mcpServer.js
\`\`\`

## Configuration Reference

### Complete Configuration Schema

\`\`\`javascript
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
\`\`\`

---

*Configuration is loaded at server startup. Restart the server after making changes.*
`;
        
        await this.writeFile(path.join(this.docsDir, 'development', 'configuration.md'), content);
    }

    /**
     * Generate main README
     */
    async generateMainReadme() {
        console.log('📄 Generating main README...');
        
        const content = `# MCP Browser Control Server

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
\`\`\`bash
git clone <repository-url>
cd cdp-browser-control
npm install
\`\`\`

## 🎯 Quick Start

### Start the Server
\`\`\`bash
node mcpServer.js
\`\`\`

### Available Tools
- \`browser_launch\` - Launch browser instances
- \`browser_navigate\` - Navigate to web pages
- \`browser_click\` - Click page elements
- \`browser_type\` - Type text into inputs
- \`browser_screenshot\` - Capture page screenshots
- \`browser_dom\` - Extract page content
- \`browser_close\` - Close browser instances

### Basic Usage Example
\`\`\`json
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
\`\`\`

## ⚙️ Configuration

### Environment Modes
\`\`\`bash
# Development (shows browser UI)
node mcpServer.js

# Production (headless mode)
NODE_ENV=production node mcpServer.js
\`\`\`

### Feature Flags
\`\`\`bash
# Disable browser tools
MCP_FEATURES_ENABLEBROWSERTOOLS=false node mcpServer.js

# Enable debug mode
MCP_FEATURES_ENABLEDEBUGMODE=true node mcpServer.js
\`\`\`

## 📚 Documentation

- [📖 Getting Started](docs/getting-started.md) - Quick start guide
- [🔧 Tool Reference](docs/api/tool-reference.md) - Complete tool documentation
- [👨‍💻 Developer Guide](docs/development/adding-tools.md) - Extending the server
- [⚙️ Configuration](docs/development/configuration.md) - Advanced configuration
- [💡 Examples](docs/examples/) - Real-world usage examples

## 🏗️ Architecture

\`\`\`
src/
├── tools/          # Modular tool system
├── services/       # Core browser management
├── config/         # Configuration management
└── utils/          # Utility functions
\`\`\`

### Key Features
- **Automatic Tool Discovery**: Tools are automatically loaded and registered
- **Configuration System**: Environment-based configuration with overrides
- **Error Handling**: Comprehensive error handling and validation
- **Feature Flags**: Control tool availability at runtime

## 🔧 Development

### Adding New Tools
1. Create tool file in \`src/tools/{category}/\`
2. Extend \`ToolBase\` class
3. Define tool schema and implementation
4. Tools are automatically discovered!

### Example Tool
\`\`\`javascript
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
\`\`\`

## 🧪 Testing

\`\`\`bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
\`\`\`

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
`;
        
        await this.writeFile(path.join(this.docsDir, '..', 'README.md'), content);
    }

    /**
     * Generate examples
     */
    async generateExamples(tools) {
        console.log('💡 Generating examples...');
        
        // Basic automation example
        const basicExample = `# Basic Browser Automation

This example demonstrates basic browser automation tasks.

## Complete Workflow

\`\`\`json
// 1. Launch browser
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "browser_launch",
    "arguments": {
      "headless": true,
      "userDataDir": "./browser-session"
    }
  }
}

// Response: { "browserId": "browser-abc123", "port": 9222 }

// 2. Navigate to page
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "browserId": "browser-abc123",
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
      "browserId": "browser-abc123",
      "fileName": "homepage.png"
    }
  }
}

// 4. Extract page content
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "browser_dom",
    "arguments": {
      "browserId": "browser-abc123"
    }
  }
}

// 5. Close browser
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "browser_close",
    "arguments": {
      "browserId": "browser-abc123"
    }
  }
}
\`\`\`

## Error Handling

Always handle errors appropriately:

\`\`\`json
// If a tool call fails, you'll receive an error response:
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Tool 'browser_navigate' execution failed: Browser instance 'invalid-id' not found",
    "data": {
      "tool_name": "browser_navigate",
      "original_error": "Browser instance 'invalid-id' not found"
    }
  }
}
\`\`\`

## Best Practices

1. **Always close browsers** when done to free resources
2. **Use persistent profiles** for authenticated sessions
3. **Handle errors gracefully** with retry logic
4. **Take screenshots** for debugging and verification
5. **Use meaningful file names** for screenshots
`;

        await this.writeFile(path.join(this.docsDir, 'examples', 'basic-automation.md'), basicExample);

        // Authentication example
        const authExample = `# Authentication and Sessions

This example shows how to handle login flows and maintain authenticated sessions.

## Persistent Browser Profile

Use a persistent profile to maintain login sessions:

\`\`\`json
// Launch with persistent profile
{
  "method": "tools/call",
  "params": {
    "name": "browser_launch",
    "arguments": {
      "headless": false,
      "userDataDir": "./auth-session"
    }
  }
}
\`\`\`

## Login Workflow

\`\`\`json
// 1. Navigate to login page
{
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "browserId": "browser-123",
      "url": "https://example.com/login"
    }
  }
}

// 2. Fill username
{
  "method": "tools/call",
  "params": {
    "name": "browser_type",
    "arguments": {
      "browserId": "browser-123",
      "locator": { "type": "css", "value": "#username" },
      "text": "your-username"
    }
  }
}

// 3. Fill password
{
  "method": "tools/call",
  "params": {
    "name": "browser_type",
    "arguments": {
      "browserId": "browser-123",
      "locator": { "type": "css", "value": "#password" },
      "text": "your-password"
    }
  }
}

// 4. Click login button
{
  "method": "tools/call",
  "params": {
    "name": "browser_click",
    "arguments": {
      "browserId": "browser-123",
      "locator": { "type": "css", "value": "#login-button" }
    }
  }
}

// 5. Take screenshot to verify login
{
  "method": "tools/call",
  "params": {
    "name": "browser_screenshot",
    "arguments": {
      "browserId": "browser-123",
      "fileName": "after-login.png"
    }
  }
}
\`\`\`

## Session Reuse

Once authenticated, the session is preserved:

\`\`\`json
// Later session - reuse the same profile
{
  "method": "tools/call",
  "params": {
    "name": "browser_launch",
    "arguments": {
      "headless": true,
      "userDataDir": "./auth-session"
    }
  }
}

// Navigate to protected page (already authenticated)
{
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "browserId": "browser-456",
      "url": "https://example.com/dashboard"
    }
  }
}
\`\`\`

## Tips

- Use non-headless mode for initial login setup
- Keep the userDataDir consistent across sessions
- Take screenshots to verify authentication state
- Handle 2FA and captcha challenges manually when needed
`;

        await this.writeFile(path.join(this.docsDir, 'examples', 'authentication.md'), authExample);
    }
}

// Main execution
if (require.main === module) {
    const generator = new DocumentationGenerator();
    generator.generateAll().catch(console.error);
}

module.exports = DocumentationGenerator;
