#!/usr/bin/env node

/**
 * MCP Server Startup Script
 * Provides easy configuration and startup options
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    debug: args.includes('--debug') || args.includes('-d'),
    production: args.includes('--production') || args.includes('-p'),
    help: args.includes('--help') || args.includes('-h')
};

if (options.help) {
    console.log(`
🚀 CDP Browser Control MCP Server

Usage: npm run server [options]
   or: node run-server.js [options]

Options:
  --debug, -d       Enable debug mode with verbose logging
  --production, -p  Run in production mode
  --help, -h        Show this help message

Environment Variables:
  NODE_ENV         Set environment (development/production)
  OUTPUT_DIR       Directory for screenshots, PDFs, reports
  PORT             Server port (default: 3000)

Integration Examples:

1. Claude Desktop (add to claude_desktop_config.json):
{
  "mcpServers": {
    "cdp-browser-control": {
      "command": "node",
      "args": ["${path.join(__dirname, 'mcpServer.js')}"]
    }
  }
}

2. MCP Inspector (for testing):
npx @modelcontextprotocol/inspector node mcpServer.js

3. Direct STDIO communication:
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcpServer.js

Available Tools: 20 total
- Browser Tools (17): automation, interaction, content capture
- API Tools (3): HTTP testing, session management, reporting

Repository: https://github.com/your-username/cdp-browser-control
`);
    process.exit(0);
}

// Set environment variables
const env = { ...process.env };

if (options.debug) {
    env.MCP_FEATURES_ENABLEDEBUGMODE = 'true';
    env.NODE_ENV = 'development';
    console.log('🐛 Debug mode enabled');
}

if (options.production) {
    env.NODE_ENV = 'production';
    console.log('🏭 Production mode enabled');
}

if (!env.OUTPUT_DIR) {
    env.OUTPUT_DIR = path.join(__dirname, 'output');
}

// Ensure output directory exists
const fs = require('fs');
if (!fs.existsSync(env.OUTPUT_DIR)) {
    fs.mkdirSync(env.OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${env.OUTPUT_DIR}`);
}

console.log(`
🚀 Starting CDP Browser Control MCP Server

📊 Configuration:
   Environment: ${env.NODE_ENV || 'development'}
   Debug Mode:  ${env.MCP_FEATURES_ENABLEDEBUGMODE || 'false'}
   Output Dir:  ${env.OUTPUT_DIR}

🔧 Available Tools: 20
   Browser Automation: 17 tools
   API Testing:        3 tools

🔗 Integration ready for:
   • Claude Desktop
   • MCP Inspector  
   • Custom MCP clients

💡 Use --help for integration examples
`);

// Start the server
const serverPath = path.join(__dirname, 'mcpServer.js');
const serverProcess = spawn('node', [serverPath], {
    env,
    stdio: 'inherit'
});

// Handle process events
serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
    if (signal) {
        console.log(`\n👋 Server stopped by signal: ${signal}`);
    } else if (code !== 0) {
        console.error(`❌ Server exited with code: ${code}`);
        process.exit(code);
    } else {
        console.log('\n👋 Server stopped gracefully');
    }
});

// Forward signals to server
process.on('SIGINT', () => {
    console.log('\n⏹️  Stopping server...');
    serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
});
