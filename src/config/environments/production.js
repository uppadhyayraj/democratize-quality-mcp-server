/**
 * Production environment configuration
 * Settings optimized for production deployment
 */
module.exports = {
    features: {
        enableDebugMode: false
    },
    
    logging: {
        level: 'error',
        enableToolDebug: false
    },
    
    tools: {
        validationLevel: 'strict',
        browser: {
            browser_launch: {
                defaultHeadless: true, // Always headless in production
                maxInstances: 3, // Conservative limit
                launchTimeout: 15000, // Shorter timeout
                chromeFlags: [
                    '--headless=new',
                    '--disable-gpu',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--memory-pressure-off',
                    '--max_old_space_size=4096'
                ]
            },
            browser_screenshot: {
                defaultQuality: 60, // Lower quality for performance
                compressionLevel: 9, // Higher compression
                enableTimestamps: false
            },
            browser_dom: {
                highlightElements: false,
                enableRetries: false, // Fail fast in production
                defaultWaitTimeout: 3000 // Shorter timeout
            },
            browser_type: {
                typingDelay: 5, // Faster typing
                enableNaturalTyping: false
            },
            global: {
                maxConcurrentOperations: 2,
                enableScreenshotOnError: false,
                enablePerformanceMetrics: false,
                healthCheckInterval: 300000 // 5 minutes
            }
        }
    },
    
    security: {
        enableInputValidation: true,
        rateLimiting: true,
        maxRequestSize: '5MB'
    }
};
