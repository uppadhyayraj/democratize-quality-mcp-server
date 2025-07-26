// browserControl.js
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path'); // We need path for resolving userDataDir


async function automateBrowser() {
    let chrome;
    let client;
    const { launch: launchChrome } = await import('chrome-launcher');
    // Define your user data directory path
    // IMPORTANT: Create this directory if it doesn't exist before running the script
    const myUserDataDir = path.resolve(__dirname, './my_test_profile'); // This will create it in your project folder

    try {
        // Ensure the directory exists
        if (!fs.existsSync(myUserDataDir)) {
            fs.mkdirSync(myUserDataDir, { recursive: true });
            console.log(`Created user data directory: ${myUserDataDir}`);
        } else {
            console.log(`Using existing user data directory: ${myUserDataDir}`);
        }

        console.log('Launching Chrome with remote debugging...');
        chrome = await launchChrome({
            port: 9222,
            userDataDir: myUserDataDir, // <--- THE KEY CHANGE HERE
            chromeFlags: [
                // Set to false to see the browser UI
                // For initial login, it's highly recommended to use false so you can interact
                //'--headless=false', // Set this to 'new' or '' for headless mode once logged in
                '--disable-gpu',
                '--disable-setuid-sandbox',
                '--no-sandbox'
            ]
        });
        console.log(`Chrome launched on port ${chrome.port} using profile: ${myUserDataDir}`);

        client = await CDP({ port: chrome.port });
        console.log('Connected to Chrome DevTools Protocol.');

        const { Page, Runtime, DOM, Network } = client; // Also enable Network for potential cookie inspection later

        await Page.enable();
        await Runtime.enable();
        await DOM.enable();
        await Network.enable(); // Enable Network domain

        console.log('Page, Runtime, DOM, and Network domains enabled.');

        const url = 'https://www.saucedemo.com'; // You can change this to your company login page
        console.log(`Navigating to: ${url}`);
        await Page.navigate({ url: url });
        await Page.loadEventFired();
        console.log('Page loaded.');

        // --- Authentication Step ---
        // FIRST RUN:
        // When you run this for the first time with `--headless=false`,
        // a Chrome window will open. Manually navigate to your company's login page
        // and sign in. Complete all login steps (username, password, MFA, SSO etc.).
        // Once logged in, DO NOT close the browser manually.
        // Let the script finish, or press Ctrl+C to trigger the finally block.
        // The script will then close Chrome, and the session state will be saved
        // in 'my_test_profile' directory.

        // SUBSEQUENT RUNS:
        // For subsequent runs, you can change `--headless=false` to `--headless=new`
        // (or just remove it if you prefer `chrome-launcher`'s default headless behavior).
        // Chrome will launch, load the saved profile, and you should be logged in automatically.
        // You can then add your actual UI automation steps here, e.g., navigating to
        // internal dashboards, filling forms, etc.

        // Example: Wait for a few seconds so you can see the login happen
        console.log('Waiting for 10 seconds (for manual login/observation)...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // After the wait, take a screenshot to verify login state
        console.log('Taking screenshot after wait...');
        const screenshot = await Page.captureScreenshot({ format: 'png', quality: 80 });
        const screenshotBuffer = Buffer.from(screenshot.data, 'base64');
        fs.writeFileSync('example_screenshot_after_login.png', screenshotBuffer);
        console.log('Screenshot saved as example_screenshot_after_login.png');

        console.log('Getting page title...');
        const result = await Runtime.evaluate({ expression: 'document.title' });
        const pageTitle = result.result.value;
        console.log(`Page Title: "${pageTitle}"`);

        console.log('Getting outer HTML...');
        const documentNode = await DOM.getDocument({ depth: -1 });
        const outerHTML = await DOM.getOuterHTML({ nodeId: documentNode.root.nodeId });
        fs.writeFileSync('example_dom_after_login.html', outerHTML.outerHTML);
        console.log('DOM saved as example_dom_after_login.html');


    } catch (err) {
        console.error('CRITICAL ERROR during browser automation:', err.message);
        console.error('Details:', err);
    } finally {
        if (client) {
            console.log('Disconnecting CDP client...');
            client.close();
        }
        if (chrome) {
            console.log('Closing launched Chrome instance...');
            await chrome.kill();
            console.log('Chrome instance closed.');
        }
    }
}

automateBrowser();
