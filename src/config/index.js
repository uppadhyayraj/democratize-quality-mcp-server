const path = require('path');
const fs = require('fs');

/**
 * Configuration Management System
 * Loads and manages configuration from multiple sources with environment-based overrides
 */
class ConfigManager {
    constructor(options = {}) {
        this.config = {};
        this.environment = process.env.NODE_ENV || 'api-only';
        this.configDir = path.join(__dirname);
        
        // Check for debug mode early
        const debugFromEnv = process.env.MCP_FEATURES_ENABLEDEBUGMODE === 'true' || this.environment === 'development';
        this.quiet = options.quiet !== undefined ? options.quiet : !debugFromEnv;
        
        this.loadConfiguration();
    }

    /**
     * Load configuration from multiple sources in order of precedence:
     * 1. Environment variables (highest precedence)
     * 2. Environment-specific config files
     * 3. Default configuration files (lowest precedence)
     */
    loadConfiguration() {
        if (!this.quiet) {
            console.error('[Config] Loading configuration...');
        }
        
        try {
            // Load base server configuration
            this.config = this.loadConfigFile('server.js', {});
            
            // Load tool configurations
            this.config.tools = this.loadToolConfigs();
            
            // Load environment-specific overrides
            this.loadEnvironmentConfig();
            
            // Apply environment variable overrides (highest precedence)
            this.applyEnvironmentVariables();
            
            if (!this.quiet) {
                console.error(`[Config] Configuration loaded for environment: ${this.environment}`);
            }
            
        } catch (error) {
            console.error('[Config] Error loading configuration:', error.message);
            // Use defaults if config loading fails
            this.config = this.getDefaultConfig();
        }
    }

    /**
     * Load a configuration file if it exists
     * @param {string} filename - The config file name
     * @param {object} defaultValue - Default value if file doesn't exist
     * @returns {object} - The loaded configuration
     */
    loadConfigFile(filename, defaultValue = {}) {
        const filePath = path.join(this.configDir, filename);
        
        if (fs.existsSync(filePath)) {
            try {
                return require(filePath);
            } catch (error) {
                console.error(`[Config] Error loading ${filename}:`, error.message);
                return defaultValue;
            }
        }
        
        return defaultValue;
    }

    /**
     * Load all tool-specific configurations
     * @returns {object} - Combined tool configurations
     */
    loadToolConfigs() {
        const toolsDir = path.join(this.configDir, 'tools');
        const toolConfigs = {};
        
        // Load default tool config
        const defaultToolConfig = this.loadConfigFile('tools/default.js', {});
        
        if (fs.existsSync(toolsDir)) {
            const toolConfigFiles = fs.readdirSync(toolsDir).filter(file => 
                file.endsWith('.js') && file !== 'default.js'
            );
            
            for (const file of toolConfigFiles) {
                const configName = path.basename(file, '.js');
                toolConfigs[configName] = {
                    ...defaultToolConfig,
                    ...this.loadConfigFile(`tools/${file}`, {})
                };
            }
        }
        
        return toolConfigs;
    }

    /**
     * Load environment-specific configuration overrides
     */
    loadEnvironmentConfig() {
        const envConfig = this.loadConfigFile(`environments/${this.environment}.js`, {});
        
        // Deep merge environment config
        this.config = this.deepMerge(this.config, envConfig);
    }

