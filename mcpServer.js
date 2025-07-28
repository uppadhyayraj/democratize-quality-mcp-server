#!/usr/bin/env node
// mcpServer.js - Democratize Quality MCP Server entry point
//
// Debug/Logging Modes:
// - Production mode (default): NODE_ENV=production or npm start - Minimal logging
// - Debug mode: MCP_FEATURES_ENABLEDEBUGMODE=true or npm run dev - Detailed logging
// - Development mode: NODE_ENV=development - Detailed logging (same as debug)
//
// The server automatically detects the mode and adjusts logging verbosity accordingly.

const { JSONRPCServer } = require("json-rpc-2.0");
const browserService = require('./src/services/browserService'); // Keep for shutdown functionality
const { initializeTools, getToolDefinitions, executeTool } = require('./src/tools');
const config = require('./src/config');

// Initialize JSON-RPC server
const server = new JSONRPCServer();

// Check if debug mode is requested via environment variable first
const debugFromEnv = process.env.MCP_FEATURES_ENABLEDEBUGMODE === 'true' || process.env.NODE_ENV === 'development';
const isDebugMode = config.get('features.enableDebugMode', false) || debugFromEnv;

// Set quiet mode if not in debug
config.setQuiet(!isDebugMode);

// Global variable to hold tool definitions after initialization
let toolDefinitions = [];

// Helper function for debug logging
function debugLog(...args) {
    if (isDebugMode) {
        console.error('[Democratize Quality MCP]', ...args);
    }
}

// Helper function for important logs (always shown)
function log(...args) {
    console.error('[Democratize Quality MCP]', ...args);
}

// Initialize the tool system
async function initializeServer() {
    try {
        if (isDebugMode) {
            log('Initializing tool system...');
        }
        await initializeTools(isDebugMode);
        toolDefinitions = getToolDefinitions();
        log(`Tool system initialized with ${toolDefinitions.length} tools`);
    } catch (error) {
        log('Failed to initialize tool system:', error.message);
        process.exit(1);
    }
}

// --- Register MCP Standard Methods ---

// Initialize method for MCP protocol
server.addMethod("initialize", async (params) => {
    debugLog("Received 'initialize' request.");
    return {
        protocolVersion: "2024-11-05",
        capabilities: {
            tools: {},
            prompts: {},
            resources: {}
        },
        serverInfo: {
            name: "browser-control-server",
            version: "1.0.0"
        }
    };
});

// The `tools/list` method for tool discovery
// Replace your tools/list method with this Draft 7 compatible version:

server.addMethod("tools/list", async () => {
    debugLog("Received 'tools/list' request.");
    
    // Convert all tool definitions to Claude Desktop compatible format
    const compatibleTools = toolDefinitions.map(tool => {
        // Ensure we use the correct property name and clean schema
        return {
            name: tool.name,
            description: tool.description,
            // Claude Desktop expects 'inputSchema', not 'input_schema'
            inputSchema: {
                type: "object",
                properties: {
                    // Add minimal properties to avoid empty schema issues
                    ...((tool.input_schema && tool.input_schema.properties) || {}),
                    // Fallback to ensure there's always at least one property
                    ...(Object.keys((tool.input_schema && tool.input_schema.properties) || {}).length === 0 ? {
                        _placeholder: { type: "string", description: "Placeholder parameter" }
                    } : {})
                },
                // Only add required if it exists and is not empty
                ...(tool.input_schema && tool.input_schema.required && tool.input_schema.required.length > 0 ? {
                    required: tool.input_schema.required
                } : {}),
                // Ensure no additionalProperties or other Draft 2020-12 features
                additionalProperties: false
            }
        };
    });
    
    debugLog(`Returning ${compatibleTools.length} tools with compatible schemas`);
    debugLog('First tool schema sample:', JSON.stringify(compatibleTools[0]?.inputSchema, null, 2));
    
    return { tools: compatibleTools };
});

