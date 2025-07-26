const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');

/**
 * Console Tool - Monitor and retrieve browser console messages
 * Inspired by Playwright MCP console capabilities
 */
class BrowserConsoleTool extends ToolBase {
    static definition = {
        name: "browser_console",
        description: "Monitor, retrieve, and manage browser console messages including logs, errors, and warnings.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                action: {
                    type: "string",
                    enum: ["get", "clear", "monitor", "stopMonitor"],
                    description: "Console action to perform"
                },
                filter: {
                    type: "object",
                    properties: {
                        level: {
                            type: "string",
                            enum: ["log", "info", "warn", "error", "debug", "trace"],
                            description: "Filter by console message level"
                        },
                        text: {
                            type: "string",
                            description: "Filter messages containing this text"
                        },
                        source: {
                            type: "string",
                            description: "Filter by source URL pattern"
                        }
                    },
                    description: "Filter criteria for console messages"
                },
                limit: {
                    type: "number",
                    default: 100,
                    description: "Maximum number of messages to return"
                },
                realTime: {
                    type: "boolean",
                    default: false,
                    description: "Whether to return real-time console monitoring (for monitor action)"
                }
            },
            required: ["browserId", "action"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the operation was successful" },
                action: { type: "string", description: "The action that was performed" },
                messages: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            level: { type: "string" },
                            text: { type: "string" },
                            url: { type: "string" },
                            lineNumber: { type: "number" },
                            timestamp: { type: "string" },
                            args: { type: "array" },
                            stackTrace: { type: "array" }
                        }
                    },
                    description: "Array of console messages"
                },
                summary: {
                    type: "object",
                    properties: {
                        total: { type: "number" },
                        errors: { type: "number" },
                        warnings: { type: "number" },
                        logs: { type: "number" }
                    },
                    description: "Summary of console messages"
                },
                monitoring: { type: "boolean", description: "Whether console monitoring is active" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "action", "browserId"]
        }
    };

    constructor() {
        super();
        this.consoleData = new Map(); // browserId -> console messages
        this.monitoring = new Map(); // browserId -> monitoring state
    }

    async execute(parameters) {
        const { 
            browserId, 
            action, 
            filter = {}, 
            limit = 100, 
            realTime = false 
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
            case 'monitor':
                await this.startConsoleMonitoring(client, browserId, realTime);
                result.success = true;
                result.monitoring = true;
                result.message = 'Console monitoring started';
                break;
                
            case 'stopMonitor':
                this.stopConsoleMonitoring(browserId);
                result.success = true;
                result.monitoring = false;
                result.message = 'Console monitoring stopped';
                break;
                
            case 'get':
                const messages = this.getConsoleMessages(browserId, filter, limit);
                result.success = true;
                result.messages = messages.messages;
                result.summary = messages.summary;
                result.monitoring = this.monitoring.has(browserId);
                break;
                
            case 'clear':
                this.clearConsoleMessages(browserId);
                result.success = true;
                result.message = 'Console messages cleared';
                result.monitoring = this.monitoring.has(browserId);
                break;
                
            default:
                throw new Error(`Unsupported console action: ${action}`);
        }

        return result;
    }

    /**
     * Start monitoring console messages
     */
    async startConsoleMonitoring(client, browserId, realTime = false) {
        // Enable Runtime domain for console events
        await client.Runtime.enable();
        
        // Initialize storage
        if (!this.consoleData.has(browserId)) {
            this.consoleData.set(browserId, []);
        }

        const consoleMessages = this.consoleData.get(browserId);
        
        // Set up console event listener
        const consoleListener = (params) => {
            const message = this.formatConsoleMessage(params);
            consoleMessages.push(message);
            
            // Keep only last 1000 messages to prevent memory issues
            if (consoleMessages.length > 1000) {
                consoleMessages.splice(0, consoleMessages.length - 1000);
            }
            
            if (realTime) {
                console.log(`[Console:${browserId}] ${message.level.toUpperCase()}: ${message.text}`);
            }
        };

        client.Runtime.consoleAPICalled(consoleListener);
        
        // Also listen for runtime exceptions
        const exceptionListener = (params) => {
            const message = this.formatExceptionMessage(params);
            consoleMessages.push(message);
            
            if (realTime) {
                console.log(`[Console:${browserId}] ERROR: ${message.text}`);
            }
        };

        client.Runtime.exceptionThrown(exceptionListener);
        
        // Store monitoring state
        this.monitoring.set(browserId, {
            consoleListener,
            exceptionListener,
            startTime: Date.now()
        });
    }

    /**
     * Stop monitoring console messages
     */
    stopConsoleMonitoring(browserId) {
        this.monitoring.delete(browserId);
    }

    /**
     * Get console messages with filtering
     */
    getConsoleMessages(browserId, filter, limit) {
        const allMessages = this.consoleData.get(browserId) || [];
        
        let filteredMessages = [...allMessages];
        
        // Apply filters
        if (filter.level) {
            filteredMessages = filteredMessages.filter(msg => msg.level === filter.level);
        }
        
        if (filter.text) {
            const searchText = filter.text.toLowerCase();
            filteredMessages = filteredMessages.filter(msg => 
                msg.text.toLowerCase().includes(searchText)
            );
        }
        
        if (filter.source) {
            const sourceRegex = new RegExp(filter.source, 'i');
            filteredMessages = filteredMessages.filter(msg => 
                msg.url && sourceRegex.test(msg.url)
            );
        }
        
        // Limit results
        const messages = filteredMessages.slice(-limit);
        
        // Create summary
        const summary = this.createMessageSummary(filteredMessages);
        
        return { messages, summary };
    }

    /**
     * Clear console messages
     */
    clearConsoleMessages(browserId) {
        this.consoleData.set(browserId, []);
    }

    /**
     * Format console API message
     */
    formatConsoleMessage(params) {
        const level = params.type || 'log';
        const timestamp = new Date().toISOString();
        
        // Extract text from console arguments
        let text = '';
        const args = [];
        
        if (params.args) {
            for (const arg of params.args) {
                if (arg.value !== undefined) {
                    const value = arg.value;
                    text += String(value) + ' ';
                    args.push(value);
                } else if (arg.description) {
                    text += arg.description + ' ';
                    args.push(arg.description);
                }
            }
        }
        
        return {
            level: level,
            text: text.trim(),
            timestamp: timestamp,
            args: args,
            url: params.executionContextId ? 'unknown' : null,
            lineNumber: null,
            stackTrace: params.stackTrace ? this.formatStackTrace(params.stackTrace) : null
        };
    }

    /**
     * Format runtime exception message
     */
    formatExceptionMessage(params) {
        const timestamp = new Date().toISOString();
        const exceptionDetails = params.exceptionDetails;
        
        let text = 'Uncaught ';
        if (exceptionDetails.exception?.description) {
            text += exceptionDetails.exception.description;
        } else if (exceptionDetails.text) {
            text += exceptionDetails.text;
        } else {
            text += 'Error';
        }
        
        return {
            level: 'error',
            text: text,
            timestamp: timestamp,
            url: exceptionDetails.url || null,
            lineNumber: exceptionDetails.lineNumber || null,
            columnNumber: exceptionDetails.columnNumber || null,
            stackTrace: exceptionDetails.stackTrace ? this.formatStackTrace(exceptionDetails.stackTrace) : null
        };
    }

    /**
     * Format stack trace
     */
    formatStackTrace(stackTrace) {
        if (!stackTrace.callFrames) return null;
        
        return stackTrace.callFrames.map(frame => ({
            functionName: frame.functionName || '<anonymous>',
            url: frame.url,
            lineNumber: frame.lineNumber,
            columnNumber: frame.columnNumber
        }));
    }

    /**
     * Create message summary
     */
    createMessageSummary(messages) {
        const summary = {
            total: messages.length,
            errors: 0,
            warnings: 0,
            logs: 0,
            info: 0,
            debug: 0
        };
        
        messages.forEach(msg => {
            switch (msg.level) {
                case 'error':
                    summary.errors++;
                    break;
                case 'warn':
                    summary.warnings++;
                    break;
                case 'log':
                    summary.logs++;
                    break;
                case 'info':
                    summary.info++;
                    break;
                case 'debug':
                    summary.debug++;
                    break;
            }
        });
        
        return summary;
    }

    /**
     * Get console monitoring status
     */
    getMonitoringStatus(browserId) {
        return {
            monitoring: this.monitoring.has(browserId),
            messageCount: (this.consoleData.get(browserId) || []).length,
            startTime: this.monitoring.get(browserId)?.startTime
        };
    }
}

module.exports = BrowserConsoleTool;
