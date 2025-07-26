#!/usr/bin/env node

/**
 * CDP Browser Control MCP Server CLI
 * Can be run via npx @cdp-browser-control/mcp-server
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Handle CLI arguments
const args = process.argv.slice(2);
const isHelp = args.includes('--help') || args.includes('-h');
const isVersion = args.includes('--version') || args.includes('-v');

if (isVersion) {
    const packageJson = require('./package.json');
    console.log(`CDP Browser Control MCP Server v${packageJson.version}`);
    process.exit(0);
}

if (isHelp) {
    console.log(`
🚀 CDP Browser Control MCP Server

A comprehensive MCP server for browser automation and API testing.

Usage:
  npx @cdp-browser-control/mcp-server [options]
  cdp-browser-control [options]
  cdp-mcp [options]

Options:
  --help, -h        Show this help
  --version, -v     Show version
  --debug          Enable debug mode
  --port <number>  Set server port

Integration with Claude Desktop:
Add this to ~/Library/Application Support/Claude/claude_desktop_config.json

{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "npx",
      "args": ["@cdp-browser-control/mcp-server"]
    }
  }
}

Or if installed globally:
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "cdp-browser-control"
    }
  }
}

Available Tools: 20
• Browser Automation (17): launch, navigate, click, type, screenshot, pdf, etc.
• API Testing (3): request, session status, HTML reports

GitHub: https://github.com/your-username/cdp-browser-control
`);
    process.exit(0);
}

// Set up environment
const env = { ...process.env };

// Handle debug flag
if (args.includes('--debug')) {
    env.MCP_FEATURES_ENABLEDEBUGMODE = 'true';
    env.NODE_ENV = 'development';
}

// Handle port flag
const portIndex = args.indexOf('--port');
if (portIndex !== -1 && args[portIndex + 1]) {
    env.PORT = args[portIndex + 1];
}

// Ensure output directory exists
const outputDir = env.OUTPUT_DIR || path.join(process.cwd(), 'mcp-output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}
env.OUTPUT_DIR = outputDir;

// Start the MCP server
const serverPath = path.join(__dirname, 'mcpServer.js');
const serverProcess = spawn('node', [serverPath], {
    env,
    stdio: 'inherit'
});

// Handle process cleanup
const cleanup = (signal) => {
    console.error(`\nReceived ${signal}, shutting down gracefully...`);
    serverProcess.kill(signal);
};

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));

serverProcess.on('error', (error) => {
    console.error('Failed to start CDP Browser Control MCP Server:', error.message);
    process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
    if (signal) {
        process.exit(0);
    } else {
        process.exit(code || 0);
    }
});
