const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');

/**
 * Enhanced Evaluate Tool - Execute JavaScript in browser context
 * Inspired by Playwright MCP evaluate capabilities
 */
class BrowserEvaluateTool extends ToolBase {
    static definition = {
        name: "browser_evaluate",
        description: "Execute JavaScript code in the browser context. Can execute on page or specific elements. Returns execution results and handles errors gracefully.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                expression: {
                    type: "string",
                    description: "JavaScript expression or function to execute"
                },
                target: {
                    type: "object",
                    properties: {
                        selector: { 
                            type: "string", 
                            description: "CSS selector of element to execute on (optional)" 
                        }
                    },
                    description: "Target element for execution (if not provided, executes in page context)"
                },
                args: {
                    type: "array",
                    items: {},
                    description: "Arguments to pass to the function (for function expressions)"
                },
                returnByValue: {
                    type: "boolean",
                    default: true,
                    description: "Whether to return result by value or as object reference"
                },
                awaitPromise: {
                    type: "boolean",
                    default: true,
                    description: "Whether to await promises in the result"
                },
                timeout: {
                    type: "number",
                    default: 30000,
                    description: "Execution timeout in milliseconds"
                }
            },
            required: ["browserId", "expression"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the execution was successful" },
                result: { description: "The result of the JavaScript execution" },
                type: { type: "string", description: "Type of the returned result" },
                error: { type: "string", description: "Error message if execution failed" },
                executionTime: { type: "number", description: "Execution time in milliseconds" },
                target: { type: "string", description: "CSS selector if targeting an element" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "browserId"]
        }
    };

    async execute(parameters) {
        const { 
            browserId, 
            expression, 
            target, 
            args = [], 
            returnByValue = true, 
            awaitPromise = true,
            timeout = 30000
        } = parameters;
        
        const browser = browserService.getBrowser(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found`);
        }

        const client = browser.client;
        const startTime = Date.now();
        
        let result = {
            success: false,
            browserId: browserId,
            executionTime: 0
        };

        try {
            if (target?.selector) {
                // Execute on specific element
                result = await this.executeOnElement(client, expression, target.selector, args, returnByValue, awaitPromise, timeout);
                result.target = target.selector;
            } else {
                // Execute in page context
                result = await this.executeInPage(client, expression, args, returnByValue, awaitPromise, timeout);
            }
            
            result.success = true;
            
        } catch (error) {
            result.success = false;
            result.error = error.message;
            
            // Try to extract more meaningful error information
            if (error.exceptionDetails) {
                result.error = error.exceptionDetails.text || error.exceptionDetails.exception?.description || result.error;
                result.lineNumber = error.exceptionDetails.lineNumber;
                result.columnNumber = error.exceptionDetails.columnNumber;
            }
        }

        result.executionTime = Date.now() - startTime;
        result.browserId = browserId;
        
        return result;
    }

    /**
     * Execute JavaScript in page context
     */
    async executeInPage(client, expression, args, returnByValue, awaitPromise, timeout) {
        // Wrap expression in timeout handling
        const wrappedExpression = this.wrapWithTimeout(expression, timeout);
        
        const evalResult = await client.Runtime.evaluate({
            expression: wrappedExpression,
            returnByValue: returnByValue,
            awaitPromise: awaitPromise,
            timeout: timeout
        });

        if (evalResult.exceptionDetails) {
            throw evalResult.exceptionDetails;
        }

        return this.formatResult(evalResult.result);
    }

    /**
     * Execute JavaScript on a specific element
     */
    async executeOnElement(client, expression, selector, args, returnByValue, awaitPromise, timeout) {
        // First, get the element
        const elementExpression = `
            (() => {
                const element = document.querySelector('${selector}');
                if (!element) {
                    throw new Error('Element not found with selector: ${selector}');
                }
                return element;
            })()
        `;

        const elementResult = await client.Runtime.evaluate({
            expression: elementExpression,
            returnByValue: false
        });

        if (elementResult.exceptionDetails) {
            throw new Error(`Failed to find element: ${elementResult.exceptionDetails.text}`);
        }

        // Now execute the expression on the element
        const executeExpression = this.createElementExpression(expression, args);
        const wrappedExpression = this.wrapWithTimeout(executeExpression, timeout);

        const evalResult = await client.Runtime.callFunctionOn({
            functionDeclaration: wrappedExpression,
            objectId: elementResult.result.objectId,
            arguments: args.map(arg => ({ value: arg })),
            returnByValue: returnByValue,
            awaitPromise: awaitPromise
        });

        if (evalResult.exceptionDetails) {
            throw evalResult.exceptionDetails;
        }

        return this.formatResult(evalResult.result);
    }

    /**
     * Create expression for element execution
     */
    createElementExpression(expression, args) {
        // If expression is a function, use it directly
        if (expression.trim().startsWith('function') || expression.includes('=>')) {
            return `(${expression}).apply(this, arguments)`;
        }
        
        // If it's a simple expression, wrap it in a function
        return `function() { return ${expression}; }`;
    }

    /**
     * Wrap expression with timeout handling
     */
    wrapWithTimeout(expression, timeout) {
        return `
            (async () => {
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Execution timeout')), ${timeout})
                );
                
                const executionPromise = (async () => {
                    ${expression.includes('return') ? expression : `return (${expression})`}
                })();
                
                return Promise.race([executionPromise, timeoutPromise]);
            })()
        `;
    }

    /**
     * Format execution result
     */
    formatResult(result) {
        if (!result) {
            return { result: undefined, type: 'undefined' };
        }

        let formattedResult = {
            type: result.type
        };

        switch (result.type) {
            case 'object':
                if (result.subtype === 'null') {
                    formattedResult.result = null;
                } else if (result.subtype === 'array') {
                    formattedResult.result = result.value || result.description;
                    formattedResult.subtype = 'array';
                } else if (result.subtype === 'error') {
                    formattedResult.result = result.description;
                    formattedResult.subtype = 'error';
                } else {
                    formattedResult.result = result.value || result.description;
                }
                break;
                
            case 'function':
                formattedResult.result = result.description;
                break;
                
            case 'undefined':
                formattedResult.result = undefined;
                break;
                
            case 'string':
            case 'number':
            case 'boolean':
                formattedResult.result = result.value;
                break;
                
            default:
                formattedResult.result = result.value !== undefined ? result.value : result.description;
        }

        return formattedResult;
    }

    /**
     * Common JavaScript snippets for evaluation
     */
    static getCommonSnippets() {
        return {
            getPageInfo: `
                ({
                    title: document.title,
                    url: window.location.href,
                    readyState: document.readyState,
                    elementCount: document.querySelectorAll('*').length,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    }
                })
            `,
            
            getElementInfo: `
                function(element) {
                    const rect = element.getBoundingClientRect();
                    return {
                        tagName: element.tagName,
                        id: element.id,
                        className: element.className,
                        textContent: element.textContent?.substring(0, 100),
                        bounds: {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height
                        },
                        visible: rect.width > 0 && rect.height > 0,
                        attributes: Array.from(element.attributes).reduce((acc, attr) => {
                            acc[attr.name] = attr.value;
                            return acc;
                        }, {})
                    };
                }
            `,
            
            scrollToElement: `
                function(element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return { scrolled: true, element: element.tagName };
                }
            `,
            
            getFormData: `
                () => {
                    const forms = Array.from(document.forms);
                    return forms.map(form => ({
                        action: form.action,
                        method: form.method,
                        fields: Array.from(form.elements).map(el => ({
                            name: el.name,
                            type: el.type,
                            value: el.value,
                            required: el.required
                        }))
                    }));
                }
            `
        };
    }
}

module.exports = BrowserEvaluateTool;
