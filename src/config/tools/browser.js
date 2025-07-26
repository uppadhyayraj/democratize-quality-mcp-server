/**
 * Browser tool-specific configuration
 * Settings for all browser automation tools
 */
module.exports = {
    // Browser launch settings
    browser_launch: {
        defaultHeadless: true,
        defaultPort: null, // Let chrome-launcher choose
        maxInstances: 10,
        launchTimeout: 30000,
        chromeFlags: [
            '--disable-gpu',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--disable-dev-shm-usage', // Prevent crashes in containerized environments
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ],
        userDataDirPrefix: 'browser-session-',
        cleanupOnExit: true
    },
    
    // Navigation settings
    browser_navigate: {
        pageLoadTimeout: 30000,
        allowedProtocols: ['http:', 'https:'],
        maxRedirects: 5,
        waitForNetworkIdle: true,
        networkIdleTimeout: 2000
    },
    
    // Screenshot settings
    browser_screenshot: {
        defaultQuality: 80,
        defaultFormat: 'png',
        maxFileSize: '10MB',
        allowedFormats: ['png', 'jpeg', 'webp'],
        outputDirectory: require('path').resolve(__dirname, '../../../output'),
        enableTimestamps: true,
        compressionLevel: 6
    },
    
    // DOM interaction settings
    browser_dom: {
        defaultWaitTimeout: 5000,
        elementVisibilityTimeout: 3000,
        scrollIntoView: true,
        highlightElements: false, // Useful for debugging
        enableRetries: true,
        maxRetryAttempts: 3,
        retryDelay: 500
    },
    
    // Click settings
    browser_click: {
        waitForElement: true,
        scrollIntoView: true,
        doubleClickDelay: 100,
        enableCoordinateValidation: true,
        clickOffset: { x: 0, y: 0 } // Offset from element center
    },
    
    // Type settings
    browser_type: {
        typingDelay: 10, // Milliseconds between keystrokes
        clearBeforeType: true,
        waitForFocus: true,
        enableNaturalTyping: true, // Simulate human-like typing
        maxTextLength: 10000
    },
    
    // Close settings
    browser_close: {
        gracefulShutdown: true,
        shutdownTimeout: 5000,
        forceKillOnTimeout: true,
        cleanupUserData: false // Keep user data by default
    },
    
    // Global browser settings
    global: {
        maxConcurrentOperations: 5,
        enableScreenshotOnError: false,
        autoRecovery: true,
        healthCheckInterval: 60000, // 1 minute
        enablePerformanceMetrics: false
    }
};
