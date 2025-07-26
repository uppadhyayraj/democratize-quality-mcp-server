/**
 * Development environment configuration
 * Settings optimized for development and debugging
 */
module.exports = {
    features: {
        enableDebugMode: true
    },
    
    logging: {
        level: 'debug',
        enableToolDebug: true
    },
    
    tools: {
        validationLevel: 'strict',
        browser: {
            browser_launch: {
                defaultHeadless: false, // Show browser in development
                maxInstances: 5,
                chromeFlags: [
                    '--disable-gpu',
                    '--no-sandbox',
                    '--disable-web-security', // Allow CORS in development
                    '--disable-features=VizDisplayCompositor'
                ]
            },
            browser_screenshot: {
                enableTimestamps: true,
                outputDirectory: require('path').resolve(__dirname, '../../../output/dev')
            },
            browser_dom: {
                highlightElements: true, // Highlight elements for debugging
                enableRetries: true
            },
            global: {
                enableScreenshotOnError: true,
                enablePerformanceMetrics: true
            }
        }
    },
    
    security: {
        enableInputValidation: true,
        rateLimiting: false
    }
};
