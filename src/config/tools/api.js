/**
 * API Tools Configuration
 * Configuration specific to API testing tools
 */
module.exports = {
    // API Request Tool
    api_request: {
        // Session management
        maxSessions: 50,
        sessionTimeout: 600000, // 10 minutes
        enableSessionPersistence: true,
        
        // Request settings
        defaultTimeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
        enableRedirects: true,
        maxRedirects: 5,
        
        // Validation settings
        enableResponseValidation: true,
        enableBodyValidation: true,
        strictContentTypeCheck: true,
        
        // Logging settings
        enableRequestLogging: true,
        enableResponseLogging: true,
        logLevel: 'info',
        
        // Rate limiting
        rateLimitEnabled: false,
        maxRequestsPerSecond: 10
    },
    
    // API Session Status Tool
    api_session_status: {
        enableRealTimeUpdates: true,
        maxHistoryEntries: 1000,
        includeDetailedLogs: true,
        enableSessionMetrics: true
    },
    
    // API Session Report Tool
    api_session_report: {
        defaultTheme: 'light',
        includeRequestData: true,
        includeResponseData: true,
        includeTiming: true,
        includeValidationResults: true,
        
        // Report generation settings
        maxReportSize: 10485760, // 10MB
        enableCompression: true,
        compressionLevel: 6,
        
        // HTML report settings
        enableInteractiveReports: true,
        includeCharts: true,
        enableSyntaxHighlighting: true,
        
        // Output settings
        defaultOutputDir: process.env.API_REPORTS_DIR || 'output/reports',
        enableTimestampInFilename: true,
        enableAutoCleanup: true,
        maxReportsToKeep: 100
    }
};
