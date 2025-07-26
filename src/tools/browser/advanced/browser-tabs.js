const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');

/**
 * Enhanced Tabs Tool - Comprehensive tab management
 * Inspired by Playwright MCP tabs capabilities  
 */
class BrowserTabsTool extends ToolBase {
    static definition = {
        name: "browser_tabs",
        description: "Manage browser tabs - create, close, switch, list, and organize tabs with advanced features.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                action: {
                    type: "string",
                    enum: ["list", "create", "close", "switch", "duplicate", "pin", "unpin", "mute", "unmute", "refresh", "goBack", "goForward"],
                    description: "The tab action to perform"
                },
                tabId: {
                    type: "string",
                    description: "The ID of the tab (for close, switch, duplicate, pin, mute, refresh, etc.)"
                },
                url: {
                    type: "string",
                    description: "URL to open in new tab (for create action)"
                },
                title: {
                    type: "string",
                    description: "Title filter for finding tabs (supports partial matching)"
                },
                active: {
                    type: "boolean",
                    description: "Whether to make the tab active (for create and switch actions)"
                },
                windowId: {
                    type: "string",
                    description: "Window ID for tab operations"
                },
                pattern: {
                    type: "string", 
                    description: "URL pattern to match tabs (regex supported)"
                },
                includeDetails: {
                    type: "boolean",
                    default: false,
                    description: "Include detailed tab information (for list action)"
                }
            },
            required: ["browserId", "action"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the operation was successful" },
                action: { type: "string", description: "The action that was performed" },
                tabs: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            url: { type: "string" },
                            title: { type: "string" },
                            active: { type: "boolean" },
                            pinned: { type: "boolean" },
                            muted: { type: "boolean" },
                            windowId: { type: "string" },
                            status: { type: "string" }
                        }
                    },
                    description: "List of tabs"
                },
                tabId: { type: "string", description: "ID of the affected tab" },
                message: { type: "string", description: "Operation result message" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "action", "browserId"]
        }
    };

    async execute(parameters) {
        const { 
            browserId, 
            action, 
            tabId, 
            url, 
            title, 
            active = true,
            windowId,
            pattern,
            includeDetails = false
        } = parameters;
        
        const browser = browserService.getBrowserInstance(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found`);
        }

        const client = browser.client;
        
        let result = {
            success: false,
            action: action,
            browserId: browserId
        };

        switch (action) {
            case 'list':
                const tabs = await this.listTabs(client, title, pattern, includeDetails);
                result.success = true;
                result.tabs = tabs;
                break;
                
            case 'create':
                if (!url) {
                    throw new Error('URL is required for create action');
                }
                const newTab = await this.createTab(client, url, active);
                result.success = true;
                result.tabId = newTab.targetId;
                result.message = `Tab created with ID: ${newTab.targetId}`;
                result.tabs = [newTab];
                break;
                
            case 'close':
                if (!tabId) {
                    throw new Error('Tab ID is required for close action');
                }
                await this.closeTab(client, tabId);
                result.success = true;
                result.tabId = tabId;
                result.message = `Tab ${tabId} closed`;
                break;
                
            case 'switch':
                if (!tabId) {
                    throw new Error('Tab ID is required for switch action');
                }
                await this.switchToTab(client, tabId);
                result.success = true;
                result.tabId = tabId;
                result.message = `Switched to tab ${tabId}`;
                break;
                
            case 'duplicate':
                if (!tabId) {
                    throw new Error('Tab ID is required for duplicate action');
                }
                const duplicatedTab = await this.duplicateTab(client, tabId);
                result.success = true;
                result.tabId = duplicatedTab.targetId;
                result.message = `Tab duplicated with ID: ${duplicatedTab.targetId}`;
                result.tabs = [duplicatedTab];
                break;
                
            case 'refresh':
                if (!tabId) {
                    throw new Error('Tab ID is required for refresh action');
                }
                await this.refreshTab(client, tabId);
                result.success = true;
                result.tabId = tabId;
                result.message = `Tab ${tabId} refreshed`;
                break;
                
            case 'goBack':
                if (!tabId) {
                    throw new Error('Tab ID is required for goBack action');
                }
                await this.goBack(client, tabId);
                result.success = true;
                result.tabId = tabId;
                result.message = `Navigated back in tab ${tabId}`;
                break;
                
            case 'goForward':
                if (!tabId) {
                    throw new Error('Tab ID is required for goForward action');
                }
                await this.goForward(client, tabId);
                result.success = true;
                result.tabId = tabId;
                result.message = `Navigated forward in tab ${tabId}`;
                break;
                
            case 'pin':
            case 'unpin':
            case 'mute':
            case 'unmute':
                // These actions would require additional Chrome extension APIs
                // For now, we'll return a message indicating the limitation
                result.success = false;
                result.message = `${action} action requires browser extension capabilities not available via DevTools Protocol`;
                break;
                
            default:
                throw new Error(`Unsupported tabs action: ${action}`);
        }

        return result;
    }

    /**
     * List all tabs with optional filtering
     */
    async listTabs(client, titleFilter, urlPattern, includeDetails) {
        const targets = await client.Target.getTargets();
        const tabs = targets.targetInfos
            .filter(target => target.type === 'page')
            .map(target => this.formatTabInfo(target, includeDetails));

        let filteredTabs = tabs;

        // Apply title filter
        if (titleFilter) {
            filteredTabs = filteredTabs.filter(tab => 
                tab.title && tab.title.toLowerCase().includes(titleFilter.toLowerCase())
            );
        }

        // Apply URL pattern filter
        if (urlPattern) {
            const regex = new RegExp(urlPattern, 'i');
            filteredTabs = filteredTabs.filter(tab => 
                tab.url && regex.test(tab.url)
            );
        }

        // Get additional details if requested
        if (includeDetails) {
            for (const tab of filteredTabs) {
                try {
                    const runtime = await client.Runtime.evaluate({
                        expression: `({
                            readyState: document.readyState,
                            visibilityState: document.visibilityState,
                            hasFocus: document.hasFocus(),
                            scrollPosition: { x: window.scrollX, y: window.scrollY },
                            windowSize: { width: window.innerWidth, height: window.innerHeight }
                        })`,
                        contextId: undefined,
                        targetId: tab.id
                    });
                    
                    if (runtime.result && runtime.result.value) {
                        tab.details = runtime.result.value;
                    }
                } catch (error) {
                    // Ignore errors for inactive tabs
                    tab.details = { error: 'Could not retrieve details' };
                }
            }
        }

        return filteredTabs;
    }

    /**
     * Create a new tab
     */
    async createTab(client, url, makeActive = true) {
        const target = await client.Target.createTarget({
            url: url,
            newWindow: false
        });

        if (makeActive) {
            await this.switchToTab(client, target.targetId);
        }

        // Get updated tab info
        const targets = await client.Target.getTargets();
        const tabInfo = targets.targetInfos.find(t => t.targetId === target.targetId);
        
        return this.formatTabInfo(tabInfo);
    }

    /**
     * Close a tab
     */
    async closeTab(client, tabId) {
        await client.Target.closeTarget({
            targetId: tabId
        });
    }

    /**
     * Switch to a specific tab
     */
    async switchToTab(client, tabId) {
        await client.Target.activateTarget({
            targetId: tabId
        });
    }

    /**
     * Duplicate a tab
     */
    async duplicateTab(client, tabId) {
        // Get the URL of the tab to duplicate
        const targets = await client.Target.getTargets();
        const sourceTab = targets.targetInfos.find(t => t.targetId === tabId);
        
        if (!sourceTab) {
            throw new Error(`Tab with ID ${tabId} not found`);
        }

        // Create new tab with same URL
        return this.createTab(client, sourceTab.url, false);
    }

    /**
     * Refresh a tab
     */
    async refreshTab(client, tabId) {
        // First, attach to the target
        const session = await client.Target.attachToTarget({
            targetId: tabId,
            flatten: true
        });

        // Use the session to reload the page
        await client.Page.reload({
            sessionId: session.sessionId
        });

        // Detach from the target
        await client.Target.detachFromTarget({
            sessionId: session.sessionId
        });
    }

    /**
     * Navigate back in tab history
     */
    async goBack(client, tabId) {
        const session = await client.Target.attachToTarget({
            targetId: tabId,
            flatten: true
        });

        const history = await client.Page.getNavigationHistory({
            sessionId: session.sessionId
        });

        if (history.currentIndex > 0) {
            await client.Page.navigateToHistoryEntry({
                entryId: history.entries[history.currentIndex - 1].id,
                sessionId: session.sessionId
            });
        }

        await client.Target.detachFromTarget({
            sessionId: session.sessionId
        });
    }

    /**
     * Navigate forward in tab history
     */
    async goForward(client, tabId) {
        const session = await client.Target.attachToTarget({
            targetId: tabId,
            flatten: true
        });

        const history = await client.Page.getNavigationHistory({
            sessionId: session.sessionId
        });

        if (history.currentIndex < history.entries.length - 1) {
            await client.Page.navigateToHistoryEntry({
                entryId: history.entries[history.currentIndex + 1].id,
                sessionId: session.sessionId
            });
        }

        await client.Target.detachFromTarget({
            sessionId: session.sessionId
        });
    }

    /**
     * Format tab information for output
     */
    formatTabInfo(target, includeDetails = false) {
        const formatted = {
            id: target.targetId,
            url: target.url,
            title: target.title,
            type: target.type,
            attached: target.attached || false
        };

        // Add browser context info if available
        if (target.browserContextId) {
            formatted.browserContextId = target.browserContextId;
        }

        // Add opener info if available
        if (target.openerId) {
            formatted.openerId = target.openerId;
        }

        return formatted;
    }

    /**
     * Find tabs by various criteria
     */
    async findTabs(client, criteria = {}) {
        const tabs = await this.listTabs(client, criteria.title, criteria.url, false);
        
        return tabs.filter(tab => {
            let matches = true;
            
            if (criteria.active !== undefined) {
                // Note: We'd need additional logic to determine which tab is currently active
                // This would require tracking focus or using additional CDP calls
            }
            
            if (criteria.url && !tab.url.includes(criteria.url)) {
                matches = false;
            }
            
            if (criteria.title && !tab.title.toLowerCase().includes(criteria.title.toLowerCase())) {
                matches = false;
            }
            
            return matches;
        });
    }

    /**
     * Get detailed information about a specific tab
     */
    async getTabDetails(client, tabId) {
        const targets = await client.Target.getTargets();
        const tab = targets.targetInfos.find(t => t.targetId === tabId);
        
        if (!tab) {
            throw new Error(`Tab with ID ${tabId} not found`);
        }

        const formatted = this.formatTabInfo(tab, true);
        
        try {
            // Try to get runtime information
            const session = await client.Target.attachToTarget({
                targetId: tabId,
                flatten: true
            });

            const runtime = await client.Runtime.evaluate({
                expression: `({
                    readyState: document.readyState,
                    visibilityState: document.visibilityState,
                    hasFocus: document.hasFocus(),
                    location: {
                        href: location.href,
                        protocol: location.protocol,
                        hostname: location.hostname,
                        pathname: location.pathname,
                        search: location.search,
                        hash: location.hash
                    },
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight,
                        scrollX: window.scrollX,
                        scrollY: window.scrollY
                    }
                })`,
                sessionId: session.sessionId
            });
            
            if (runtime.result && runtime.result.value) {
                formatted.runtime = runtime.result.value;
            }

            await client.Target.detachFromTarget({
                sessionId: session.sessionId
            });
        } catch (error) {
            formatted.error = 'Could not retrieve runtime details: ' + error.message;
        }

        return formatted;
    }
}

module.exports = BrowserTabsTool;
