const ToolBase = require('../base/ToolBase');
const browserService = require('../../services/browserService');

/**
 * Enhanced Browser Navigate Tool
 * Navigates a specific browser instance to a given URL with history navigation support
 * Inspired by Playwright MCP navigate capabilities
 */
class BrowserNavigateTool extends ToolBase {
    static definition = {
        name: "browser_navigate",
        description: "Navigate browser pages with full history support including go to URL, back, forward, and refresh operations.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance to navigate." 
                },
                action: {
                    type: "string",
                    enum: ["goto", "back", "forward", "refresh", "reload"],
                    default: "goto",
                    description: "Navigation action to perform"
                },
                url: { 
                    type: "string", 
                    description: "The URL to navigate to (required for 'goto' action). Must include protocol (http:// or https://)." 
                },
                waitForNavigation: {
                    type: "boolean",
                    default: true,
                    description: "Whether to wait for navigation to complete"
                },
                timeout: {
                    type: "number",
                    default: 30000,
                    description: "Navigation timeout in milliseconds"
                }
            },
            required: ["browserId"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the navigation was successful" },
                action: { type: "string", description: "The navigation action that was performed" },
                message: { type: "string", description: "Confirmation message of the navigation result" },
                url: { type: "string", description: "The current URL after navigation" },
                previousUrl: { type: "string", description: "The previous URL (for back/forward actions)" },
                canGoBack: { type: "boolean", description: "Whether browser can navigate back" },
                canGoForward: { type: "boolean", description: "Whether browser can navigate forward" },
                browserId: { type: "string", description: "The browser instance ID that was used" }
            },
            required: ["success", "action", "message", "browserId"]
        }
    };

    async execute(parameters) {
        const { 
            browserId, 
            action = "goto", 
            url, 
            waitForNavigation = true, 
            timeout = 30000 
        } = parameters;

        // Validate required parameters
        if (action === "goto" && !url) {
            throw new Error("URL is required for 'goto' action");
        }

        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            throw new Error("URL must include protocol (http:// or https://)");
        }

        const browser = browserService.getBrowser(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found. Please launch a browser first using browser_launch.`);
        }

        const client = browser.client;
        
        console.error(`[BrowserNavigateTool] Performing ${action} action on browser ${browserId}`);

        try {
            let result = {
                success: false,
                action: action,
                browserId: browserId
            };

            // Get current URL and navigation state before action
            const currentInfo = await this.getCurrentNavigationState(client);

            switch (action) {
                case 'goto':
                    await this.performGoto(client, url, waitForNavigation, timeout);
                    result.success = true;
                    result.message = `Successfully navigated to ${url}`;
                    result.url = url;
                    result.previousUrl = currentInfo.url;
                    break;

                case 'back':
                    if (!currentInfo.canGoBack) {
                        throw new Error("Cannot go back - no previous page in history");
                    }
                    await this.performBack(client, waitForNavigation);
                    const backInfo = await this.getCurrentNavigationState(client);
                    result.success = true;
                    result.message = "Successfully navigated back";
                    result.url = backInfo.url;
                    result.previousUrl = currentInfo.url;
                    break;

                case 'forward':
                    if (!currentInfo.canGoForward) {
                        throw new Error("Cannot go forward - no next page in history");
                    }
                    await this.performForward(client, waitForNavigation);
                    const forwardInfo = await this.getCurrentNavigationState(client);
                    result.success = true;
                    result.message = "Successfully navigated forward";
                    result.url = forwardInfo.url;
                    result.previousUrl = currentInfo.url;
                    break;

                case 'refresh':
                case 'reload':
                    await this.performRefresh(client, waitForNavigation);
                    result.success = true;
                    result.message = "Successfully refreshed page";
                    result.url = currentInfo.url;
                    break;

                default:
                    throw new Error(`Unsupported navigation action: ${action}`);
            }

            // Get final navigation state
            const finalInfo = await this.getCurrentNavigationState(client);
            result.canGoBack = finalInfo.canGoBack;
            result.canGoForward = finalInfo.canGoForward;
            
            if (!result.url) {
                result.url = finalInfo.url;
            }

            console.error(`[BrowserNavigateTool] Successfully completed ${action} action`);
            return result;
            
        } catch (error) {
            console.error(`[BrowserNavigateTool] Navigation failed:`, error.message);
            throw new Error(`Failed to perform ${action}: ${error.message}`);
        }
    }

    /**
     * Navigate to a specific URL
     */
    async performGoto(client, url, waitForNavigation, timeout) {
        await client.Page.enable();
        
        if (waitForNavigation) {
            // Set up navigation promise
            const navigationPromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Navigation timeout after ${timeout}ms`));
                }, timeout);

                client.Page.loadEventFired(() => {
                    clearTimeout(timeoutId);
                    resolve();
                });
            });

            // Navigate and wait
            await client.Page.navigate({ url });
            await navigationPromise;
        } else {
            await client.Page.navigate({ url });
        }
    }

    /**
     * Navigate back in history
     */
    async performBack(client, waitForNavigation) {
        const history = await client.Page.getNavigationHistory();
        
        if (history.currentIndex > 0) {
            const previousEntry = history.entries[history.currentIndex - 1];
            
            if (waitForNavigation) {
                const navigationPromise = new Promise((resolve) => {
                    client.Page.loadEventFired(resolve);
                });
                
                await client.Page.navigateToHistoryEntry({ entryId: previousEntry.id });
                await navigationPromise;
            } else {
                await client.Page.navigateToHistoryEntry({ entryId: previousEntry.id });
            }
        }
    }

    /**
     * Navigate forward in history
     */
    async performForward(client, waitForNavigation) {
        const history = await client.Page.getNavigationHistory();
        
        if (history.currentIndex < history.entries.length - 1) {
            const nextEntry = history.entries[history.currentIndex + 1];
            
            if (waitForNavigation) {
                const navigationPromise = new Promise((resolve) => {
                    client.Page.loadEventFired(resolve);
                });
                
                await client.Page.navigateToHistoryEntry({ entryId: nextEntry.id });
                await navigationPromise;
            } else {
                await client.Page.navigateToHistoryEntry({ entryId: nextEntry.id });
            }
        }
    }

    /**
     * Refresh/reload the current page
     */
    async performRefresh(client, waitForNavigation) {
        if (waitForNavigation) {
            const navigationPromise = new Promise((resolve) => {
                client.Page.loadEventFired(resolve);
            });
            
            await client.Page.reload();
            await navigationPromise;
        } else {
            await client.Page.reload();
        }
    }

    /**
     * Get current navigation state
     */
    async getCurrentNavigationState(client) {
        await client.Page.enable();
        
        // Get current URL
        const urlResult = await client.Runtime.evaluate({
            expression: 'window.location.href'
        });
        
        // Get navigation history
        const history = await client.Page.getNavigationHistory();
        
        return {
            url: urlResult.result.value,
            canGoBack: history.currentIndex > 0,
            canGoForward: history.currentIndex < history.entries.length - 1,
            historyLength: history.entries.length,
            currentIndex: history.currentIndex
        };
    }
}

module.exports = BrowserNavigateTool;
