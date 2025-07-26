/**
 * Server-level configuration
 * Core server settings and MCP protocol configuration
 */
module.exports = {
    server: {
        name: 'browser-control-server',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
        port: process.env.PORT || 3000
    },
    
    features: {
        enableBrowserTools: true,
        enableFileTools: false,
        enableNetworkTools: false,
        enableDebugMode: process.env.NODE_ENV !== 'production'
    },
    
    tools: {
        autoDiscovery: true,
        enableCache: true,
        validationLevel: 'strict' // 'strict', 'loose', 'none'
    },
    
    logging: {
        level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
        enableToolDebug: process.env.NODE_ENV !== 'production'
    },
    
    security: {
        enableInputValidation: true,
        maxRequestSize: '10MB',
        rateLimiting: false // Disabled by default for MCP
    },
    
    // Legacy compatibility
    PORT: process.env.PORT || 3000,
    OUTPUT_DIR: require('path').resolve(__dirname, '../../output')
};
