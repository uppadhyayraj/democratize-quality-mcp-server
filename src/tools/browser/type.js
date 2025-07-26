const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Browser Type Tool
 * Clicks an element on the current browser page using a CSS selector
 */
class BrowserTypeTool extends ToolBase {
    static definition = {
        name: "browser_type",
        description: "Types text into a specific input field in the browser.",
        input_schema: {
            type: "object",
            properties: {
                browserId: {
                    type: "string",
                    description: "The ID of the browser instance."
                },
                selector: {
                    type: "string",
                    description: "The CSS selector of the input field."
                },
                text: {
                    type: "string",
                    description: "The text to type into the input field."
                }
            },
            required: ["browserId", "selector", "text"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Indicates if the typing was successful." },
                browserId: { type: "string", description: "The browser instance ID that was used." }
            },
            required: ["success", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId, selector, text } = parameters;

        console.error(`[BrowserTypeTool] Typing in browser ${browserId} on element: ${selector}`);

        try {
            await browserService.typeIntoElement(browserId, selector, text);
            console.error(`[BrowserTypeTool] Successfully typed in browser: ${browserId}`);
            return { success: true, browserId: browserId };
        } catch (error) {
            console.error(`[BrowserTypeTool] Failed to type in element:`, error.message);
            throw new Error(`Failed to type in browser ${browserId}: ${error.message}`);
        }
    }
}

module.exports = BrowserTypeTool;
