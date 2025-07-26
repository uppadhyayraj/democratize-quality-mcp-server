const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');

/**
 * Enhanced Mouse Tool - Provides precise mouse interactions with coordinate support
 * Inspired by Playwright MCP mouse capabilities
 */
class BrowserMouseTool extends ToolBase {
    static definition = {
        name: "browser_mouse",
        description: "Perform mouse actions including clicks, moves, and drags with precise coordinate control. Supports both CSS selectors and direct coordinates.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                action: {
                    type: "string",
                    enum: ["click", "move", "drag", "hover", "rightClick", "doubleClick"],
                    description: "The mouse action to perform"
                },
                target: {
                    type: "object",
                    oneOf: [
                        {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["coordinates"] },
                                x: { type: "number", description: "X coordinate" },
                                y: { type: "number", description: "Y coordinate" }
                            },
                            required: ["type", "x", "y"]
                        },
                        {
                            type: "object", 
                            properties: {
                                type: { type: "string", enum: ["selector"] },
                                selector: { type: "string", description: "CSS selector" },
                                offset: {
                                    type: "object",
                                    properties: {
                                        x: { type: "number", description: "X offset from element center" },
                                        y: { type: "number", description: "Y offset from element center" }
                                    }
                                }
                            },
                            required: ["type", "selector"]
                        }
                    ],
                    description: "Target for the mouse action - either coordinates or CSS selector"
                },
                dragTo: {
                    type: "object",
                    properties: {
                        x: { type: "number", description: "End X coordinate for drag" },
                        y: { type: "number", description: "End Y coordinate for drag" }
                    },
                    description: "End coordinates for drag actions"
                },
                button: {
                    type: "string",
                    enum: ["left", "right", "middle"],
                    default: "left",
                    description: "Mouse button to use"
                },
                modifiers: {
                    type: "array",
                    items: { type: "string", enum: ["ctrl", "shift", "alt", "meta"] },
                    description: "Keyboard modifiers to hold during action"
                }
            },
            required: ["browserId", "action", "target"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the mouse action was successful" },
                action: { type: "string", description: "The action that was performed" },
                coordinates: {
                    type: "object",
                    properties: {
                        x: { type: "number" },
                        y: { type: "number" }
                    },
                    description: "Final coordinates of the mouse action"
                },
                element: { type: "string", description: "CSS selector if targeting an element" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "action", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId, action, target, dragTo, button = 'left', modifiers = [] } = parameters;
        
        const browser = browserService.getBrowser(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found`);
        }

        const client = browser.client;
        
        // Calculate target coordinates
        let targetX, targetY;
        let elementInfo = null;
        
        if (target.type === 'coordinates') {
            targetX = target.x;
            targetY = target.y;
        } else if (target.type === 'selector') {
            // Get element bounds using DOM API
            const result = await client.Runtime.evaluate({
                expression: `
                    (() => {
                        const element = document.querySelector('${target.selector}');
                        if (!element) return null;
                        const rect = element.getBoundingClientRect();
                        return {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                            width: rect.width,
                            height: rect.height,
                            selector: '${target.selector}'
                        };
                    })()
                `
            });
            
            if (!result.result.value) {
                throw new Error(`Element not found with selector: ${target.selector}`);
            }
            
            const elementData = result.result.value;
            targetX = elementData.x + (target.offset?.x || 0);
            targetY = elementData.y + (target.offset?.y || 0);
            elementInfo = {
                selector: target.selector,
                bounds: elementData
            };
        }

        // Convert modifiers to CDP format
        const cdpModifiers = this.convertModifiers(modifiers);

        // Perform the mouse action
        let actionResult;
        
        switch (action) {
            case 'move':
                await client.Input.dispatchMouseEvent({
                    type: 'mouseMoved',
                    x: targetX,
                    y: targetY,
                    modifiers: cdpModifiers
                });
                actionResult = { type: 'move', x: targetX, y: targetY };
                break;
                
            case 'click':
                await client.Input.dispatchMouseEvent({
                    type: 'mousePressed',
                    x: targetX,
                    y: targetY,
                    button: button,
                    clickCount: 1,
                    modifiers: cdpModifiers
                });
                await client.Input.dispatchMouseEvent({
                    type: 'mouseReleased',
                    x: targetX,
                    y: targetY,
                    button: button,
                    clickCount: 1,
                    modifiers: cdpModifiers
                });
                actionResult = { type: 'click', x: targetX, y: targetY };
                break;
                
            case 'doubleClick':
                // First click
                await client.Input.dispatchMouseEvent({
                    type: 'mousePressed',
                    x: targetX,
                    y: targetY,
                    button: button,
                    clickCount: 1,
                    modifiers: cdpModifiers
                });
                await client.Input.dispatchMouseEvent({
                    type: 'mouseReleased',
                    x: targetX,
                    y: targetY,
                    button: button,
                    clickCount: 1,
                    modifiers: cdpModifiers
                });
                
                // Second click (double click)
                await client.Input.dispatchMouseEvent({
                    type: 'mousePressed',
                    x: targetX,
                    y: targetY,
                    button: button,
                    clickCount: 2,
                    modifiers: cdpModifiers
                });
                await client.Input.dispatchMouseEvent({
                    type: 'mouseReleased',
                    x: targetX,
                    y: targetY,
                    button: button,
                    clickCount: 2,
                    modifiers: cdpModifiers
                });
                actionResult = { type: 'doubleClick', x: targetX, y: targetY };
                break;
                
            case 'rightClick':
                await client.Input.dispatchMouseEvent({
                    type: 'mousePressed',
                    x: targetX,
                    y: targetY,
                    button: 'right',
                    clickCount: 1,
                    modifiers: cdpModifiers
                });
                await client.Input.dispatchMouseEvent({
                    type: 'mouseReleased',
                    x: targetX,
                    y: targetY,
                    button: 'right',
                    clickCount: 1,
                    modifiers: cdpModifiers
                });
                actionResult = { type: 'rightClick', x: targetX, y: targetY };
                break;
                
            case 'hover':
                await client.Input.dispatchMouseEvent({
                    type: 'mouseMoved',
                    x: targetX,
                    y: targetY,
                    modifiers: cdpModifiers
                });
                actionResult = { type: 'hover', x: targetX, y: targetY };
                break;
                
            case 'drag':
                if (!dragTo) {
                    throw new Error('dragTo coordinates required for drag action');
                }
                
                // Start drag
                await client.Input.dispatchMouseEvent({
                    type: 'mousePressed',
                    x: targetX,
                    y: targetY,
                    button: button,
                    clickCount: 1,
                    modifiers: cdpModifiers
                });
                
                // Move to end position
                await client.Input.dispatchMouseEvent({
                    type: 'mouseMoved',
                    x: dragTo.x,
                    y: dragTo.y,
                    modifiers: cdpModifiers
                });
                
                // Release
                await client.Input.dispatchMouseEvent({
                    type: 'mouseReleased',
                    x: dragTo.x,
                    y: dragTo.y,
                    button: button,
                    clickCount: 1,
                    modifiers: cdpModifiers
                });
                
                actionResult = { 
                    type: 'drag', 
                    from: { x: targetX, y: targetY },
                    to: { x: dragTo.x, y: dragTo.y }
                };
                break;
                
            default:
                throw new Error(`Unsupported mouse action: ${action}`);
        }

        return {
            success: true,
            action: action,
            coordinates: action === 'drag' ? actionResult : { x: targetX, y: targetY },
            element: elementInfo?.selector,
            browserId: browserId,
            actionDetails: actionResult
        };
    }

    /**
     * Convert modifier keys to CDP format
     */
    convertModifiers(modifiers) {
        let cdpModifiers = 0;
        
        for (const modifier of modifiers) {
            switch (modifier) {
                case 'ctrl':
                    cdpModifiers |= 2; // Ctrl
                    break;
                case 'shift':
                    cdpModifiers |= 8; // Shift
                    break;
                case 'alt':
                    cdpModifiers |= 1; // Alt
                    break;
                case 'meta':
                    cdpModifiers |= 4; // Meta/Cmd
                    break;
            }
        }
        
        return cdpModifiers;
    }
}

module.exports = BrowserMouseTool;
