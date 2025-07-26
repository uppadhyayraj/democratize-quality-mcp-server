const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Browser Launch Tool
 * Launches a new web browser instance and returns a unique browserId
 */
class BrowserLaunchTool extends ToolBase {
    static definition = {
        name: "browser_launch",
        description: "Launches a new web browser instance. Returns a unique browserId. Use this before any other browser actions.",
        input_schema: {
            type: "object",
            properties: {
                headless: { 
                    type: "boolean", 
                    description: "Whether to launch the browser in headless mode (no UI). Defaults to true. Set to false for manual login.", 
                    default: true 
                },
                userDataDir: { 
                    type: "string", 
                    description: "Optional. A path (relative to the server) to a directory to store persistent user data (e.g., login sessions, cookies). Use for authenticated sessions. If not provided, a temporary profile is used." 
                },
                port: {
                    type: "number",
                    description: "Optional. The port for remote debugging. If not provided, Chrome will choose an available port."
                }
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
    };

    async execute(parameters) {
        // Set defaults
        const headless = parameters.headless !== undefined ? parameters.headless : true;
        const port = parameters.port || undefined; // Let chrome-launcher choose if not specified
        const userDataDir = parameters.userDataDir || null;

        console.error(`[BrowserLaunchTool] Launching browser with headless=${headless}, port=${port}, userDataDir=${userDataDir}`);

        try {
            const result = await browserService.launchBrowser(headless, port, userDataDir);
            
            console.error(`[BrowserLaunchTool] Successfully launched browser: ${result.browserId}`);
            
            return {
                browserId: result.browserId,
                port: result.port,
                userDataDir: result.userDataDir || null
            };
            
        } catch (error) {
            console.error(`[BrowserLaunchTool] Failed to launch browser:`, error.message);
            throw new Error(`Failed to launch browser: ${error.message}`);
        }
    }
}

module.exports = BrowserLaunchTool;
