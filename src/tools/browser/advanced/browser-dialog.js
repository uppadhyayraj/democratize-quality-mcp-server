const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');

/**
 * Dialog Tool - Handle browser dialogs (alert, confirm, prompt)
 * Inspired by Playwright MCP dialog capabilities
 */
class BrowserDialogTool extends ToolBase {
    static definition = {
        name: "browser_dialog",
        description: "Handle browser dialogs including alert, confirm, and prompt dialogs with automatic detection and response.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                action: {
                    type: "string",
                    enum: ["handle", "dismiss", "accept", "getInfo", "setupHandler"],
                    description: "Dialog action to perform"
                },
                accept: {
                    type: "boolean",
                    default: true,
                    description: "Whether to accept or dismiss the dialog (for handle action)"
                },
                promptText: {
                    type: "string",
                    description: "Text to enter in prompt dialogs"
                },
                autoHandle: {
                    type: "boolean",
                    default: false,
                    description: "Whether to automatically handle future dialogs (for setupHandler action)"
                },
                defaultResponse: {
                    type: "object",
                    properties: {
                        accept: { type: "boolean", description: "Default accept/dismiss behavior" },
                        promptText: { type: "string", description: "Default text for prompts" }
                    },
                    description: "Default responses for auto-handling dialogs"
                }
            },
            required: ["browserId", "action"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the operation was successful" },
                action: { type: "string", description: "The action that was performed" },
                dialog: {
                    type: "object",
                    properties: {
                        type: { type: "string" },
                        message: { type: "string" },
                        defaultValue: { type: "string" },
                        handled: { type: "boolean" },
                        response: { type: "string" }
                    },
                    description: "Dialog information"
                },
                autoHandling: { type: "boolean", description: "Whether auto-handling is enabled" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "action", "browserId"]
        }
    };

    constructor() {
        super();
        this.dialogStates = new Map(); // browserId -> dialog state
        this.autoHandlers = new Map(); // browserId -> auto-handler config
    }

    async execute(parameters) {
        const { 
            browserId, 
            action, 
            accept = true, 
            promptText, 
            autoHandle = false,
            defaultResponse = {}
        } = parameters;
        
        const browser = browserService.getBrowser(browserId);
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
            case 'setupHandler':
                await this.setupDialogHandler(client, browserId, autoHandle, defaultResponse);
                result.success = true;
                result.autoHandling = autoHandle;
                result.message = autoHandle ? 'Auto dialog handling enabled' : 'Dialog monitoring enabled';
                break;
                
            case 'handle':
                const handleResult = await this.handleDialog(browserId, accept, promptText);
                result.success = true;
                result.dialog = handleResult;
                result.message = 'Dialog handled';
                break;
                
            case 'accept':
                const acceptResult = await this.handleDialog(browserId, true, promptText);
                result.success = true;
                result.dialog = acceptResult;
                result.message = 'Dialog accepted';
                break;
                
            case 'dismiss':
                const dismissResult = await this.handleDialog(browserId, false);
                result.success = true;
                result.dialog = dismissResult;
                result.message = 'Dialog dismissed';
                break;
                
            case 'getInfo':
                const dialogInfo = this.getDialogInfo(browserId);
                result.success = true;
                result.dialog = dialogInfo.dialog;
                result.autoHandling = dialogInfo.autoHandling;
                break;
                
            default:
                throw new Error(`Unsupported dialog action: ${action}`);
        }

        return result;
    }

    /**
     * Setup dialog handler with auto-handling capability
     */
    async setupDialogHandler(client, browserId, autoHandle, defaultResponse) {
        // Enable Page domain for dialog events
        await client.Page.enable();
        
        // Store auto-handler configuration
        if (autoHandle) {
            this.autoHandlers.set(browserId, {
                enabled: true,
                accept: defaultResponse.accept !== undefined ? defaultResponse.accept : true,
                promptText: defaultResponse.promptText || ''
            });
        } else {
            this.autoHandlers.delete(browserId);
        }

        // Set up dialog event listener
        client.Page.javascriptDialogOpening((params) => {
            const dialogInfo = {
                type: params.type,
                message: params.message,
                defaultValue: params.defaultPrompt || '',
                timestamp: new Date().toISOString(),
                handled: false
            };
            
            this.dialogStates.set(browserId, dialogInfo);
            
            // Auto-handle if configured
            const autoHandler = this.autoHandlers.get(browserId);
            if (autoHandler && autoHandler.enabled) {
                setTimeout(async () => {
                    try {
                        await this.handleDialog(
                            browserId, 
                            autoHandler.accept, 
                            params.type === 'prompt' ? autoHandler.promptText : undefined
                        );
                    } catch (error) {
                        console.error(`[Dialog] Auto-handle failed for ${browserId}:`, error.message);
                    }
                }, 100); // Small delay to ensure dialog is fully loaded
            }
        });

        client.Page.javascriptDialogClosed(() => {
            const dialogState = this.dialogStates.get(browserId);
            if (dialogState) {
                dialogState.handled = true;
                dialogState.closedAt = new Date().toISOString();
            }
        });
    }

    /**
     * Handle an active dialog
     */
    async handleDialog(browserId, accept, promptText) {
        const browser = browserService.getBrowser(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found`);
        }

        const dialogState = this.dialogStates.get(browserId);
        if (!dialogState) {
            throw new Error('No active dialog found');
        }

        if (dialogState.handled) {
            throw new Error('Dialog has already been handled');
        }

        const client = browser.client;
        
        try {
            // Handle the dialog
            await client.Page.handleJavaScriptDialog({
                accept: accept,
                promptText: dialogState.type === 'prompt' ? (promptText || '') : undefined
            });
            
            // Update dialog state
            dialogState.handled = true;
            dialogState.response = accept ? 'accepted' : 'dismissed';
            dialogState.promptText = promptText;
            dialogState.handledAt = new Date().toISOString();
            
            return dialogState;
        } catch (error) {
            throw new Error(`Failed to handle dialog: ${error.message}`);
        }
    }

    /**
     * Get information about current dialog state
     */
    getDialogInfo(browserId) {
        const dialogState = this.dialogStates.get(browserId);
        const autoHandler = this.autoHandlers.get(browserId);
        
        return {
            dialog: dialogState || null,
            autoHandling: autoHandler?.enabled || false,
            autoConfig: autoHandler || null
        };
    }

    /**
     * Wait for a dialog to appear
     */
    async waitForDialog(browserId, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Dialog wait timeout after ${timeout}ms`));
            }, timeout);

            const checkDialog = () => {
                const dialogState = this.dialogStates.get(browserId);
                if (dialogState && !dialogState.handled) {
                    clearTimeout(timeoutId);
                    resolve(dialogState);
                } else {
                    setTimeout(checkDialog, 100);
                }
            };

            checkDialog();
        });
    }

    /**
     * Clear dialog state
     */
    clearDialogState(browserId) {
        this.dialogStates.delete(browserId);
    }

    /**
     * Get dialog history
     */
    getDialogHistory(browserId) {
        // In a real implementation, you might store a history of dialogs
        const currentDialog = this.dialogStates.get(browserId);
        return currentDialog ? [currentDialog] : [];
    }

    /**
     * Setup custom dialog responses for testing
     */
    setupTestDialogResponses(browserId, responses) {
        // Store custom responses for different dialog types
        this.autoHandlers.set(browserId, {
            enabled: true,
            customResponses: responses
        });
    }

    /**
     * Inject dialog trigger for testing
     */
    async triggerTestDialog(client, type = 'alert', message = 'Test dialog') {
        const expressions = {
            alert: `alert('${message}')`,
            confirm: `confirm('${message}')`,
            prompt: `prompt('${message}', 'default value')`
        };

        return await client.Runtime.evaluate({
            expression: expressions[type] || expressions.alert
        });
    }
}

module.exports = BrowserDialogTool;
