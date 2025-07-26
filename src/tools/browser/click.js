const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Browser Click Tool
 * Simulates a click on a specific element in the browser
 */
class BrowserClickTool extends ToolBase {
    static definition = {
        name: "browser_click",
        description: "Simulates a click on a specific element in the browser.",
        input_schema: {
            type: "object",
            properties: {
                browserId: {
                    type: "string",
                    description: "The ID of the browser instance."
                },
                selector: {
                    type: "string",
                    description: "The CSS selector of the element to click."
                }
            },
            required: ["browserId", "selector"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Indicates if the click was successful." },
                browserId: { type: "string", description: "The browser instance ID that was used." }
            },
            required: ["success", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId, selector } = parameters;

        console.error(`[BrowserClickTool] Simulating click in browser ${browserId} on element: ${selector}`);

        try {
            await browserService.clickElement(browserId, selector);
            console.error(`[BrowserClickTool] Successfully clicked element in browser: ${browserId}`);
            return { success: true, browserId: browserId };
        } catch (error) {
            console.error(`[BrowserClickTool] Failed to click element:`, error.message);
            throw new Error(`Failed to click element in browser ${browserId}: ${error.message}`);
        }
    }
}

module.exports = BrowserClickTool;
