/**
 * Base class for all MCP tools
 * Provides common functionality and enforces a consistent interface
 */
class ToolBase {
    constructor() {
        if (this.constructor === ToolBase) {
            throw new Error("ToolBase is an abstract class and cannot be instantiated directly");
        }
        
        // Validate that required static properties are defined
        if (!this.constructor.definition) {
            throw new Error(`Tool ${this.constructor.name} must define a static 'definition' property`);
        }
        
        this.validateDefinition(this.constructor.definition);
        
        // Initialize configuration
        this.config = require('../../config');
        this.toolConfig = this._getToolConfig();
    }

    /**
     * Get tool-specific configuration
     * @returns {object} - Tool configuration
     */
    _getToolConfig() {
        const toolName = this.constructor.definition.name;
        const category = this._getToolCategory(toolName);
        
        // Get configuration in order of precedence:
        // 1. Tool-specific config
        // 2. Category config
        // 3. Default config
        return {
            ...this.config.getToolConfig('default', {}),
            ...this.config.getToolConfig(category, {}),
            ...this.config.getToolConfig(category, toolName)
        };
    }

    /**
     * Get tool category from tool name
     * @param {string} toolName - The tool name
     * @returns {string} - The tool category
     */
    _getToolCategory(toolName) {
        if (toolName.startsWith('browser_')) return 'browser';
        if (toolName.startsWith('file_')) return 'file';
        if (toolName.startsWith('network_')) return 'network';
        return 'other';
    }

    /**
     * Get a configuration value for this tool
     * @param {string} key - Configuration key
     * @param {any} defaultValue - Default value
     * @returns {any} - Configuration value
     */
    getConfig(key, defaultValue = undefined) {
        return this.toolConfig[key] !== undefined ? this.toolConfig[key] : defaultValue;
    }

    /**
     * Validates the tool definition schema
     * @param {object} definition - The tool definition object
     */
    validateDefinition(definition) {
        const required = ['name', 'description', 'input_schema'];
        for (const field of required) {
            if (!definition[field]) {
                throw new Error(`Tool definition missing required field: ${field}`);
            }
        }
        
        if (!definition.input_schema.type || definition.input_schema.type !== 'object') {
            throw new Error("Tool input_schema must be of type 'object'");
        }
    }

    /**
     * Validates input parameters against the tool's schema
     * @param {object} parameters - The input parameters to validate
     */
    validateParameters(parameters) {
        const schema = this.constructor.definition.input_schema;
        
        // Check required parameters
        if (schema.required) {
            for (const required of schema.required) {
                if (parameters[required] === undefined || parameters[required] === null) {
                    throw new Error(`Missing required parameter: ${required}`);
                }
            }
        }
        
        // Basic type checking for defined properties
        if (schema.properties) {
            for (const [key, value] of Object.entries(parameters)) {
                if (schema.properties[key]) {
                    const expectedType = schema.properties[key].type;
                    const actualType = typeof value;
                    
                    if (expectedType === 'string' && actualType !== 'string') {
                        throw new Error(`Parameter '${key}' must be a string, got ${actualType}`);
                    }
                    if (expectedType === 'number' && actualType !== 'number') {
                        throw new Error(`Parameter '${key}' must be a number, got ${actualType}`);
                    }
                    if (expectedType === 'boolean' && actualType !== 'boolean') {
                        throw new Error(`Parameter '${key}' must be a boolean, got ${actualType}`);
                    }
                    if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
                        throw new Error(`Parameter '${key}' must be an object, got ${actualType}`);
                    }
                }
            }
        }
    }

    /**
     * Executes the tool with the given parameters
     * This method must be implemented by subclasses
     * @param {object} parameters - The input parameters
     * @returns {Promise<any>} - The tool execution result
     */
    async execute(parameters) {
        throw new Error("execute() method must be implemented by subclasses");
    }

    /**
     * Wrapper method that handles validation, execution, and error handling
     * @param {object} parameters - The input parameters
     * @returns {Promise<object>} - Formatted MCP response
     */
    async run(parameters = {}) {
        const toolName = this.constructor.definition.name;
        const enableDebug = this.config.isFeatureEnabled('enableDebugMode');
        
        try {
            if (enableDebug) {
                console.error(`[Tool:${toolName}] Executing with parameters:`, JSON.stringify(parameters));
            }
            
            // Validate input parameters if validation is enabled
            if (this.getConfig('enableInputValidation', true)) {
                this.validateParameters(parameters);
            }
            
            // Execute the tool with timeout if configured
            const timeout = this.getConfig('timeout', 30000);
            const result = await this._executeWithTimeout(parameters, timeout);
            
            if (enableDebug) {
                console.error(`[Tool:${toolName}] Execution successful`);
            }
            
            // Return formatted MCP response
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result)
                }]
            };
            
        } catch (error) {
            const enableDetailedErrors = this.getConfig('enableDetailedErrors', true);
            
            if (enableDetailedErrors || enableDebug) {
                console.error(`[Tool:${toolName}] Error during execution:`, error.message);
            }
            
            // Throw properly formatted MCP error
            throw {
                code: -32000,
                message: `Tool '${toolName}' execution failed: ${error.message}`,
                data: enableDetailedErrors ? {
                    tool_name: toolName,
                    parameters: parameters,
                    original_error: error.message,
                    config: this.toolConfig
                } : {
                    tool_name: toolName,
                    original_error: error.message
                }
            };
        }
    }

    /**
     * Execute the tool with a timeout
     * @param {object} parameters - The input parameters
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<any>} - Execution result
     */
    async _executeWithTimeout(parameters, timeout) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Tool execution timed out after ${timeout}ms`));
            }, timeout);
            
            try {
                const result = await this.execute(parameters);
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Gets the tool definition
     * @returns {object} - The tool definition
     */
    static getDefinition() {
        return this.definition;
    }

    /**
     * Gets the tool name from the definition
     * @returns {string} - The tool name
     */
    static getName() {
        return this.definition.name;
    }
}

module.exports = ToolBase;
