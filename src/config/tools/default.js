/**
 * Default tool configuration
 * These settings apply to all tools unless overridden by specific tool configs
 */
module.exports = {
    // Common tool settings
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    
    // Validation settings
    enableInputValidation: true,
    enableOutputValidation: false,
    strictMode: true,
    
    // Performance settings
    enableCaching: false,
    maxCacheSize: 100,
    cacheTimeout: 300000, // 5 minutes
    
    // Error handling
    enableDetailedErrors: process.env.NODE_ENV !== 'production',
    logErrors: true,
    throwOnValidationError: true,
    
    // Rate limiting (per tool)
    rateLimit: {
        enabled: false,
        maxRequests: 100,
        windowMs: 60000 // 1 minute
    }
};
