const CDP = require('chrome-remote-interface');
//const launchChrome = require('chrome-launcher').launch;
const fs = require('fs');
const path = require('path');
const { findNodeBySelector, getElementClickCoordinates } = require('../utils/browserHelpers'); // Import helpers
const config = require('../config');

// A private in-memory store for our browser instances within the service
// Each key will be a unique browserId, value will be { chromeInstance, cdpClient, userDataDir }
const activeBrowsers = {};

/**
 * Ensures a user data directory exists.
 * @param {string} dirPath - The absolute path to the user data directory.
 */
function ensureUserDataDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[BrowserService] Created user data directory: ${dirPath}`);
    } else {
        console.log(`[BrowserService] Using existing user data directory: ${dirPath}`);
    }
}

/**
 * Retrieves a browser instance by ID.
 * @param {string} browserId - The ID of the browser instance.
 * @returns {object|null} - The browser instance object or null if not found.
 */
function getBrowserInstance(browserId) {
    return activeBrowsers[browserId];
}

/**
 * Launches a new Chrome instance.
 * @param {boolean} headless - Whether to run Chrome in headless mode.
 * @param {number} port - The port for remote debugging.
 * @param {string|null} userDataDir - Path to the user data directory for persistent profiles.
 * @returns {Promise<object>} - Object containing browserId, port, and resolvedUserDataDir.
 */
async function launchBrowser(headless, port, userDataDir) {
    let chrome;
    let client;
    const { launch: launchChrome } = await import('chrome-launcher');
    let resolvedUserDataDir = null;

    try {
        if (userDataDir) {
            resolvedUserDataDir = path.resolve(process.cwd(), userDataDir);
            ensureUserDataDir(resolvedUserDataDir);
        }

        console.log(`[BrowserService] Launching Chrome (headless: ${headless}, userDataDir: ${resolvedUserDataDir || 'temporary'})...`);

        const launchOptions = {
            port: port,
            userDataDir: resolvedUserDataDir, // Set userDataDir if provided
            chromeFlags: [
                headless ? '--headless=new' : '',
                '--disable-gpu',
                '--disable-setuid-sandbox',
                '--no-sandbox'
            ].filter(Boolean)
        };

        chrome = await launchChrome(launchOptions);

        // Generate browserId: profile-name if userDataDir is used, otherwise a unique timestamped ID
        const browserId = userDataDir ? `profile-${path.basename(resolvedUserDataDir)}` : `browser-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        if (activeBrowsers[browserId]) {
            console.warn(`[BrowserService] Warning: Browser ID '${browserId}' already exists. Overwriting.`);
            // In a real scenario, you might want more sophisticated handling here,
            // e.g., error if ID exists, or try to attach to existing.
            // For now, we're assuming a new launch means a fresh start or overwrite.
            try { // Attempt to clean up old instance if it exists
                if (activeBrowsers[browserId].cdpClient) activeBrowsers[browserId].cdpClient.close();
                if (activeBrowsers[browserId].chromeInstance) await activeBrowsers[browserId].chromeInstance.kill();
            } catch (cleanupErr) {
                console.error(`[BrowserService] Error cleaning up old instance for ${browserId}:`, cleanupErr.message);
            }
        }

        activeBrowsers[browserId] = { chromeInstance: chrome, cdpClient: null, userDataDir: resolvedUserDataDir };
        console.log(`[BrowserService] Chrome launched on port ${chrome.port} with ID: ${browserId}`);

        client = await CDP({ port: chrome.port });
        activeBrowsers[browserId].cdpClient = client;

        const { Page, Runtime, DOM, Network, Security, Input } = client; // Enable Input domain here
        await Page.enable();
        await Runtime.enable();
        await DOM.enable();
        await Network.enable();
        await Security.enable();
        await Input.enable(); // Enable Input domain

        console.log(`[BrowserService] CDP client connected and domains enabled for ${browserId}.`);

        return { browserId, port: chrome.port, userDataDir: resolvedUserDataDir };

    } catch (error) {
        console.error(`[BrowserService] Error launching browser:`, error);
        if (chrome && !client) { // If chrome launched but CDP connection failed
            try {
                await chrome.kill();
                console.log(`[BrowserService] Partially launched Chrome instance killed due to error.`);
            } catch (killError) {
                console.error(`[BrowserService] Error killing partially launched Chrome:`, killError);
            }
        }
        throw error; // Re-throw to be caught by the route handler
    }
}

