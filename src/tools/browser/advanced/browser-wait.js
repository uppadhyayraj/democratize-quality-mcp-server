const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');

/**
 * Enhanced Wait Tool - Provides sophisticated waiting strategies
 * Inspired by Playwright MCP wait capabilities
 */
class BrowserWaitTool extends ToolBase {
    static definition = {
        name: "browser_wait",
        description: "Wait for various conditions including elements, text, network requests, or time delays. Supports complex waiting scenarios.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                condition: {
                    type: "string",
                    enum: ["time", "element", "text", "textGone", "url", "networkIdle", "domContentLoaded", "load"],
                    description: "The condition to wait for"
                },
                value: {
                    type: "string",
                    description: "Value for the condition (selector for element, text content, URL pattern, etc.)"
                },
                timeout: {
                    type: "number",
                    default: 30000,
                    description: "Maximum wait time in milliseconds"
                },
                time: {
                    type: "number",
                    description: "Time to wait in seconds (for 'time' condition)"
                },
                state: {
                    type: "string",
                    enum: ["visible", "hidden", "attached", "detached"],
                    default: "visible",
                    description: "Element state to wait for (for 'element' condition)"
                },
                networkIdleTime: {
                    type: "number",
                    default: 500,
                    description: "Time in ms to consider network idle (no requests for this duration)"
                }
            },
            required: ["browserId", "condition"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the wait condition was met" },
                condition: { type: "string", description: "The condition that was waited for" },
                value: { type: "string", description: "The value/selector that was waited for" },
                actualValue: { type: "string", description: "The actual value found (for text conditions)" },
                waitTime: { type: "number", description: "Actual time waited in milliseconds" },
                timedOut: { type: "boolean", description: "Whether the wait timed out" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "condition", "browserId"]
        }
    };

    async execute(parameters) {
        const { 
            browserId, 
            condition, 
            value, 
            timeout = 30000, 
            time, 
            state = 'visible',
            networkIdleTime = 500
        } = parameters;
        
        const browser = browserService.getBrowserInstance(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found`);
        }

        const client = browser.client;
        const startTime = Date.now();
        
        let result = {
            success: false,
            condition: condition,
            browserId: browserId,
            waitTime: 0,
            timedOut: false
        };

        try {
            switch (condition) {
                case 'time':
                    if (!time) {
                        throw new Error('Time value is required for time condition');
                    }
                    await this.waitForTime(time * 1000);
                    result.success = true;
                    result.value = `${time} seconds`;
                    break;
                    
                case 'element':
                    if (!value) {
                        throw new Error('Selector is required for element condition');
                    }
                    const elementResult = await this.waitForElement(client, value, state, timeout);
                    result.success = elementResult.found;
                    result.value = value;
                    result.state = state;
                    break;
                    
                case 'text':
                    if (!value) {
                        throw new Error('Text is required for text condition');
                    }
                    const textResult = await this.waitForText(client, value, true, timeout);
                    result.success = textResult.found;
                    result.value = value;
                    result.actualValue = textResult.actualText;
                    break;
                    
                case 'textGone':
                    if (!value) {
                        throw new Error('Text is required for textGone condition');
                    }
                    const textGoneResult = await this.waitForText(client, value, false, timeout);
                    result.success = textGoneResult.found;
                    result.value = value;
                    break;
                    
                case 'url':
                    if (!value) {
                        throw new Error('URL pattern is required for url condition');
                    }
                    const urlResult = await this.waitForUrl(client, value, timeout);
                    result.success = urlResult.found;
                    result.value = value;
                    result.actualValue = urlResult.actualUrl;
                    break;
                    
                case 'networkIdle':
                    const networkResult = await this.waitForNetworkIdle(client, networkIdleTime, timeout);
                    result.success = networkResult.idle;
                    result.value = `${networkIdleTime}ms idle`;
                    break;
                    
                case 'domContentLoaded':
                    const domResult = await this.waitForDOMContentLoaded(client, timeout);
                    result.success = domResult.loaded;
                    break;
                    
                case 'load':
                    const loadResult = await this.waitForLoad(client, timeout);
                    result.success = loadResult.loaded;
                    break;
                    
                default:
                    throw new Error(`Unsupported wait condition: ${condition}`);
            }
        } catch (error) {
            if (error.message.includes('timeout')) {
                result.timedOut = true;
            } else {
                throw error;
            }
        }

        result.waitTime = Date.now() - startTime;
        return result;
    }

    /**
     * Wait for a specific amount of time
     */
    async waitForTime(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    /**
     * Wait for element to be in specified state
     */
    async waitForElement(client, selector, state, timeout) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const result = await client.Runtime.evaluate({
                expression: `
                    (() => {
                        const element = document.querySelector('${selector}');
                        if (!element) return { exists: false };
                        
                        const rect = element.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && 
                                         window.getComputedStyle(element).visibility !== 'hidden' &&
                                         window.getComputedStyle(element).display !== 'none';
                        
                        return {
                            exists: true,
                            visible: isVisible,
                            attached: element.isConnected
                        };
                    })()
                `
            });
            
            const elementData = result.result.value;
            
            if (!elementData) {
                if (state === 'detached') return { found: true };
                await this.waitForTime(100);
                continue;
            }
            
            switch (state) {
                case 'visible':
                    if (elementData.exists && elementData.visible) return { found: true };
                    break;
                case 'hidden':
                    if (elementData.exists && !elementData.visible) return { found: true };
                    break;
                case 'attached':
                    if (elementData.exists && elementData.attached) return { found: true };
                    break;
                case 'detached':
                    if (!elementData.exists || !elementData.attached) return { found: true };
                    break;
            }
            
            await this.waitForTime(100);
        }
        
        throw new Error(`Timeout waiting for element '${selector}' to be ${state}`);
    }

    /**
     * Wait for text to appear or disappear
     */
    async waitForText(client, text, shouldAppear, timeout) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const result = await client.Runtime.evaluate({
                expression: `
                    (() => {
                        const bodyText = document.body.innerText || document.body.textContent || '';
                        const found = bodyText.includes('${text}');
                        return { found: found, bodyText: bodyText.substring(0, 500) };
                    })()
                `
            });
            
            const textData = result.result.value;
            
            if (shouldAppear && textData.found) {
                return { found: true, actualText: text };
            } else if (!shouldAppear && !textData.found) {
                return { found: true };
            }
            
            await this.waitForTime(100);
        }
        
        const condition = shouldAppear ? 'appear' : 'disappear';
        throw new Error(`Timeout waiting for text '${text}' to ${condition}`);
    }

    /**
     * Wait for URL to match pattern
     */
    async waitForUrl(client, urlPattern, timeout) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const result = await client.Runtime.evaluate({
                expression: 'window.location.href'
            });
            
            const currentUrl = result.result.value;
            const regex = new RegExp(urlPattern);
            
            if (regex.test(currentUrl)) {
                return { found: true, actualUrl: currentUrl };
            }
            
            await this.waitForTime(100);
        }
        
        throw new Error(`Timeout waiting for URL to match pattern '${urlPattern}'`);
    }

    /**
     * Wait for network to be idle
     */
    async waitForNetworkIdle(client, idleTime, timeout) {
        // Enable network monitoring
        await client.Network.enable();
        
        let requestCount = 0;
        let lastRequestTime = Date.now();
        
        const requestStarted = () => {
            requestCount++;
            lastRequestTime = Date.now();
        };
        
        const requestFinished = () => {
            requestCount--;
            lastRequestTime = Date.now();
        };
        
        client.Network.requestWillBeSent(requestStarted);
        client.Network.responseReceived(requestFinished);
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const timeSinceLastRequest = Date.now() - lastRequestTime;
            
            if (requestCount === 0 && timeSinceLastRequest >= idleTime) {
                return { idle: true };
            }
            
            await this.waitForTime(100);
        }
        
        throw new Error(`Timeout waiting for network idle (${idleTime}ms)`);
    }

    /**
     * Wait for DOM content loaded
     */
    async waitForDOMContentLoaded(client, timeout) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const result = await client.Runtime.evaluate({
                expression: 'document.readyState'
            });
            
            const readyState = result.result.value;
            
            if (readyState === 'interactive' || readyState === 'complete') {
                return { loaded: true };
            }
            
            await this.waitForTime(100);
        }
        
        throw new Error('Timeout waiting for DOM content loaded');
    }

    /**
     * Wait for page load complete
     */
    async waitForLoad(client, timeout) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const result = await client.Runtime.evaluate({
                expression: 'document.readyState'
            });
            
            const readyState = result.result.value;
            
            if (readyState === 'complete') {
                return { loaded: true };
            }
            
            await this.waitForTime(100);
        }
        
        throw new Error('Timeout waiting for page load complete');
    }
}

module.exports = BrowserWaitTool;
