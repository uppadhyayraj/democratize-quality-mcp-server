// src/routes/browserRoutes.js
const express = require('express');
const router = express.Router(); // Create an Express Router instance
const browserService = require('../services/browserService'); // Import our browser service

// Middleware to ensure browserId exists for specific routes
async function ensureBrowserInstance(req, res, next) {
    const { browserId } = req.params;
    // We don't need to call getBrowserInstance here explicitly as browserService functions
    // will throw an error if the browserId is not found, which our catch blocks will handle.
    // This middleware primarily serves as a clear indication that browserId is expected.
    if (!browserId) {
        return res.status(400).json({ error: 'Browser ID is required in the URL path.' });
    }
    next();
}


// --- API Endpoints ---

// POST /browser/launch - Launch a new Chrome instance
router.post('/launch', async (req, res) => {
    const { headless, port, userDataDir } = req.body;
    try {
        const result = await browserService.launchBrowser(headless, port, userDataDir);
        res.status(200).json({
            status: 'success',
            message: 'Browser launched successfully',
            data: result
        });
    } catch (error) {
        console.error('[Route] Error in /browser/launch:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to launch browser',
            details: error.message
        });
    }
});

// POST /browser/:browserId/navigate - Navigate a specific browser instance to a URL
router.post('/:browserId/navigate', ensureBrowserInstance, async (req, res) => {
    const { browserId } = req.params;
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ status: 'error', message: 'URL is required.' });
    }

    try {
        await browserService.navigateBrowser(browserId, url);
        res.status(200).json({
            status: 'success',
            message: `Mapsd browser ${browserId} to ${url}`
        });
    } catch (error) {
        console.error(`[Route] Error in /browser/${browserId}/navigate:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to navigate browser',
            details: error.message
        });
    }
});

// POST /browser/:browserId/click - Click an element
router.post('/:browserId/click', ensureBrowserInstance, async (req, res) => {
    const { browserId } = req.params;
    const { locator } = req.body;

    if (!locator || !locator.type || !locator.value) {
        return res.status(400).json({ status: 'error', message: 'Locator (type and value) is required for click action.' });
    }

    try {
        const coords = await browserService.clickElement(browserId, locator);
        res.status(200).json({
            status: 'success',
            message: `Clicked element with locator ${JSON.stringify(locator)}`,
            data: { coordinates: coords }
        });
    } catch (error) {
        console.error(`[Route] Error in /browser/${browserId}/click:`, error.message);
        const statusCode = error.message.includes('Element not found') ? 404 : 500;
        res.status(statusCode).json({
            status: 'error',
            message: 'Failed to click element',
            details: error.message
        });
    }
});

// POST /browser/:browserId/type - Type text into an element
router.post('/:browserId/type', ensureBrowserInstance, async (req, res) => {
    const { browserId } = req.params;
    const { locator, text } = req.body;

    if (!locator || !locator.type || !locator.value) {
        return res.status(400).json({ status: 'error', message: 'Locator (type and value) is required for type action.' });
    }
    if (typeof text !== 'string') {
        return res.status(400).json({ status: 'error', message: 'Text to type is required and must be a string.' });
    }

    try {
        await browserService.typeIntoElement(browserId, locator, text);
        res.status(200).json({
            status: 'success',
            message: `Typed "${text}" into element with locator ${JSON.stringify(locator)}`
        });
    } catch (error) {
        console.error(`[Route] Error in /browser/${browserId}/type:`, error.message);
        const statusCode = error.message.includes('Element not found') ? 404 : 500;
        res.status(statusCode).json({
            status: 'error',
            message: 'Failed to type into element',
            details: error.message
        });
    }
});

// GET /browser/:browserId/screenshot - Get screenshot (base64)
router.get('/:browserId/screenshot', ensureBrowserInstance, async (req, res) => {
    const { browserId } = req.params;
    // Query parameter for optional filename
    const fileName = req.query.fileName || `screenshot_${browserId}_${Date.now()}.png`;
    const saveToDisk = req.query.saveToDisk !== 'false'; // Default to true unless explicitly 'false'

    try {
        const imageData = await browserService.takeScreenshot(browserId, fileName, saveToDisk);
        res.status(200).json({
            status: 'success',
            message: 'Screenshot captured',
            data: { imageData: imageData, format: 'png', fileName: saveToDisk ? fileName : undefined }
        });
    } catch (error) {
        console.error(`[Route] Error in /browser/${browserId}/screenshot:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to capture screenshot',
            details: error.message
        });
    }
});

// GET /browser/:browserId/dom - Get page DOM
router.get('/:browserId/dom', ensureBrowserInstance, async (req, res) => {
    const { browserId } = req.params;
    try {
        const html = await browserService.getDomContent(browserId);
        res.status(200).json({
            status: 'success',
            message: 'DOM content retrieved',
            data: { html: html }
        });
    } catch (error) {
        console.error(`[Route] Error in /browser/${browserId}/dom:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve DOM content',
            details: error.message
        });
    }
});

// POST /browser/:browserId/close - Close a specific browser instance
router.post('/:browserId/close', ensureBrowserInstance, async (req, res) => {
    const { browserId } = req.params;
    try {
        await browserService.closeBrowser(browserId);
        res.status(200).json({
            status: 'success',
            message: `Browser ${browserId} closed successfully`
        });
    } catch (error) {
        console.error(`[Route] Error in /browser/${browserId}/close:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to close browser',
            details: error.message
        });
    }
});

module.exports = router; // Export the router instance