    /**
     * Apply environment variable overrides
     * Environment variables follow the pattern: MCP_SECTION_KEY=value
     */
    applyEnvironmentVariables() {
        const envPrefix = 'MCP_';
        
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith(envPrefix)) {
                let configPath = key.substring(envPrefix.length).toLowerCase().split('_');
                const parsedValue = this.parseEnvValue(value);
                
                // Special handling for feature flags to maintain camelCase
                if (configPath[0] === 'features' && configPath.length > 1) {
                    // Convert features_enablebrowsertools to features.enableBrowserTools
                    const featureName = configPath.slice(1).join('_');
                    const camelCaseFeature = this.toCamelCase(featureName);
                    configPath = ['features', camelCaseFeature];
                    
                    // Remove the lowercase version if it exists
                    if (this.config.features && this.config.features[featureName]) {
                        delete this.config.features[featureName];
                    }
                }
                
                this.setNestedValue(this.config, configPath, parsedValue);
            }
        }
    }

    /**
     * Convert snake_case to camelCase
     * @param {string} str - Snake case string  
     * @returns {string} - CamelCase string
     */
    toCamelCase(str) {
        // Handle special cases for tool feature flags
        if (str === 'enableapitools') return 'enableApiTools';
        if (str === 'enablebrowsertools') return 'enableBrowserTools';
        if (str === 'enableadvancedtools') return 'enableAdvancedTools';
        if (str === 'enablefiletools') return 'enableFileTools';
        if (str === 'enablenetworktools') return 'enableNetworkTools';
        if (str === 'enableothertools') return 'enableOtherTools';
        if (str === 'enabledebugmode') return 'enableDebugMode';
        
        // General snake_case to camelCase conversion
        return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    }

    /**
     * Parse environment variable values to appropriate types
     * @param {string} value - The environment variable value
     * @returns {any} - Parsed value
     */
    parseEnvValue(value) {
        // Boolean values
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        
        // Number values
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        
        // JSON values
        if (value.startsWith('{') || value.startsWith('[')) {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        
        return value;
    }

    /**
     * Deep merge two objects
     * @param {object} target - Target object
     * @param {object} source - Source object
     * @returns {object} - Merged object
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.deepMerge(result[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }

    /**
     * Set a nested value in an object using a path array
     * @param {object} obj - Target object
     * @param {Array<string>} path - Path array
     * @param {any} value - Value to set
     */
    setNestedValue(obj, path, value) {
        let current = obj;
        
        for (let i = 0; i < path.length - 1; i++) {
            if (!(path[i] in current)) {
                current[path[i]] = {};
            }
            current = current[path[i]];
        }
        
        current[path[path.length - 1]] = value;
    }

    /**
     * Get default configuration
     * @returns {object} - Default configuration
     */
    getDefaultConfig() {
        return {
            server: {
                name: 'browser-control-server',
                version: '1.0.0',
                protocolVersion: '2024-11-05',
                port: process.env.PORT || 3000
            },
            features: {
                // Tool category feature flags with sensible defaults
                enableApiTools: true,
                enableBrowserTools: true,
                enableAdvancedTools: false, // Conservative default for advanced tools
                enableFileTools: false,    // Security consideration
                enableNetworkTools: false, // Security consideration
                enableOtherTools: false,   // Conservative default
                enableDebugMode: this.environment !== 'production'
            },
            tools: {
                autoDiscovery: true,
                enableCache: true,
                validationLevel: 'strict',
                browser: {
                    maxInstances: 10,
                    defaultHeadless: true,
                    launchTimeout: 30000
                }
            },
            logging: {
                level: this.environment === 'production' ? 'error' : 'debug',
                enableToolDebug: this.environment !== 'production'
            },
            // Legacy compatibility
            PORT: process.env.PORT || 3000,
            OUTPUT_DIR: path.resolve(__dirname, '../../output')
        };
    }

    /**
     * Get configuration value by path
     * @param {string} path - Dot-separated path (e.g., 'tools.browser.maxInstances')
     * @param {any} defaultValue - Default value if path doesn't exist
     * @returns {any} - Configuration value
     */
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }

    /**
     * Check if a feature is enabled
     * @param {string} featureName - Name of the feature
     * @returns {boolean} - True if enabled
     */
    isFeatureEnabled(featureName) {
        return this.get(`features.${featureName}`, false);
    }

    /**
     * Get tool-specific configuration
     * @param {string} toolName - Name of the tool
     * @param {string} configKey - Configuration key (optional)
     * @returns {any} - Tool configuration
     */
    getToolConfig(toolName, configKey = null) {
        const toolConfig = this.get(`tools.${toolName}`, {});
        
        if (configKey) {
            return toolConfig[configKey];
        }
        
        return toolConfig;
    }

    /**
     * Set quiet mode for logging
     * @param {boolean} quiet - Whether to suppress non-essential logs
     */
    setQuiet(quiet) {
        this.quiet = quiet;
    }

    /**
     * Get all configuration
     * @returns {object} - Complete configuration
     */
    getAll() {
        return { ...this.config };
    }

    // Legacy compatibility methods
    get PORT() { return this.get('PORT', 3000); }
    get OUTPUT_DIR() { return this.get('OUTPUT_DIR'); }
}

// Create singleton instance
const configManager = new ConfigManager();

module.exports = configManager;
