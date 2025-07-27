const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Browser Click Tool
 * Simulates a click on a specific element in the browser with Playwright-style locators
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
                locatorType: {
                    type: "string",
                    enum: ["css", "xpath", "text", "role", "label", "placeholder", "testId", "altText"],
                    default: "css",
                    description: "The type of locator to use"
                },
                locatorValue: {
                    type: "string",
                    description: "The locator value (CSS selector, XPath, text content, etc.)"
                },
                // Keep backward compatibility
                selector: {
                    type: "string",
                    description: "The CSS selector of the element to click (deprecated, use locatorType and locatorValue instead)."
                },
                options: {
                    type: "object",
                    properties: {
                        timeout: {
                            type: "number",
                            default: 30000,
                            description: "Timeout in milliseconds"
                        },
                        force: {
                            type: "boolean",
                            default: false,
                            description: "Force click even if element is not actionable"
                        },
                        noWaitAfter: {
                            type: "boolean",
                            default: false,
                            description: "Do not wait for navigation after click"
                        },
                        button: {
                            type: "string",
                            enum: ["left", "right", "middle"],
                            default: "left",
                            description: "Mouse button to click"
                        }
                    },
                    description: "Additional click options"
                }
            },
            anyOf: [
                { required: ["browserId", "locatorType", "locatorValue"] },
                { required: ["browserId", "selector"] }
            ]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Indicates if the click was successful." },
                locatorType: { type: "string", description: "The locator type that was used." },
                locatorValue: { type: "string", description: "The locator value that was used." },
                browserId: { type: "string", description: "The browser instance ID that was used." },
                elementFound: { type: "boolean", description: "Whether the element was found." },
                message: { type: "string", description: "Success or error message." }
            },
            required: ["success", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId, locatorType, locatorValue, selector, options = {} } = parameters;

        // Handle backward compatibility
        let finalLocatorType, finalLocatorValue;
        if (selector) {
            finalLocatorType = "css";
            finalLocatorValue = selector;
        } else {
            finalLocatorType = locatorType || "css";
            finalLocatorValue = locatorValue;
        }

        console.error(`[BrowserClickTool] Simulating click in browser ${browserId} with locator: ${finalLocatorType}="${finalLocatorValue}"`);

        try {
            // Convert Playwright-style locator to appropriate format for browser service
            const elementSelector = this.convertLocatorToSelector(finalLocatorType, finalLocatorValue);
            
            await browserService.clickElement(browserId, elementSelector, options);
            
            console.error(`[BrowserClickTool] Successfully clicked element in browser: ${browserId}`);
            
            return { 
                success: true, 
                browserId: browserId,
                locatorType: finalLocatorType,
                locatorValue: finalLocatorValue,
                elementFound: true,
                message: `Successfully clicked element with ${finalLocatorType} locator: ${finalLocatorValue}`
            };
        } catch (error) {
            console.error(`[BrowserClickTool] Failed to click element:`, error.message);
            
            return {
                success: false,
                browserId: browserId,
                locatorType: finalLocatorType,
                locatorValue: finalLocatorValue,
                elementFound: false,
                message: `Failed to click element: ${error.message}`
            };
        }
    }

    /**
     * Convert Playwright-style locator to CSS selector or XPath
     */
    convertLocatorToSelector(locatorType, locatorValue) {
        switch (locatorType) {
            case "css":
                return locatorValue;
            
            case "xpath":
                return locatorValue;
            
            case "text":
                // Convert text locator to XPath
                return `//*[contains(text(), "${locatorValue}")]`;
            
            case "role":
                // Convert role locator to CSS attribute selector
                return `[role="${locatorValue}"]`;
            
            case "label":
                // Convert label locator to XPath for label association
                return `//input[@aria-label="${locatorValue}"] | //input[@id=//label[contains(text(), "${locatorValue}")]/@for]`;
            
            case "placeholder":
                // Convert placeholder locator to CSS attribute selector
                return `[placeholder="${locatorValue}"]`;
            
            case "testId":
                // Convert test ID to CSS attribute selector (assuming data-testid)
                return `[data-testid="${locatorValue}"]`;
            
            case "altText":
                // Convert alt text to CSS attribute selector
                return `[alt="${locatorValue}"]`;
            
            default:
                // Default to CSS selector
                return locatorValue;
        }
    }
}

module.exports = BrowserClickTool;