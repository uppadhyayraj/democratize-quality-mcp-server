const ToolRegistry = require('./base/ToolRegistry');
const path = require('path');

/**
 * Initialize and configure the tool registry
 * This file serves as the main entry point for the tools system
 */

// Create the global tool registry instance
const toolRegistry = new ToolRegistry();

/**
 * Initialize the tool registry by discovering and loading all tools
 * @returns {Promise<ToolRegistry>} - The initialized tool registry
 */
async function initializeTools() {
    console.error('[Tools] Initializing tool system...');
    
    try {
        // Get the tools directory path
        const toolsDir = path.join(__dirname);
        
        // Discover and load all tools
        await toolRegistry.discoverTools(toolsDir);
        
        // Log registry statistics
        const stats = toolRegistry.getStats();
        console.error(`[Tools] Tool system initialized successfully:`);
        console.error(`[Tools] - Total tools: ${stats.total_tools}`);
        console.error(`[Tools] - Available tools: ${stats.tool_names.join(', ')}`);
        
        return toolRegistry;
        
    } catch (error) {
        console.error('[Tools] Failed to initialize tool system:', error.message);
        throw error;
    }
}

/**
 * Get the tool registry instance
 * @returns {ToolRegistry} - The tool registry instance
 */
function getToolRegistry() {
    return toolRegistry;
}

/**
 * Get all tool definitions for MCP tools/list response
 * @returns {Array} - Array of tool definitions
 */
function getToolDefinitions() {
    return toolRegistry.getDefinitions();
}

/**
 * Execute a tool by name
 * @param {string} toolName - The name of the tool to execute
 * @param {object} parameters - The parameters to pass to the tool
 * @returns {Promise<object>} - The tool execution result
 */
async function executeTool(toolName, parameters) {
    return await toolRegistry.executeTool(toolName, parameters);
}

/**
 * Check if a tool is available
 * @param {string} toolName - The name of the tool to check
 * @returns {boolean} - True if the tool is available
 */
function isToolAvailable(toolName) {
    return toolRegistry.hasTool(toolName);
}

/**
 * Get list of available tool names
 * @returns {Array<string>} - Array of available tool names
 */
function getAvailableTools() {
    return toolRegistry.getToolNames();
}

module.exports = {
    initializeTools,
    getToolRegistry,
    getToolDefinitions,
    executeTool,
    isToolAvailable,
    getAvailableTools
};
