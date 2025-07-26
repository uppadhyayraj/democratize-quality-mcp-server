const fs = require('fs');
const path = require('path');
const config = require('../../config');

/**
 * Tool Registry - Manages discovery, loading, and registration of tools
 */
class ToolRegistry {
    constructor() {
        this.tools = new Map(); // toolName -> toolInstance
        this.definitions = []; // Array of tool definitions for MCP
        this.config = config;
    }

    /**
     * Automatically discovers and loads tools from the tools directory
     * @param {string} toolsDir - The root tools directory path
     */
    async discoverTools(toolsDir) {
        console.error('[ToolRegistry] Starting tool discovery...');
        
        try {
            await this._scanDirectory(toolsDir);
            console.error(`[ToolRegistry] Discovery complete. Found ${this.tools.size} tools.`);
        } catch (error) {
            console.error('[ToolRegistry] Error during tool discovery:', error.message);
            throw error;
        }
    }

    /**
     * Recursively scans a directory for tool files
     * @param {string} dir - Directory to scan
     */
    async _scanDirectory(dir) {
        if (!fs.existsSync(dir)) {
            console.error(`[ToolRegistry] Tools directory not found: ${dir}`);
            return;
        }

        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory() && item !== 'base') {
                // Recursively scan subdirectories (except 'base')
                await this._scanDirectory(itemPath);
            } else if (stat.isFile() && item.endsWith('.js') && !item.startsWith('index')) {
                // Load tool files (skip index.js files)
                await this._loadTool(itemPath);
            }
        }
    }

    /**
     * Loads a single tool from a file
     * @param {string} toolPath - Path to the tool file
     */
    async _loadTool(toolPath) {
        try {
            const ToolClass = require(toolPath);
            
            // Validate that it's a proper tool class
            if (typeof ToolClass !== 'function') {
                console.warn(`[ToolRegistry] Skipping ${toolPath}: Not a class/function export`);
                return;
            }
            
            if (!ToolClass.definition) {
                console.warn(`[ToolRegistry] Skipping ${toolPath}: No tool definition found`);
                return;
            }
            
            const toolName = ToolClass.getName();
            
            // Check feature flags before registering
            const category = this._getToolCategory(toolName);
            const featureFlag = `enable${category.charAt(0).toUpperCase() + category.slice(1)}Tools`;
            
            if (!this.config.isFeatureEnabled(featureFlag)) {
                console.error(`[ToolRegistry] Tool '${toolName}' disabled by feature flag: ${featureFlag}`);
                return;
            }
            
            // Create an instance of the tool
            const toolInstance = new ToolClass();
            
            // Check for name conflicts
            if (this.tools.has(toolName)) {
                console.warn(`[ToolRegistry] Tool name conflict: '${toolName}' already registered. Skipping ${toolPath}`);
                return;
            }
            
            // Register the tool
            this.tools.set(toolName, toolInstance);
            this.definitions.push(ToolClass.getDefinition());
            
            console.error(`[ToolRegistry] Registered tool: ${toolName}`);
            
        } catch (error) {
            console.error(`[ToolRegistry] Failed to load tool from ${toolPath}:`, error.message);
        }
    }

    /**
     * Manually registers a tool instance
     * @param {ToolBase} toolInstance - The tool instance to register
     */
    registerTool(toolInstance) {
        const toolName = toolInstance.constructor.getName();
        
        if (this.tools.has(toolName)) {
            throw new Error(`Tool '${toolName}' is already registered`);
        }
        
        this.tools.set(toolName, toolInstance);
        this.definitions.push(toolInstance.constructor.getDefinition());
        
        console.error(`[ToolRegistry] Manually registered tool: ${toolName}`);
    }

    /**
     * Gets a tool instance by name
     * @param {string} toolName - The name of the tool
     * @returns {ToolBase|undefined} - The tool instance or undefined if not found
     */
    getTool(toolName) {
        return this.tools.get(toolName);
    }

    /**
     * Gets all tool definitions for MCP tools/list response
     * @returns {Array} - Array of tool definitions
     */
    getDefinitions() {
        return this.definitions;
    }

    /**
     * Gets all registered tool names
     * @returns {Array<string>} - Array of tool names
     */
    getToolNames() {
        return Array.from(this.tools.keys());
    }

    /**
     * Checks if a tool is registered
     * @param {string} toolName - The name of the tool
     * @returns {boolean} - True if the tool is registered
     */
    hasTool(toolName) {
        return this.tools.has(toolName);
    }

    /**
     * Executes a tool by name
     * @param {string} toolName - The name of the tool to execute
     * @param {object} parameters - The parameters to pass to the tool
     * @returns {Promise<object>} - The tool execution result
     */
    async executeTool(toolName, parameters) {
        const tool = this.getTool(toolName);
        
        if (!tool) {
            throw {
                code: -32601,
                message: `Tool '${toolName}' not found`,
                data: { 
                    available_tools: this.getToolNames(),
                    requested_tool: toolName 
                }
            };
        }
        
        return await tool.run(parameters);
    }

    /**
     * Apply feature flags to filter available tools
     */
    _applyFeatureFlags() {
        const toolsToRemove = [];
        
        for (const [toolName, toolInstance] of this.tools) {
            const category = this._getToolCategory(toolName);
            const featureFlag = `enable${category.charAt(0).toUpperCase() + category.slice(1)}Tools`;
            
            if (!this.config.isFeatureEnabled(featureFlag)) {
                console.error(`[ToolRegistry] Tool '${toolName}' disabled by feature flag: ${featureFlag}`);
                toolsToRemove.push(toolName);
            }
        }
        
        // Remove disabled tools
        for (const toolName of toolsToRemove) {
            this.tools.delete(toolName);
            this.definitions = this.definitions.filter(def => def.name !== toolName);
        }
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
     * Gets registry statistics
     * @returns {object} - Registry statistics
     */
    getStats() {
        const categories = {};
        for (const toolName of this.getToolNames()) {
            const category = this._getToolCategory(toolName);
            categories[category] = (categories[category] || 0) + 1;
        }
        
        return {
            total_tools: this.tools.size,
            tool_names: this.getToolNames(),
            definitions_count: this.definitions.length,
            categories: categories,
            feature_flags: {
                enableBrowserTools: this.config.isFeatureEnabled('enableBrowserTools'),
                enableFileTools: this.config.isFeatureEnabled('enableFileTools'),
                enableNetworkTools: this.config.isFeatureEnabled('enableNetworkTools'),
                enableDebugMode: this.config.isFeatureEnabled('enableDebugMode')
            }
        };
    }
}

module.exports = ToolRegistry;
