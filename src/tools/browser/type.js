const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Browser Type Tool
 * Types text into a specific input field in the browser with Playwright-style locators
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
                text: {
                    type: "string",
                    description: "The text to type into the input field."
                },
                // Keep backward compatibility
                selector: {
                    type: "string",
                    description: "The CSS selector of the input field (deprecated, use locatorType and locatorValue instead)."
                },
                options: {
                    type: "object",
                    properties: {
                        timeout: {
                            type: "number",
                            default: 30000,
                            description: "Timeout in milliseconds"
                        },
                        delay: {
                            type: "number",
                            default: 0,
                            description: "Delay between keystrokes in milliseconds"
                        },
                        clear: {
                            type: "boolean",
                            default: true,
                            description: "Clear the field before typing"
                        },
                        noWaitAfter: {
                            type: "boolean",
                            default: false,
                            description: "Do not wait for navigation after typing"
                        }
                    },
                    description: "Additional typing options"
                }
            },
            anyOf: [
                { required: ["browserId", "locatorType", "locatorValue", "text"] },
                { required: ["browserId", "selector", "text"] }
            ]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Indicates if the typing was successful." },
                locatorType: { type: "string", description: "The locator type that was used." },
                locatorValue: { type: "string", description: "The locator value that was used." },
                text: { type: "string", description: "The text that was typed." },
                browserId: { type: "string", description: "The browser instance ID that was used." },
                elementFound: { type: "boolean", description: "Whether the element was found." },
                message: { type: "string", description: "Success or error message." }
            },
            required: ["success", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId, locatorType, locatorValue, selector, text, options = {} } = parameters;

        // Handle backward compatibility
        let finalLocatorType, finalLocatorValue;
        if (selector) {
            finalLocatorType = "css";
            finalLocatorValue = selector;
        } else {
            finalLocatorType = locatorType || "css";
            finalLocatorValue = locatorValue;
        }

        console.error(`[BrowserTypeTool] Typing in browser ${browserId} with locator: ${finalLocatorType}="${finalLocatorValue}"`);

        try {
            // Convert Playwright-style locator to appropriate format for browser service
            const elementSelector = this.convertLocatorToSelector(finalLocatorType, finalLocatorValue);
            
            await browserService.typeIntoElement(browserId, elementSelector, text, options);
            
            console.error(`[BrowserTypeTool] Successfully typed in browser: ${browserId}`);
            
            return { 
                success: true, 
                browserId: browserId,
                locatorType: finalLocatorType,
                locatorValue: finalLocatorValue,
                text: text,
                elementFound: true,
                message: `Successfully typed "${text}" into element with ${finalLocatorType} locator: ${finalLocatorValue}`
            };
        } catch (error) {
            console.error(`[BrowserTypeTool] Failed to type in element:`, error.message);
            
            return {
                success: false,
                browserId: browserId,
                locatorType: finalLocatorType,
                locatorValue: finalLocatorValue,
                text: text,
                elementFound: false,
                message: `Failed to type into element: ${error.message}`
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
                // Convert text locator to XPath for input elements
                return `//input[contains(@placeholder, "${locatorValue}")] | //input[contains(@value, "${locatorValue}")] | //textarea[contains(text(), "${locatorValue}")] | //label[contains(text(), "${locatorValue}")]/following-sibling::input | //label[contains(text(), "${locatorValue}")]/following::input[1]`;
            
            case "role":
                // Convert role locator to CSS attribute selector
                return `[role="${locatorValue}"]`;
            
            case "label":
                // Convert label locator to XPath for label association
                return `//input[@aria-label="${locatorValue}"] | //input[@id=//label[contains(text(), "${locatorValue}")]/@for] | //label[contains(text(), "${locatorValue}")]/following-sibling::input | //label[contains(text(), "${locatorValue}")]/following::input[1]`;
            
            case "placeholder":
                // Convert placeholder locator to CSS attribute selector
                return `[placeholder="${locatorValue}"]`;
            
            case "testId":
                // Convert test ID to CSS attribute selector (assuming data-testid)
                return `[data-testid="${locatorValue}"]`;
            
            case "altText":
                // Convert alt text to CSS attribute selector (less common for input fields)
                return `[alt="${locatorValue}"]`;
            
            default:
                // Default to CSS selector
                return locatorValue;
        }
    }
}

module.exports = BrowserTypeTool;