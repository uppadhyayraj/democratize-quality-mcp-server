const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Browser Screenshot Tool
 * Captures a screenshot of the current browser page
 */
class BrowserScreenshotTool extends ToolBase {
    static definition = {
        name: "browser_screenshot",
        description: "Captures a screenshot of the current browser page. Returns base64 encoded image data. Optionally saves to disk.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance." 
                },
                fileName: { 
                    type: "string", 
                    description: "Optional. The name of the file to save the screenshot as (e.g., 'my_page.png'). Saved to the server's configured output directory. If not provided, a timestamped name is used." 
                },
                saveToDisk: { 
                    type: "boolean", 
                    description: "Optional. Whether to save the screenshot to disk on the server. Defaults to true. Set to false to only receive base64 data.", 
                    default: true 
                }
            },
            required: ["browserId"]
        },
        output_schema: {
            type: "object",
            properties: {
                imageData: { type: "string", description: "Base64 encoded PNG image data." },
                format: { type: "string", description: "Image format (e.g., 'png')." },
                fileName: { type: "string", description: "The file name if saved to disk." },
                browserId: { type: "string", description: "The browser instance ID that was used." }
            },
            required: ["imageData", "format", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId, fileName, saveToDisk = true } = parameters;

        // Generate filename if not provided
        const finalFileName = fileName || `screenshot_${browserId}_${Date.now()}.png`;

        console.error(`[BrowserScreenshotTool] Taking screenshot of browser ${browserId}, fileName: ${finalFileName}, saveToDisk: ${saveToDisk}`);

        try {
            const imageData = await browserService.takeScreenshot(browserId, finalFileName, saveToDisk);
            
            console.error(`[BrowserScreenshotTool] Successfully captured screenshot for browser: ${browserId}`);
            
            return {
                imageData: imageData,
                format: 'png',
                fileName: saveToDisk ? finalFileName : null,
                browserId: browserId
            };
            
        } catch (error) {
            console.error(`[BrowserScreenshotTool] Failed to take screenshot:`, error.message);
            
            // Provide more specific error messages
            if (error.message.includes('not found')) {
                throw new Error(`Browser instance '${browserId}' not found. Please launch a browser first using browser_launch.`);
            }
            
            throw new Error(`Failed to take screenshot of browser ${browserId}: ${error.message}`);
        }
    }
}

module.exports = BrowserScreenshotTool;
