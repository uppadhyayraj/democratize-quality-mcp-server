// mcpServer.js - The new JSON-RPC 2.0 MCP Server entry point

const { JSONRPCServer } = require("json-rpc-2.0");
const browserService = require('./src/services/browserService'); // Your existing browser service
// const path = require('path'); // Path is needed by browserService, no direct usage here
const config = require('./src/config'); // Your existing config for OUTPUT_DIR, etc.

// Initialize JSON-RPC server
const server = new JSONRPCServer();

// --- MCP Tool Definitions (JSON Schema) ---
// These describe your functions to the LLM.
// The 'name' must match the method name we register with the JSONRPCServer.

const toolDefinitions = [
    {
        name: "browser_launch",
        description: "Launches a new web browser instance. Returns a unique browserId. Use this before any other browser actions.",
        input_schema: {
            type: "object",
            properties: {
                headless: { type: "boolean", description: "Whether to launch the browser in headless mode (no UI). Defaults to true. Set to false for manual login.", default: true },
                userDataDir: { type: "string", description: "Optional. A path (relative to the server) to a directory to store persistent user data (e.g., login sessions, cookies). Use for authenticated sessions. If not provided, a temporary profile is used." }
            }
        },
        output_schema: {
            type: "object",
            properties: {
                browserId: { type: "string", description: "The unique ID of the launched browser instance." },
                port: { type: "number", description: "The port the browser instance is running on for remote debugging." },
                userDataDir: { type: "string", description: "The absolute path to the user data directory used." }
            },
            required: ["browserId", "port"]
        }
    },
    {
        name: "browser_navigate",
        description: "Navigates a specific browser instance to a given URL.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { type: "string", description: "The ID of the browser instance to navigate." },
                url: { type: "string", description: "The URL to navigate to." }
            },
            required: ["browserId", "url"]
        }
    },
    {
        name: "browser_click",
        description: "Performs a click action on a web element identified by a CSS selector or XPath. The element will be scrolled into view.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { type: "string", description: "The ID of the browser instance." },
                locator: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["css", "xpath"], description: "Type of selector: 'css' or 'xpath'." },
                        value: { type: "string", description: "The CSS selector or XPath string." }
                    },
                    required: ["type", "value"]
                }
            },
            required: ["browserId", "locator"]
        },
        output_schema: {
            type: "object",
            properties: {
                x: { type: "number", description: "X coordinate of the click." },
                y: { type: "number", description: "Y coordinate of the click." }
            },
            required: ["x", "y"]
        }
    },
    {
        name: "browser_type",
        description: "Types text into a web element identified by a CSS selector or XPath. The element will be focused and existing text will be cleared.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { type: "string", description: "The ID of the browser instance." },
                locator: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["css", "xpath"], description: "Type of selector: 'css' or 'xpath'." },
                        value: { type: "string", description: "The CSS selector or XPath string." }
                    },
                    required: ["type", "value"]
                },
                text: { type: "string", description: "The text string to type into the element." }
            },
            required: ["browserId", "locator", "text"]
        }
    },
    {
        name: "browser_screenshot",
        description: "Captures a screenshot of the current browser page. Returns base64 encoded image data. Optionally saves to disk.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { type: "string", description: "The ID of the browser instance." },
                fileName: { type: "string", description: "Optional. The name of the file to save the screenshot as (e.g., 'my_page.png'). Saved to the server's configured output directory. If not provided, a timestamped name is used." },
                saveToDisk: { type: "boolean", description: "Optional. Whether to save the screenshot to disk on the server. Defaults to true. Set to false to only receive base64 data.", default: true }
            },
            required: ["browserId"]
        },
        output_schema: {
            type: "object",
            properties: {
                imageData: { type: "string", description: "Base64 encoded PNG image data." },
                format: { type: "string", description: "Image format (e.g., 'png')." },
                fileName: { type: "string", description: "The file name if saved to disk." }
            },
            required: ["imageData", "format"]
        }
    },
    {
        name: "browser_dom",
        description: "Retrieves the full HTML content (DOM) of the current browser page.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { type: "string", description: "The ID of the browser instance." }
            },
            required: ["browserId"]
        },
        output_schema: {
            type: "object",
            properties: {
                html: { type: "string", description: "The full outer HTML content of the page." }
            },
            required: ["html"]
        }
    },
    {
        name: "browser_close",
        description: "Closes a specific browser instance and cleans up its resources. Always call this when done with a browser.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { type: "string", description: "The ID of the browser instance to close." }
            },
            required: ["browserId"]
        }
    }
];

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
        let result;
        switch (name) {
            case "browser_launch":
                result = await browserService.launchBrowser(
                    parameters.headless,
                    parameters.port, // Port is often ignored by chrome-launcher in host-managed scenarios but included for completeness
                    parameters.userDataDir
                );
                break;
            case "browser_navigate":
                if (!parameters.browserId || !parameters.url) {
                    throw new Error("browserId and url are required for browser_navigate.");
                }
                await browserService.navigateBrowser(
                    parameters.browserId,
                    parameters.url
                );
                result = { message: `Navigated to ${parameters.url}` }; // Simple confirmation
                break;
            case "browser_click":
                if (!parameters.browserId || !parameters.locator) {
                    throw new Error("browserId and locator are required for browser_click.");
                }
                const coords = await browserService.clickElement(
                    parameters.browserId,
                    parameters.locator
                );
                result = { x: coords.x, y: coords.y };
                break;
            case "browser_type":
                if (!parameters.browserId || !parameters.locator || typeof parameters.text !== 'string') {
                    throw new Error("browserId, locator, and text are required for browser_type.");
                }
                await browserService.typeIntoElement(
                    parameters.browserId,
                    parameters.locator,
                    parameters.text
                );
                result = { message: `Typed text into element` }; // Simple confirmation
                break;
            case "browser_screenshot":
                if (!parameters.browserId) {
                    throw new Error("browserId is required for browser_screenshot.");
                }
                const fileName = parameters.fileName || `screenshot_${parameters.browserId}_${Date.now()}.png`;
                const imageData = await browserService.takeScreenshot(
                    parameters.browserId,
                    fileName,
                    parameters.saveToDisk
                );
                result = { imageData: imageData, format: 'png', fileName: fileName };
                break;
            case "browser_dom":
                if (!parameters.browserId) {
                    throw new Error("browserId is required for browser_dom.");
                }
                const html = await browserService.getDomContent(parameters.browserId);
                result = { html: html };
                break;
            case "browser_close":
                if (!parameters.browserId) {
                    throw new Error("browserId is required for browser_close.");
                }
                await browserService.closeBrowser(parameters.browserId);
                result = { message: `Browser ${parameters.browserId} closed` };
                break;
            default:
                throw new Error(`Method '${name}' not found.`);
        }
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
        console.error(`[MCP Server] Error executing tool '${name}':`, error.message);
        // Return a JSON-RPC error response object
        throw {
            code: -32000, // Application-specific error code
            message: `Tool execution failed: ${error.message}`,
            data: { tool_name: name, original_error: error.message } // Optional data for more context
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

// Initial message to indicate server is ready (to stderr)
console.error(`[MCP Server] server started. Waiting for input on stdin.`);
console.error(`[MCP Server] To integrate with a host, provide the command: node ${__filename}`);
