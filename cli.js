#!/usr/bin/env node

/**
 * Democratize Quality MCP Server CLI
 * Can be run via npx @democratize-quality/mcp-server
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Handle CLI arguments
const args = process.argv.slice(2);
const isHelp = args.includes('--help') || args.includes('-h');
const isVersion = args.includes('--version') || args.includes('-v');

if (isVersion) {
    const packageJson = require('./package.json');
    console.log(`Democratize Quality MCP Server v${packageJson.version}`);
    process.exit(0);
}

if (isHelp) {
    console.log(`
🎯 Democratize Quality MCP Server

A comprehensive MCP server for democratizing quality through browser automation and API testing.

Usage:
  npx @democratize-quality/mcp-server [options]
  democratize-quality-mcp [options]
  dq-mcp-server [options]

Options:
  --help, -h                Show this help
  --version, -v             Show version
  --debug                   Enable debug mode
  --port <number>           Set server port
  --env <environment>       Set environment (development|production|api-only)
  
Tool Category Options:
  --api-only                Enable only API tools (shortcut for api-only environment)
  --browser-only            Enable only browser tools
  --no-api                  Disable API tools
  --no-browser              Disable browser tools
  --no-advanced             Disable advanced browser tools
  --enable-all              Enable all tool categories (default in development)

Environment Variables:
  MCP_FEATURES_ENABLEAPITOOLS=true/false        Enable/disable API tools
  MCP_FEATURES_ENABLEBROWSERTOOLS=true/false    Enable/disable browser tools
  MCP_FEATURES_ENABLEADVANCEDTOOLS=true/false   Enable/disable advanced tools
  NODE_ENV=api-only                             Use API-only configuration

Integration with Claude Desktop:
Add this to ~/Library/Application Support/Claude/claude_desktop_config.json

{
  "mcpServers": {
    "democratize-quality": {
      "command": "npx",
      "args": ["@democratize-quality/mcp-server"]
    }
  }
}

Or if installed globally:
{
  "mcpServers": {
    "democratize-quality": {
      "command": "democratize-quality-mcp"
    }
  }
}

Available Tools: 20
• Browser Automation (17): launch, navigate, click, type, screenshot, pdf, etc.
• API Testing (3): request, session status, HTML reports

GitHub: https://github.com/democratize-quality/mcp-server
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

// Handle environment flag
const envIndex = args.indexOf('--env');
if (envIndex !== -1 && args[envIndex + 1]) {
    env.NODE_ENV = args[envIndex + 1];
}

// Handle tool category flags
if (args.includes('--api-only')) {
    env.NODE_ENV = 'api-only';
} else if (args.includes('--browser-only')) {
    env.MCP_FEATURES_ENABLEAPITOOLS = 'false';
    env.MCP_FEATURES_ENABLEBROWSERTOOLS = 'true';
    env.MCP_FEATURES_ENABLEADVANCEDTOOLS = 'true';
    env.MCP_FEATURES_ENABLEFILETOOLS = 'false';
    env.MCP_FEATURES_ENABLENETWORKTOOLS = 'false';
    env.MCP_FEATURES_ENABLEOTHERTOOLS = 'false';
} else if (args.includes('--enable-all')) {
    env.MCP_FEATURES_ENABLEAPITOOLS = 'true';
    env.MCP_FEATURES_ENABLEBROWSERTOOLS = 'true';
    env.MCP_FEATURES_ENABLEADVANCEDTOOLS = 'true';
    env.MCP_FEATURES_ENABLEFILETOOLS = 'true';
    env.MCP_FEATURES_ENABLENETWORKTOOLS = 'true';
    env.MCP_FEATURES_ENABLEOTHERTOOLS = 'true';
}

// Handle individual tool category disable flags
if (args.includes('--no-api')) {
    env.MCP_FEATURES_ENABLEAPITOOLS = 'false';
}
if (args.includes('--no-browser')) {
    env.MCP_FEATURES_ENABLEBROWSERTOOLS = 'false';
}
if (args.includes('--no-advanced')) {
    env.MCP_FEATURES_ENABLEADVANCEDTOOLS = 'false';
}

// Handle port flag
const portIndex = args.indexOf('--port');
if (portIndex !== -1 && args[portIndex + 1]) {
    env.PORT = args[portIndex + 1];
}

// Ensure output directory exists
// When run via npx/Claude, process.cwd() might be root, so use home directory or temp
const defaultOutputDir = env.HOME 
    ? path.join(env.HOME, '.mcp-browser-control') 
    : path.join(os.tmpdir(), 'mcp-browser-control');
    
const outputDir = env.OUTPUT_DIR || defaultOutputDir;
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}
env.OUTPUT_DIR = outputDir;

// Debug output (if enabled)
if (args.includes('--debug')) {
    console.error(`📁 Output directory: ${outputDir}`);
    console.error(`🏠 Working directory: ${process.cwd()}`);
    console.error(`🌍 Environment: ${env.NODE_ENV || 'development'}`);
    console.error(`🔧 Tool Categories:`);
    console.error(`   API Tools: ${env.MCP_FEATURES_ENABLEAPITOOLS || 'default'}`);
    console.error(`   Browser Tools: ${env.MCP_FEATURES_ENABLEBROWSERTOOLS || 'default'}`);
    console.error(`   Advanced Tools: ${env.MCP_FEATURES_ENABLEADVANCEDTOOLS || 'default'}`);
}

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