/**
 * Navigates a specific browser instance to a URL.
 * @param {string} browserId - The ID of the browser instance.
 * @param {string} url - The URL to navigate to.
 * @returns {Promise<void>}
 */
async function navigateBrowser(browserId, url) {
    const instance = getBrowserInstance(browserId);
    if (!instance) throw new Error(`Browser instance with ID '${browserId}' not found.`);

    const { cdpClient } = instance;
    console.log(`[BrowserService] Browser ${browserId} navigating to: ${url}`);
    await cdpClient.Page.navigate({ url: url });
    await cdpClient.Page.loadEventFired(); // Wait for page to load
    console.log(`[BrowserService] Browser ${browserId} successfully navigated to ${url}.`);
}

/**
 * Takes a screenshot of a specific browser page and can save it to disk.
 * @param {string} browserId - The ID of the browser instance.
 * @param {string} [fileName='screenshot.png'] - Optional: The name of the file to save the screenshot as.
 * @param {boolean} [saveToDisk=true] - Optional: Whether to save the screenshot to disk.
 * @returns {Promise<string>} - Base64 encoded screenshot data.
 */
async function takeScreenshot(browserId, fileName = 'screenshot.png', saveToDisk = true) { // Added fileName and saveToDisk params
    const instance = getBrowserInstance(browserId);
    if (!instance) throw new Error(`Browser instance with ID '${browserId}' not found.`);

    const { cdpClient } = instance;
    console.log(`[BrowserService] Taking screenshot for browser ${browserId}...`);
    const screenshot = await cdpClient.Page.captureScreenshot({ format: 'png', quality: 80 });

    if (saveToDisk) {
        const screenshotBuffer = Buffer.from(screenshot.data, 'base64');
        // Ensure the output directory exists
        if (!fs.existsSync(config.OUTPUT_DIR)) {
            fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });
        }
        const filePath = path.join(config.OUTPUT_DIR, fileName);
        fs.writeFileSync(filePath, screenshotBuffer);
        console.log(`[BrowserService] Screenshot saved to ${filePath}`);
    }

    console.log(`[BrowserService] Screenshot captured for browser ${browserId}.`);
    return screenshot.data; // Always return base64 data to the caller (e.g., AI agent)
}

/**
 * Gets the current DOM content of a specific browser page.
 * @param {string} browserId - The ID of the browser instance.
 * @returns {Promise<string>} - The outer HTML of the document.
 */
async function getDomContent(browserId) {
    const instance = getBrowserInstance(browserId);
    if (!instance) throw new Error(`Browser instance with ID '${browserId}' not found.`);

    const { cdpClient } = instance;
    console.log(`[BrowserService] Getting DOM for browser ${browserId}...`);
    const documentNode = await cdpClient.DOM.getDocument({ depth: -1 });
    const outerHTML = await cdpClient.DOM.getOuterHTML({ nodeId: documentNode.root.nodeId });
    console.log(`[BrowserService] DOM content retrieved for browser ${browserId}.`);
    return outerHTML.outerHTML;
}

/**
 * Clicks an element identified by a locator.
 * @param {string} browserId - The ID of the browser instance.
 * @param {object} locator - { type: 'css'|'xpath', value: 'selector' }
 * @returns {Promise<object>} - Coordinates of the click.
 */
async function clickElement(browserId, locator) {
    const instance = getBrowserInstance(browserId);
    if (!instance) throw new Error(`Browser instance with ID '${browserId}' not found.`);

    const { cdpClient } = instance;
    const { Input } = cdpClient;

    console.log(`[BrowserService] Browser ${browserId}: Attempting to click element with locator:`, locator);

    const nodeId = await findNodeBySelector(cdpClient, locator.type, locator.value);
    if (!nodeId) {
        throw new Error(`Element not found for locator: ${JSON.stringify(locator)}`);
    }

    const coords = await getElementClickCoordinates(cdpClient, nodeId);
    if (!coords) {
        throw new Error(`Could not determine click coordinates for element: ${JSON.stringify(locator)}`);
    }

    await Input.dispatchMouseEvent({
        type: 'mousePressed',
        button: 'left',
        x: coords.x,
        y: coords.y,
        clickCount: 1
    });
    await Input.dispatchMouseEvent({
        type: 'mouseReleased',
        button: 'left',
        x: coords.x,
        y: coords.y,
        clickCount: 1
    });

    console.log(`[BrowserService] Browser ${browserId}: Clicked element at x: ${coords.x}, y: ${coords.y}`);
    return coords;
}

