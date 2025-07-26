const path = require('path'); // Ensure path is imported if needed for other helpers

/**
 * Finds a DOM node by selector (CSS or XPath) and returns its NodeId.
 * @param {object} cdpClient - The Chrome DevTools Protocol client.
 * @param {string} selectorType - 'css' or 'xpath'.
 * @param {string} selectorValue - The CSS selector or XPath string.
 * @returns {Promise<number|null>} - The NodeId of the found element, or null if not found.
 */
async function findNodeBySelector(cdpClient, selectorType, selectorValue) {
    const { DOM, Runtime } = cdpClient;
    let nodeId = null;

    try {
        const rootNode = await DOM.getDocument({ depth: 1 }); // Get root document node

        if (selectorType === 'css') {
            const result = await DOM.querySelector({
                nodeId: rootNode.root.nodeId,
                selector: selectorValue
            });
            nodeId = result.nodeId;
        } else if (selectorType === 'xpath') {
            // Use Runtime.evaluate to execute XPath in the browser context
            const expression = `document.evaluate("${selectorValue}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
            const { result: jsResult } = await Runtime.evaluate({ expression: expression, returnByValue: false });

            if (jsResult.objectId) {
                // Convert the JS objectId (remote object) back to a DOM NodeId
                const { nodeId: resolvedNodeId } = await DOM.requestNode({ objectId: jsResult.objectId });
                nodeId = resolvedNodeId;
            }
        } else {
            console.warn(`[findNodeBySelector] Unsupported selector type: ${selectorType}`);
        }

        return nodeId;

    } catch (error) {
        console.error(`[findNodeBySelector] Error finding node by selector (${selectorType}: ${selectorValue}):`, error.message);
        return null;
    }
}

/**
 * Scrolls an element into view and calculates its center coordinates for clicking.
 * @param {object} cdpClient - The Chrome DevTools Protocol client.
 * @param {number} nodeId - The NodeId of the element to interact with.
 * @returns {Promise<{x: number, y: number}|null>} - Object with x, y coordinates, or null if error.
 */
async function getElementClickCoordinates(cdpClient, nodeId) {
    const { DOM } = cdpClient; // Page is not directly used here
    try {
        // Scroll the element into view first
        await DOM.scrollIntoViewIfNeeded({ nodeId: nodeId });
        // Give browser a moment to render after scroll
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for rendering

        // Get the box model to find coordinates
        const { model } = await DOM.getBoxModel({ nodeId: nodeId });

        if (!model) {
            console.error(`[getElementClickCoordinates] No box model found for nodeId: ${nodeId}`);
            return null;
        }

        // Calculate center coordinates based on the content box
        // model.content is an array of 8 numbers: [x1, y1, x2, y2, x3, y3, x4, y4]
        // representing the four corners of the content box (top-left, top-right, bottom-right, bottom-left)
        const centerX = (model.content[0] + model.content[2]) / 2;
        const centerY = (model.content[1] + model.content[5]) / 2;

        return { x: centerX, y: centerY };
    } catch (error) {
        console.error(`[getElementClickCoordinates] Error getting element coordinates for nodeId ${nodeId}:`, error.message);
        return null;
    }
}

module.exports = {
    findNodeBySelector,
    getElementClickCoordinates
};
