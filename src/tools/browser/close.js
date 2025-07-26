const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Browser Close Tool
 * Closes a specific browser instance and cleans up its resources
 */
class BrowserCloseTool extends ToolBase {
    static definition = {
        name: "browser_close",
        description: "Closes a specific browser instance and cleans up its resources. Always call this when done with a browser.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance to close." 
                }
            },
            required: ["browserId"]
        },
        output_schema: {
            type: "object",
            properties: {
                message: { type: "string", description: "Confirmation message of successful closure." },
                browserId: { type: "string", description: "The browser instance ID that was closed." }
            },
            required: ["message", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId } = parameters;

        console.error(`[BrowserCloseTool] Closing browser: ${browserId}`);

        try {
            await browserService.closeBrowser(browserId);
            
            console.error(`[BrowserCloseTool] Successfully closed browser: ${browserId}`);
            
            return {
                message: `Browser ${browserId} closed successfully`,
                browserId: browserId
            };
            
        } catch (error) {
            console.error(`[BrowserCloseTool] Failed to close browser:`, error.message);
            
            // Provide more specific error messages
            if (error.message.includes('not found')) {
                throw new Error(`Browser instance '${browserId}' not found or already closed.`);
            }
            
            throw new Error(`Failed to close browser ${browserId}: ${error.message}`);
        }
    }
}

module.exports = BrowserCloseTool;
