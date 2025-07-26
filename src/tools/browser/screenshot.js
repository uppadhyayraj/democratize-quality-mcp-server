const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Enhanced Browser Screenshot Tool
 * Captures screenshots with advanced options including element-specific and full-page captures
 * Inspired by Playwright MCP screenshot capabilities
 */
class BrowserScreenshotTool extends ToolBase {
    static definition = {
        name: "browser_screenshot",
        description: "Capture screenshots with advanced options including full page, element-specific, and custom formats with quality control.",
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
                },
                options: {
                    type: "object",
                    properties: {
                        fullPage: {
                            type: "boolean",
                            default: false,
                            description: "Capture full scrollable page instead of just viewport"
                        },
                        element: {
                            type: "string",
                            description: "CSS selector of element to screenshot (captures only that element)"
                        },
                        format: {
                            type: "string",
                            enum: ["png", "jpeg", "webp"],
                            default: "png",
                            description: "Image format"
                        },
                        quality: {
                            type: "number",
                            minimum: 0,
                            maximum: 100,
                            description: "JPEG/WebP quality (0-100, ignored for PNG)"
                        },
                        clip: {
                            type: "object",
                            properties: {
                                x: { type: "number", description: "X coordinate of clip area" },
                                y: { type: "number", description: "Y coordinate of clip area" },
                                width: { type: "number", description: "Width of clip area" },
                                height: { type: "number", description: "Height of clip area" },
                                scale: { type: "number", description: "Scale factor for clip area" }
                            },
                            description: "Specific area to capture"
                        },
                        omitBackground: {
                            type: "boolean",
                            default: false,
                            description: "Hide default white background for transparent screenshots"
                        },
                        captureBeyondViewport: {
                            type: "boolean",
                            default: false,
                            description: "Capture content outside viewport"
                        }
                    },
                    description: "Screenshot capture options"
                }
            },
            required: ["browserId"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether screenshot was captured successfully" },
                imageData: { type: "string", description: "Base64 encoded image data" },
                format: { type: "string", description: "Image format used" },
                fileName: { type: "string", description: "The file name if saved to disk" },
                dimensions: {
                    type: "object",
                    properties: {
                        width: { type: "number" },
                        height: { type: "number" }
                    },
                    description: "Image dimensions"
                },
                fileSize: { type: "number", description: "File size in bytes" },
                element: { type: "string", description: "CSS selector if element screenshot was taken" },
                browserId: { type: "string", description: "The browser instance ID that was used" }
            },
            required: ["success", "imageData", "format", "browserId"]
        }
    };

    async execute(parameters) {
        const { 
            browserId, 
            fileName, 
            saveToDisk = true, 
            options = {} 
        } = parameters;

        const browser = browserService.getBrowser(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found. Please launch a browser first using browser_launch.`);
        }

        // Generate filename if not provided
        const fileExtension = this.getFileExtension(options.format || 'png');
        const finalFileName = fileName || `screenshot_${browserId}_${Date.now()}.${fileExtension}`;

        console.error(`[BrowserScreenshotTool] Taking screenshot of browser ${browserId}, fileName: ${finalFileName}, saveToDisk: ${saveToDisk}`);

        try {
            let screenshotResult;
            
            if (options.element) {
                screenshotResult = await this.captureElementScreenshot(browser.client, options);
            } else {
                screenshotResult = await this.capturePageScreenshot(browser.client, options);
            }
            
            // Save to disk if requested
            let savedPath = null;
            if (saveToDisk) {
                savedPath = await this.saveScreenshot(screenshotResult.data, finalFileName);
            }
            
            console.error(`[BrowserScreenshotTool] Successfully captured screenshot for browser: ${browserId}`);
            
            return {
                success: true,
                imageData: screenshotResult.data,
                format: options.format || 'png',
                fileName: savedPath ? finalFileName : null,
                dimensions: screenshotResult.dimensions,
                fileSize: screenshotResult.fileSize,
                element: options.element || null,
                browserId: browserId
            };
            
        } catch (error) {
            console.error(`[BrowserScreenshotTool] Failed to take screenshot:`, error.message);
            throw new Error(`Failed to take screenshot of browser ${browserId}: ${error.message}`);
        }
    }

    /**
     * Capture page screenshot with options
     */
    async capturePageScreenshot(client, options) {
        await client.Page.enable();
        
        const screenshotOptions = {
            format: options.format || 'png',
            quality: options.format !== 'png' ? options.quality : undefined,
            optimizeForSpeed: false,
            captureBeyondViewport: options.captureBeyondViewport || options.fullPage || false
        };

        // Handle clip area
        if (options.clip) {
            screenshotOptions.clip = options.clip;
        }

        // Handle full page screenshot
        if (options.fullPage && !options.clip) {
            const layoutMetrics = await client.Page.getLayoutMetrics();
            screenshotOptions.clip = {
                x: 0,
                y: 0,
                width: layoutMetrics.contentSize.width,
                height: layoutMetrics.contentSize.height,
                scale: 1
            };
        }

        // Handle transparent background
        if (options.omitBackground) {
            // Set background to transparent (requires format support)
            await client.Emulation.setDefaultBackgroundColorOverride({
                color: { r: 0, g: 0, b: 0, a: 0 }
            });
        }

        const result = await client.Page.captureScreenshot(screenshotOptions);
        
        // Reset background if it was changed
        if (options.omitBackground) {
            await client.Emulation.setDefaultBackgroundColorOverride();
        }

        return {
            data: result.data,
            dimensions: this.getImageDimensions(screenshotOptions.clip),
            fileSize: Buffer.from(result.data, 'base64').length
        };
    }

    /**
     * Capture element screenshot
     */
    async captureElementScreenshot(client, options) {
        await client.DOM.enable();
        await client.Page.enable();

        // Find the element
        const document = await client.DOM.getDocument();
        const element = await client.DOM.querySelector({
            nodeId: document.root.nodeId,
            selector: options.element
        });

        if (!element.nodeId) {
            throw new Error(`Element not found with selector: ${options.element}`);
        }

        // Get element bounds
        const box = await client.DOM.getBoxModel({ nodeId: element.nodeId });
        if (!box.model) {
            throw new Error(`Could not get bounds for element: ${options.element}`);
        }

        // Use content bounds for the clip
        const bounds = box.model.content;
        const clip = {
            x: Math.round(bounds[0]),
            y: Math.round(bounds[1]),
            width: Math.round(bounds[4] - bounds[0]),
            height: Math.round(bounds[5] - bounds[1]),
            scale: 1
        };

        const screenshotOptions = {
            format: options.format || 'png',
            quality: options.format !== 'png' ? options.quality : undefined,
            clip: clip,
            optimizeForSpeed: false
        };

        // Handle transparent background for element
        if (options.omitBackground) {
            await client.Emulation.setDefaultBackgroundColorOverride({
                color: { r: 0, g: 0, b: 0, a: 0 }
            });
        }

        const result = await client.Page.captureScreenshot(screenshotOptions);
        
        if (options.omitBackground) {
            await client.Emulation.setDefaultBackgroundColorOverride();
        }

        return {
            data: result.data,
            dimensions: { width: clip.width, height: clip.height },
            fileSize: Buffer.from(result.data, 'base64').length
        };
    }

    /**
     * Save screenshot to disk
     */
    async saveScreenshot(base64Data, fileName) {
        const fs = require('fs').promises;
        const path = require('path');
        
        // Use output directory from config or current directory
        const outputDir = process.env.OUTPUT_DIR || './output';
        const filePath = path.join(outputDir, fileName);
        
        // Ensure directory exists
        await fs.mkdir(outputDir, { recursive: true });
        
        // Save file
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(filePath, buffer);
        
        return filePath;
    }

    /**
     * Get file extension for format
     */
    getFileExtension(format) {
        const extensions = {
            'png': 'png',
            'jpeg': 'jpg',
            'webp': 'webp'
        };
        return extensions[format] || 'png';
    }

    /**
     * Get image dimensions from clip or default
     */
    getImageDimensions(clip) {
        if (clip) {
            return {
                width: clip.width,
                height: clip.height
            };
        }
        return null; // Will be determined by actual screenshot
    }

    /**
     * Capture screenshot with scroll handling
     */
    async captureWithScroll(client, options) {
        // Save current scroll position
        const scrollPosition = await client.Runtime.evaluate({
            expression: '({ x: window.scrollX, y: window.scrollY })'
        });

        try {
            // Scroll to top for full page capture
            if (options.fullPage) {
                await client.Runtime.evaluate({
                    expression: 'window.scrollTo(0, 0)'
                });
                // Wait for scroll to complete
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const result = await this.capturePageScreenshot(client, options);

            return result;
        } finally {
            // Restore original scroll position
            const original = scrollPosition.result.value;
            await client.Runtime.evaluate({
                expression: `window.scrollTo(${original.x}, ${original.y})`
            });
        }
    }
}

module.exports = BrowserScreenshotTool;