// The `tools/call` method for tool invocation (note: it's tools/call, not tool/call)
server.addMethod("tools/call", async ({ name, arguments: parameters }) => {
    debugLog(`Received 'tools/call' for method: ${name} with params: ${JSON.stringify(parameters)}`);

    try {
        // Use the new tool system to execute the tool
        const result = await executeTool(name, parameters);
        return result;
        
    } catch (error) {
        log(`Error executing tool '${name}':`, error.message);
        
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

// The `prompts/list` method for prompt discovery
server.addMethod("prompts/list", async () => {
    debugLog("Received 'prompts/list' request.");
    // This server doesn't provide any prompts, so return an empty array
    return { prompts: [] };
});

// The `resources/list` method for resource discovery
server.addMethod("resources/list", async () => {
    debugLog("Received 'resources/list' request.");
    // This server doesn't provide any resources, so return an empty array
    return { resources: [] };
});

// Notification methods (these don't return responses)
server.addMethod("notifications/initialized", async () => {
    debugLog("Received 'notifications/initialized' notification.");
    // Notifications don't return responses
});

server.addMethod("notifications/cancelled", async ({ requestId, reason }) => {
    debugLog(`Received 'notifications/cancelled' for request ${requestId}: ${reason}`);
    // Notifications don't return responses
});

// Add a catch-all method handler for debugging
server.addMethod("*", async (params, method) => {
    debugLog(`Unknown method called: ${method}`);
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
                debugLog(`Received request: ${JSON.stringify(jsonRpcRequest)}`);
                
                // Handle notifications (no response expected)
                if (!jsonRpcRequest.id && jsonRpcRequest.method && jsonRpcRequest.method.startsWith('notifications/')) {
                    server.receive(jsonRpcRequest).catch(err => {
                        log("Error processing notification:", err.message);
                    });
                    return; // Don't send a response for notifications
                }
                
                // The receive method handles processing the request and generating a response
                server.receive(jsonRpcRequest).then((jsonRpcResponse) => {
                    if (jsonRpcResponse) {
                        debugLog(`Sending response: ${JSON.stringify(jsonRpcResponse)}`);
                        // All responses must go to stdout
                        process.stdout.write(JSON.stringify(jsonRpcResponse) + '\n');
                    }
                }).catch(err => {
                    // Catch errors from receive() if it rejects (e.g., malformed JSON-RPC request)
                    log("Error processing JSON-RPC request:", err.message);
                    
                    // Send an error response if we have an ID
                    if (jsonRpcRequest.id) {
                        const errorResponse = {
                            jsonrpc: "2.0",
                            error: {
                                code: -32603,
                                message: "Internal error",
                                data: err.message
                            },
                            id: jsonRpcRequest.id
                        };
                        process.stdout.write(JSON.stringify(errorResponse) + '\n');
                    }
                });
            } catch (parseError) {
                log("JSON parse error on input:", messageString, parseError);
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
    log('\nSIGINT received. Shutting down...');
    try {
        await browserService.shutdownAllBrowsers();
        log('All browser instances closed. Exiting gracefully.');
    } catch (err) {
        log('Error during graceful shutdown:', err.message);
        process.exit(1); // Exit with error code
    }
    process.exit(0); // Exit successfully
});

process.on('SIGTERM', async () => {
    log('\nSIGTERM received. Shutting down...');
    try {
        await browserService.shutdownAllBrowsers();
        log('All browser instances closed. Exiting gracefully.');
    } catch (err) {
        log('Error during graceful shutdown:', err.message);
        process.exit(1);
    }
    process.exit(0);
});

// Initialize the server and start listening
(async () => {
    await initializeServer();
    
    // Initial message to indicate server is ready (to stderr)
    log(`Server started. Waiting for input on stdin.`);
    if (isDebugMode) {
        log(`To integrate with a host, provide the command: node ${__filename}`);
        log(`Debug mode enabled - showing detailed logs`);
    }
})();