/**
 * Types text into an element identified by a locator.
 * @param {string} browserId - The ID of the browser instance.
 * @param {object} locator - { type: 'css'|'xpath', value: 'selector' }
 * @param {string} text - The text to type.
 * @returns {Promise<void>}
 */
async function typeIntoElement(browserId, locator, text) {
    const instance = getBrowserInstance(browserId);
    if (!instance) throw new Error(`Browser instance with ID '${browserId}' not found.`);

    const { cdpClient } = instance;
    const { DOM, Input } = cdpClient;

    console.log(`[BrowserService] Browser ${browserId}: Attempting to type "${text}" into element with locator:`, locator);

    const nodeId = await findNodeBySelector(cdpClient, locator.type, locator.value);
    if (!nodeId) {
        throw new Error(`Element not found for locator: ${JSON.stringify(locator)}`);
    }

    await DOM.focus({ nodeId: nodeId });
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for focus

    // Clear existing text: Cmd/Ctrl+A then Backspace
    await Input.dispatchKeyEvent({ type: 'keyDown', text: 'a', modifiers: (process.platform === 'darwin' ? 4 : 2) }); // 4 for Meta (Cmd), 2 for Control
    await Input.dispatchKeyEvent({ type: 'keyUp', text: 'a', modifiers: (process.platform === 'darwin' ? 4 : 2) });
    await Input.dispatchKeyEvent({ type: 'keyDown', key: 'Backspace' });
    await Input.dispatchKeyEvent({ type: 'keyUp', key: 'Backspace' });
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for clear

    for (const char of text) {
        await Input.dispatchKeyEvent({ type: 'keyDown', text: char, key: char });
        await Input.dispatchKeyEvent({ type: 'keyUp', text: char, key: char });
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for realism
    }

    console.log(`[BrowserService] Browser ${browserId}: Typed "${text}" into element.`);
}

/**
 * Closes a specific browser instance.
 * @param {string} browserId - The ID of the browser instance.
 * @returns {Promise<void>}
 */
async function closeBrowser(browserId) {
    const instance = getBrowserInstance(browserId);
    if (!instance) throw new Error(`Browser instance with ID '${browserId}' not found.`);

    const { chromeInstance, cdpClient, userDataDir } = instance;

    console.log(`[BrowserService] Closing browser ${browserId} (profile: ${userDataDir || 'temporary'})...`);
    if (cdpClient) {
        try {
            cdpClient.close();
            console.log(`[BrowserService] CDP client disconnected for ${browserId}.`);
        } catch (err) {
            console.warn(`[BrowserService] Error during CDP client close for ${browserId}:`, err.message);
        }
    }
    if (chromeInstance) {
        try {
            await chromeInstance.kill();
            console.log(`[BrowserService] Chrome instance ${browserId} killed.`);
        } catch (err) {
            console.warn(`[BrowserService] Error during Chrome instance kill for ${browserId}:`, err.message);
        }
    }
    delete activeBrowsers[browserId]; // Remove from our store
    console.log(`[BrowserService] Browser ${browserId} removed from active list.`);
}

/**
 * Shuts down all active browser instances. Used for graceful server shutdown.
 * @returns {Promise<void>}
 */
async function shutdownAllBrowsers() {
    const browserIds = Object.keys(activeBrowsers);
    if (browserIds.length === 0) {
        console.log('[BrowserService] No active browsers to shut down.');
        return;
    }
    console.log(`[BrowserService] Shutting down ${browserIds.length} active browser(s)...`);
    await Promise.all(browserIds.map(id => closeBrowser(id).catch(err => {
        console.error(`[BrowserService] Failed to gracefully close browser ${id}:`, err.message);
        // Continue with other shutdowns even if one fails
    })));
    console.log('[BrowserService] All active browsers shut down.');
}


module.exports = {
    launchBrowser,
    navigateBrowser,
    takeScreenshot,
    getDomContent,
    clickElement,
    typeIntoElement,
    closeBrowser,
    shutdownAllBrowsers // Export for server.js to use
};
