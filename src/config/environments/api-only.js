/**
 * API-only environment configuration
 * Only enables API testing tools, disables all browser automation tools
 * Ideal for lightweight deployments focused on API testing
 */
module.exports = {
    features: {
        enableDebugMode: process.env.MCP_FEATURES_ENABLEDEBUGMODE === 'true',
        // Only API tools enabled
        enableApiTools: true,
        enableBrowserTools: false,
        enableAdvancedTools: false,
        enableFileTools: false,
        enableNetworkTools: false,
        enableOtherTools: false
    },
    
    logging: {
        level: 'warn',
        enableToolDebug: false
    },
    
    tools: {
        validationLevel: 'strict',
        // API tool specific configurations
        api: {
            api_request: {
                maxSessionTimeout: 300000, // 5 minutes
                maxConcurrentSessions: 10,
                enableRetries: true,
                defaultRetryAttempts: 3,
                enableRequestLogging: true,
                enableResponseLogging: true
            },
            api_session_report: {
                defaultTheme: 'light',
                includeTimestamp: true,
                maxReportSize: '10MB',
                enableCompressionForLargeReports: true
            },
            api_session_status: {
                enableRealTimeUpdates: true,
                maxHistoryEntries: 1000
            }
        }
    },
    
    security: {
        enableInputValidation: true,
        rateLimiting: true,
        maxRequestsPerMinute: 100
    }
};
