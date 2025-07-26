const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Browser Navigate Tool
 * Navigates a specific browser instance to a given URL
 */
class BrowserNavigateTool extends ToolBase {
    static definition = {
        name: "browser_navigate",
        description: "Navigates a specific browser instance to a given URL.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance to navigate." 
                },
                url: { 
                    type: "string", 
                    description: "The URL to navigate to. Must include protocol (http:// or https://)." 
                }
            },
            required: ["browserId", "url"]
        },
        output_schema: {
            type: "object",
            properties: {
                message: { type: "string", description: "Confirmation message of successful navigation." },
                url: { type: "string", description: "The URL that was navigated to." },
                browserId: { type: "string", description: "The browser instance ID that was used." }
            },
            required: ["message", "url", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId, url } = parameters;

        // Basic URL validation
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            throw new Error("URL must include protocol (http:// or https://)");
        }

        console.error(`[BrowserNavigateTool] Navigating browser ${browserId} to: ${url}`);

        try {
            await browserService.navigateBrowser(browserId, url);
            
            console.error(`[BrowserNavigateTool] Successfully navigated to: ${url}`);
            
            return {
                message: `Successfully navigated to ${url}`,
                url: url,
                browserId: browserId
            };
            
        } catch (error) {
            console.error(`[BrowserNavigateTool] Navigation failed:`, error.message);
            
            // Provide more specific error messages
            if (error.message.includes('not found')) {
                throw new Error(`Browser instance '${browserId}' not found. Please launch a browser first using browser_launch.`);
            }
            
            throw new Error(`Failed to navigate to ${url}: ${error.message}`);
        }
    }
}

module.exports = BrowserNavigateTool;
