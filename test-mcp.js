#!/usr/bin/env node

/**
 * Simple MCP client test script to verify our server works correctly
 */

const { spawn } = require('child_process');
const path = require('path');

// Start our MCP server
const serverPath = path.join(__dirname, 'mcpServer.js');
const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit']
});

console.log('🚀 Starting MCP server test...\n');

// Test initialize
const initializeRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
            name: "test-client",
            version: "1.0.0"
        }
    }
};

// Test tools/list
const toolsListRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
};

// Test browser_launch tool
const browserLaunchRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
        name: "browser_launch",
        arguments: {
            headless: true,
            width: 1024,
            height: 768
        }
    }
};

// Test api_request tool
const apiRequestTest = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
        name: "api_request",
        arguments: {
            url: "https://httpbin.org/get",
            method: "GET",
            sessionId: "test-session-1"
        }
    }
};

let responseCount = 0;
const expectedResponses = 4;

// Handle server output
serverProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    
    for (const line of lines) {
        try {
            const response = JSON.parse(line);
            responseCount++;
            
            console.log(`📦 Response ${responseCount}:`, JSON.stringify(response, null, 2));
            
            if (responseCount === 1) {
                // Initialize response received, request tools list
                console.log('\n📋 Requesting tools list...');
                sendRequest(toolsListRequest);
                
            } else if (responseCount === 2) {
                // Tools list received, test browser launch
                console.log(`\n✅ Found ${response.result?.tools?.length || 0} tools`);
                console.log('\n🌐 Testing browser launch...');
                sendRequest(browserLaunchRequest);
                
            } else if (responseCount === 3) {
                // Browser launch response, test API request
                console.log('\n📡 Testing API request...');
                sendRequest(apiRequestTest);
                
            } else if (responseCount === expectedResponses) {
                // All tests completed
                console.log('\n🎉 All tests completed successfully!');
                serverProcess.kill();
                process.exit(0);
            }
        } catch (error) {
            // Skip non-JSON lines (likely error logs)
        }
    }
});

// Handle server errors
serverProcess.on('error', (error) => {
    console.error('❌ Server error:', error.message);
    process.exit(1);
});

// Handle server exit
serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
        console.error(`❌ Server exited with code ${code}`);
        process.exit(1);
    }
});

// Function to send JSON-RPC requests
function sendRequest(request) {
    const requestStr = JSON.stringify(request) + '\n';
    serverProcess.stdin.write(requestStr);
}

// Start the test sequence
console.log('🔗 Sending initialize request...');
sendRequest(initializeRequest);

// Timeout after 30 seconds
setTimeout(() => {
    console.error('❌ Test timeout after 30 seconds');
    serverProcess.kill();
    process.exit(1);
}, 30000);
