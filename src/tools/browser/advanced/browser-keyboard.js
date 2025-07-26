const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');

/**
 * Enhanced Keyboard Tool - Provides comprehensive keyboard interactions
 * Inspired by Playwright MCP keyboard capabilities
 */
class BrowserKeyboardTool extends ToolBase {
    static definition = {
        name: "browser_keyboard",
        description: "Perform keyboard actions including typing, key presses, and keyboard shortcuts. Supports special keys and modifier combinations.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                action: {
                    type: "string",
                    enum: ["type", "press", "down", "up", "shortcut"],
                    description: "The keyboard action to perform"
                },
                text: {
                    type: "string",
                    description: "Text to type (for 'type' action)"
                },
                key: {
                    type: "string",
                    description: "Key to press (for 'press', 'down', 'up' actions). Examples: 'Enter', 'Tab', 'ArrowLeft', 'F1'"
                },
                shortcut: {
                    type: "string",
                    description: "Keyboard shortcut (for 'shortcut' action). Examples: 'Ctrl+C', 'Cmd+V', 'Ctrl+Shift+I'"
                },
                target: {
                    type: "object",
                    properties: {
                        selector: { 
                            type: "string", 
                            description: "CSS selector of element to focus before typing (optional)" 
                        }
                    },
                    description: "Target element to focus before keyboard action"
                },
                delay: {
                    type: "number",
                    default: 0,
                    description: "Delay between keystrokes in milliseconds"
                },
                modifiers: {
                    type: "array",
                    items: { type: "string", enum: ["ctrl", "shift", "alt", "meta"] },
                    description: "Modifier keys to hold during action"
                }
            },
            required: ["browserId", "action"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the keyboard action was successful" },
                action: { type: "string", description: "The action that was performed" },
                text: { type: "string", description: "Text that was typed" },
                key: { type: "string", description: "Key that was pressed" },
                target: { type: "string", description: "CSS selector of targeted element" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "action", "browserId"]
        }
    };

    async execute(parameters) {
        const { browserId, action, text, key, shortcut, target, delay = 0, modifiers = [] } = parameters;
        
        const browser = browserService.getBrowserInstance(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found`);
        }

        const client = browser.client;
        
        // Focus target element if specified
        if (target?.selector) {
            await this.focusElement(client, target.selector);
        }

        let result = {
            success: true,
            action: action,
            browserId: browserId
        };

        // Convert modifiers to CDP format
        const cdpModifiers = this.convertModifiers(modifiers);

        switch (action) {
            case 'type':
                if (!text) {
                    throw new Error('Text is required for type action');
                }
                await this.typeText(client, text, delay);
                result.text = text;
                break;
                
            case 'press':
                if (!key) {
                    throw new Error('Key is required for press action');
                }
                await this.pressKey(client, key, cdpModifiers);
                result.key = key;
                break;
                
            case 'down':
                if (!key) {
                    throw new Error('Key is required for down action');
                }
                await this.keyDown(client, key, cdpModifiers);
                result.key = key;
                break;
                
            case 'up':
                if (!key) {
                    throw new Error('Key is required for up action');
                }
                await this.keyUp(client, key, cdpModifiers);
                result.key = key;
                break;
                
            case 'shortcut':
                if (!shortcut) {
                    throw new Error('Shortcut is required for shortcut action');
                }
                await this.executeShortcut(client, shortcut);
                result.shortcut = shortcut;
                break;
                
            default:
                throw new Error(`Unsupported keyboard action: ${action}`);
        }

        if (target?.selector) {
            result.target = target.selector;
        }

        return result;
    }

    /**
     * Focus an element by CSS selector
     */
    async focusElement(client, selector) {
        const result = await client.Runtime.evaluate({
            expression: `
                (() => {
                    const element = document.querySelector('${selector}');
                    if (element) {
                        element.focus();
                        return true;
                    }
                    return false;
                })()
            `
        });
        
        if (!result.result.value) {
            throw new Error(`Could not focus element with selector: ${selector}`);
        }
    }

    /**
     * Type text with optional delay between keystrokes
     */
    async typeText(client, text, delay) {
        for (const char of text) {
            await client.Input.dispatchKeyEvent({
                type: 'keyDown',
                text: char
            });
            
            await client.Input.dispatchKeyEvent({
                type: 'keyUp',
                text: char
            });
            
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Press a key (down and up)
     */
    async pressKey(client, key, modifiers = 0) {
        const keyInfo = this.getKeyInfo(key);
        
        await client.Input.dispatchKeyEvent({
            type: 'keyDown',
            key: keyInfo.key,
            code: keyInfo.code,
            modifiers: modifiers
        });
        
        await client.Input.dispatchKeyEvent({
            type: 'keyUp',
            key: keyInfo.key,
            code: keyInfo.code,
            modifiers: modifiers
        });
    }

    /**
     * Key down
     */
    async keyDown(client, key, modifiers = 0) {
        const keyInfo = this.getKeyInfo(key);
        
        await client.Input.dispatchKeyEvent({
            type: 'keyDown',
            key: keyInfo.key,
            code: keyInfo.code,
            modifiers: modifiers
        });
    }

    /**
     * Key up
     */
    async keyUp(client, key, modifiers = 0) {
        const keyInfo = this.getKeyInfo(key);
        
        await client.Input.dispatchKeyEvent({
            type: 'keyUp',
            key: keyInfo.key,
            code: keyInfo.code,
            modifiers: modifiers
        });
    }

    /**
     * Execute keyboard shortcut
     */
    async executeShortcut(client, shortcut) {
        const keys = this.parseShortcut(shortcut);
        
        // Press modifier keys
        for (const modifier of keys.modifiers) {
            await this.keyDown(client, modifier);
        }
        
        // Press main key
        if (keys.key) {
            await this.pressKey(client, keys.key, this.convertModifiers(keys.modifiers));
        }
        
        // Release modifier keys in reverse order
        for (let i = keys.modifiers.length - 1; i >= 0; i--) {
            await this.keyUp(client, keys.modifiers[i]);
        }
    }

    /**
     * Parse keyboard shortcut string
     */
    parseShortcut(shortcut) {
        const parts = shortcut.split('+');
        const key = parts.pop();
        const modifiers = parts.map(mod => mod.toLowerCase());
        
        return { key, modifiers };
    }

    /**
     * Get key information for CDP
     */
    getKeyInfo(key) {
        const keyMap = {
            'Enter': { key: 'Enter', code: 'Enter' },
            'Tab': { key: 'Tab', code: 'Tab' },
            'Escape': { key: 'Escape', code: 'Escape' },
            'Space': { key: ' ', code: 'Space' },
            'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft' },
            'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight' },
            'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp' },
            'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown' },
            'Backspace': { key: 'Backspace', code: 'Backspace' },
            'Delete': { key: 'Delete', code: 'Delete' },
            'Home': { key: 'Home', code: 'Home' },
            'End': { key: 'End', code: 'End' },
            'PageUp': { key: 'PageUp', code: 'PageUp' },
            'PageDown': { key: 'PageDown', code: 'PageDown' },
            'F1': { key: 'F1', code: 'F1' },
            'F2': { key: 'F2', code: 'F2' },
            'F3': { key: 'F3', code: 'F3' },
            'F4': { key: 'F4', code: 'F4' },
            'F5': { key: 'F5', code: 'F5' },
            'F6': { key: 'F6', code: 'F6' },
            'F7': { key: 'F7', code: 'F7' },
            'F8': { key: 'F8', code: 'F8' },
            'F9': { key: 'F9', code: 'F9' },
            'F10': { key: 'F10', code: 'F10' },
            'F11': { key: 'F11', code: 'F11' },
            'F12': { key: 'F12', code: 'F12' }
        };

        if (keyMap[key]) {
            return keyMap[key];
        }

        // For single characters
        return { key: key, code: `Key${key.toUpperCase()}` };
    }

    /**
     * Convert modifier keys to CDP format
     */
    convertModifiers(modifiers) {
        let cdpModifiers = 0;
        
        for (const modifier of modifiers) {
            switch (modifier.toLowerCase()) {
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
                case 'cmd':
                    cdpModifiers |= 4; // Meta/Cmd
                    break;
            }
        }
        
        return cdpModifiers;
    }
}

module.exports = BrowserKeyboardTool;
