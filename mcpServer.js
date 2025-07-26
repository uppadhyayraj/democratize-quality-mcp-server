// server.js (main entry point)
const app = require('./src/app'); // Import our Express app
const config = require('./src/config'); // Import configuration

const PORT = config.PORT;

// Start the server
const server = app.listen(PORT, () => {
    console.log(`MCP UI Automation Server running on http://localhost:${PORT}`);
    console.log(`Available endpoints (defined in src/routes/browserRoutes.js):`);
    console.log(`  POST /browser/launch`);
    console.log(`  POST /browser/:browserId/navigate`);
    console.log(`  POST /browser/:browserId/click`);
    console.log(`  POST /browser/:browserId/type`);
    console.log(`  GET /browser/:browserId/screenshot`);
    console.log(`  GET /browser/:browserId/dom`);
    console.log(`  POST /browser/:browserId/close`);
    console.log(`\nNote: For initial login, launch with "headless": false and a "userDataDir".`);
});

// Handle graceful shutdown (e.g., Ctrl+C)
process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down MCP server...');
    // We'll add logic here to properly close all active browsers
    // This will be handled by the browserService, which app.js will expose.
    try {
        const { shutdownAllBrowsers } = require('./src/services/browserService');
        await shutdownAllBrowsers(); // Call the service to clean up
        console.log('[Server] All browser instances closed.');
    } catch (err) {
        console.error('[Server] Error during graceful shutdown:', err.message);
    } finally {
        console.log('[Server] Server exiting.');
        process.exit(0);
    }
});

// For unhandled promise rejections (good practice)
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
    server.close(() => {
        process.exit(1); // Exit with a failure code
    });
});
