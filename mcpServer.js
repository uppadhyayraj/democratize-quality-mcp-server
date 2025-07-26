#!/usr/bin/env node
// mcpServer.js - The new JSON-RPC 2.0 MCP Server entry point

const { JSONRPCServer } = require("json-rpc-2.0");
const browserService = require('./src/services/browserService'); // Keep for shutdown functionality
const { initializeTools, getToolDefinitions, executeTool } = require('./src/tools');

// Initialize JSON-RPC server
const server = new JSONRPCServer();

// Global variable to hold tool definitions after initialization
let toolDefinitions = [];

// Initialize the tool system
async function initializeServer() {
    try {
        console.error('[MCP Server] Initializing tool system...');
        await initializeTools();
        toolDefinitions = getToolDefinitions();
        console.error(`[MCP Server] Tool system initialized with ${toolDefinitions.length} tools`);
    } catch (error) {
        console.error('[MCP Server] Failed to initialize tool system:', error.message);
        process.exit(1);
    }
}

// --- Register MCP Standard Methods ---

// Initialize method for MCP protocol
server.addMethod("initialize", async (params) => {
    console.error("[MCP Server] Received 'initialize' request.");
    return {
        protocolVersion: "2024-11-05",
        capabilities: {
            tools: {}
        },
        serverInfo: {
            name: "browser-control-server",
            version: "1.0.0"
        }
    };
});

// The `tools/list` method for tool discovery
server.addMethod("tools/list", async () => {
    // IMPORTANT: All logging must go to stderr to avoid corrupting stdout JSON-RPC communication
    console.error("[MCP Server] Received 'tools/list' request.");
    return { tools: toolDefinitions };
});

// The `tools/call` method for tool invocation (note: it's tools/call, not tool/call)
server.addMethod("tools/call", async ({ name, arguments: parameters }) => {
    console.error(`[MCP Server] Received 'tools/call' for method: ${name} with params: ${JSON.stringify(parameters)}`);

    try {
        // Use the new tool system to execute the tool
        const result = await executeTool(name, parameters);
        return result;
        
    } catch (error) {
        console.error(`[MCP Server] Error executing tool '${name}':`, error.message);
        
        // If it's already a properly formatted MCP error, re-throw it
        if (error.code && error.message) {
            throw error;
        }
        
        // Otherwise, format it as an MCP error
        throw {
            code: -32000,
            message: `Tool execution failed: ${error.message}`,
            data: { tool_name: name, original_error: error.message }
        };
    }
});

// Add a catch-all method handler for debugging
server.addMethod("*", async (params, method) => {
    console.error(`[MCP Server] Unknown method called: ${method}`);
    throw {
        code: -32601,
        message: `Method '${method}' not found`
    };
});

// --- STDIO Communication Loop ---
// This part handles reading JSON-RPC requests from stdin and writing responses to stdout.

let inputBuffer = '';

process.stdin.on('data', (chunk) => {
    inputBuffer += chunk.toString();

    // Process messages delimited by newline. This is a common pattern for STDIO RPC.
    // In a production-grade server, you'd want a more robust JSON stream parser
    // to handle partial messages or multiple messages in one chunk.
    let newlineIndex;
    while ((newlineIndex = inputBuffer.indexOf('\n')) !== -1) {
        const messageString = inputBuffer.substring(0, newlineIndex).trim();
        inputBuffer = inputBuffer.substring(newlineIndex + 1);

        if (messageString) { // Ensure it's not an empty line
            try {
                const jsonRpcRequest = JSON.parse(messageString);
                console.error(`[MCP Server] Received request: ${JSON.stringify(jsonRpcRequest)}`);
                // The receive method handles processing the request and generating a response
                server.receive(jsonRpcRequest).then((jsonRpcResponse) => {
                    if (jsonRpcResponse) {
                        console.error(`[MCP Server] Sending response: ${JSON.stringify(jsonRpcResponse)}`);
                        // All responses must go to stdout
                        process.stdout.write(JSON.stringify(jsonRpcResponse) + '\n');
                    }
                }).catch(err => {
                    // Catch errors from receive() if it rejects (e.g., malformed JSON-RPC request)
                    console.error("[MCP Server] Error processing JSON-RPC request:", err.message);
                });
            } catch (parseError) {
                console.error("[MCP Server] JSON parse error on input:", messageString, parseError);
                // If the input itself is not valid JSON, we can't get an ID, so ID is null
                const errorResponse = {
                    jsonrpc: "2.0",
                    error: {
                        code: -32700, // Parse error
                        message: "Parse error"
                    },
                    id: null
                };
                process.stdout.write(JSON.stringify(errorResponse) + '\n');
            }
        }
    }
});

// Handle graceful shutdown signals (Ctrl+C, termination)
process.on('SIGINT', async () => {
    console.error('\n[MCP Server] SIGINT received. Shutting down...');
    try {
        await browserService.shutdownAllBrowsers();
        console.error('[MCP Server] All browser instances closed. Exiting gracefully.');
    } catch (err) {
        console.error('[MCP Server] Error during graceful shutdown:', err.message);
        process.exit(1); // Exit with error code
    }
    process.exit(0); // Exit successfully
});

process.on('SIGTERM', async () => {
    console.error('\n[MCP Server] SIGTERM received. Shutting down...');
    try {
        await browserService.shutdownAllBrowsers();
        console.error('[MCP Server] All browser instances closed. Exiting gracefully.');
    } catch (err) {
        console.error('[MCP Server] Error during graceful shutdown:', err.message);
        process.exit(1);
    }
    process.exit(0);
});

// Initialize the server and start listening
(async () => {
    await initializeServer();
    
    // Initial message to indicate server is ready (to stderr)
    console.error(`[MCP Server] server started. Waiting for input on stdin.`);
    console.error(`[MCP Server] To integrate with a host, provide the command: node ${__filename}`);
})();
