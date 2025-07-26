const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');
const fs = require('fs').promises;
const path = require('path');

/**
 * Enhanced File Tool - Handle file uploads, downloads, and file system interactions
 * Inspired by Playwright MCP file handling capabilities
 */
class BrowserFileTool extends ToolBase {
    static definition = {
        name: "browser_file",
        description: "Handle file operations including uploads, downloads, and file input interactions. Supports various file formats and validation.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                action: {
                    type: "string",
                    enum: ["upload", "download", "setDownloadPath", "getDownloads", "clearDownloads"],
                    description: "The file operation to perform"
                },
                selector: {
                    type: "string",
                    description: "CSS selector for file input element (for upload action)"
                },
                filePath: {
                    type: "string",
                    description: "Path to the file to upload or download location"
                },
                files: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of file paths for multiple file upload"
                },
                downloadPath: {
                    type: "string",
                    description: "Directory path for downloads (for setDownloadPath action)"
                },
                url: {
                    type: "string",
                    description: "Direct download URL (for download action without clicking)"
                },
                fileName: {
                    type: "string",
                    description: "Specific filename for download"
                },
                timeout: {
                    type: "number",
                    default: 30000,
                    description: "Timeout in milliseconds for file operations"
                },
                waitForDownload: {
                    type: "boolean",
                    default: true,
                    description: "Whether to wait for download completion"
                },
                overwrite: {
                    type: "boolean", 
                    default: false,
                    description: "Whether to overwrite existing files"
                }
            },
            required: ["browserId", "action"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the operation was successful" },
                action: { type: "string", description: "The action that was performed" },
                filePath: { type: "string", description: "Path of the uploaded/downloaded file" },
                files: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            path: { type: "string" },
                            size: { type: "number" },
                            type: { type: "string" },
                            url: { type: "string" }
                        }
                    },
                    description: "List of files"
                },
                downloadInfo: {
                    type: "object",
                    properties: {
                        url: { type: "string" },
                        filename: { type: "string" },
                        state: { type: "string" },
                        totalBytes: { type: "number" },
                        receivedBytes: { type: "number" }
                    },
                    description: "Download progress information"
                },
                message: { type: "string", description: "Operation result message" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "action", "browserId"]
        }
    };

    constructor() {
        super();
        this.downloadCallbacks = new Map(); // browserId -> callback functions
        this.downloadStates = new Map(); // browserId -> download states
    }

    async execute(parameters) {
        const { 
            browserId, 
            action, 
            selector, 
            filePath, 
            files = [], 
            downloadPath,
            url,
            fileName,
            timeout = 30000,
            waitForDownload = true,
            overwrite = false
        } = parameters;
        
        const browser = browserService.getBrowserInstance(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found`);
        }

        const client = browser.client;
        
        let result = {
            success: false,
            action: action,
            browserId: browserId
        };

        switch (action) {
            case 'upload':
                if (!selector) {
                    throw new Error('Selector is required for upload action');
                }
                const uploadPaths = filePath ? [filePath] : files;
                if (uploadPaths.length === 0) {
                    throw new Error('Either filePath or files array is required for upload');
                }
                await this.uploadFiles(client, selector, uploadPaths);
                result.success = true;
                result.files = await this.getFileInfo(uploadPaths);
                result.message = `Uploaded ${uploadPaths.length} file(s)`;
                break;
                
            case 'download':
                if (!url && !selector) {
                    throw new Error('Either URL or selector is required for download action');
                }
                const downloadResult = await this.downloadFile(client, url, selector, downloadPath, fileName, timeout, waitForDownload);
                result.success = true;
                result.downloadInfo = downloadResult;
                result.filePath = downloadResult.path;
                result.message = 'Download completed';
                break;
                
            case 'setDownloadPath':
                if (!downloadPath) {
                    throw new Error('Download path is required for setDownloadPath action');
                }
                await this.setDownloadPath(client, downloadPath);
                result.success = true;
                result.message = `Download path set to: ${downloadPath}`;
                break;
                
            case 'getDownloads':
                const downloads = this.getDownloadHistory(browserId);
                result.success = true;
                result.files = downloads;
                result.message = `Found ${downloads.length} download(s)`;
                break;
                
            case 'clearDownloads':
                this.clearDownloadHistory(browserId);
                result.success = true;
                result.message = 'Download history cleared';
                break;
                
            default:
                throw new Error(`Unsupported file action: ${action}`);
        }

        return result;
    }

    /**
     * Upload files to a file input element
     */
    async uploadFiles(client, selector, filePaths) {
        // Validate files exist
        for (const filePath of filePaths) {
            try {
                await fs.access(filePath);
            } catch (error) {
                throw new Error(`File not found: ${filePath}`);
            }
        }

        // Enable DOM and Runtime domains
        await client.DOM.enable();
        await client.Runtime.enable();

        // Find the file input element
        const document = await client.DOM.getDocument();
        const element = await client.DOM.querySelector({
            nodeId: document.root.nodeId,
            selector: selector
        });

        if (!element.nodeId) {
            throw new Error(`File input element not found with selector: ${selector}`);
        }

        // Get element attributes to verify it's a file input
        const attributes = await client.DOM.getAttributes({
            nodeId: element.nodeId
        });

        const attrMap = {};
        for (let i = 0; i < attributes.attributes.length; i += 2) {
            attrMap[attributes.attributes[i]] = attributes.attributes[i + 1];
        }

        if (attrMap.type !== 'file') {
            throw new Error(`Element is not a file input: ${JSON.stringify(attrMap)}`);
        }

        // Set files on the input element
        await client.DOM.setFileInputFiles({
            files: filePaths,
            nodeId: element.nodeId
        });

        // Trigger change event
        await client.Runtime.evaluate({
            expression: `
                (function() {
                    const element = document.querySelector('${selector}');
                    if (element) {
                        const event = new Event('change', { bubbles: true });
                        element.dispatchEvent(event);
                        return true;
                    }
                    return false;
                })()
            `
        });
    }

    /**
     * Download a file either by URL or by clicking an element
     */
    async downloadFile(client, url, selector, downloadPath, fileName, timeout, waitForDownload) {
        // Enable Page domain for download events
        await client.Page.enable();

        let downloadInfo = null;
        const downloadPromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Download timeout after ${timeout}ms`));
            }, timeout);

            // Listen for download events
            client.Page.downloadWillBegin((params) => {
                clearTimeout(timeoutId);
                downloadInfo = {
                    url: params.url,
                    filename: params.suggestedFilename,
                    guid: params.guid
                };
            });

            client.Page.downloadProgress((params) => {
                if (downloadInfo && params.guid === downloadInfo.guid) {
                    downloadInfo.state = params.state;
                    downloadInfo.totalBytes = params.totalBytes;
                    downloadInfo.receivedBytes = params.receivedBytes;
                    
                    if (params.state === 'completed') {
                        resolve(downloadInfo);
                    } else if (params.state === 'canceled' || params.state === 'interrupted') {
                        reject(new Error(`Download ${params.state}: ${downloadInfo.filename}`));
                    }
                }
            });
        });

        // Set download behavior if path is specified
        if (downloadPath) {
            await this.setDownloadPath(client, downloadPath);
        }

        // Initiate download
        if (url) {
            // Direct URL download
            await client.Page.navigate({ url: url });
        } else if (selector) {
            // Click element to trigger download
            await client.Runtime.evaluate({
                expression: `
                    (function() {
                        const element = document.querySelector('${selector}');
                        if (element) {
                            element.click();
                            return true;
                        }
                        return false;
                    })()
                `
            });
        }

        // Wait for download if requested
        if (waitForDownload) {
            downloadInfo = await downloadPromise;
            
            // Store download info
            this.addDownloadToHistory(browserService.getBrowserInstance(client.browserId)?.id || 'unknown', downloadInfo);
        }

        return downloadInfo || { state: 'initiated' };
    }

    /**
     * Set the download directory
     */
    async setDownloadPath(client, downloadPath) {
        // Ensure directory exists
        try {
            await fs.mkdir(downloadPath, { recursive: true });
        } catch (error) {
            throw new Error(`Could not create download directory: ${error.message}`);
        }

        // Set download behavior
        await client.Page.setDownloadBehavior({
            behavior: 'allow',
            downloadPath: downloadPath
        });
    }

    /**
     * Get file information for uploaded files
     */
    async getFileInfo(filePaths) {
        const fileInfos = [];
        
        for (const filePath of filePaths) {
            try {
                const stats = await fs.stat(filePath);
                const info = {
                    name: path.basename(filePath),
                    path: filePath,
                    size: stats.size,
                    type: this.getFileType(filePath),
                    lastModified: stats.mtime
                };
                fileInfos.push(info);
            } catch (error) {
                fileInfos.push({
                    name: path.basename(filePath),
                    path: filePath,
                    error: error.message
                });
            }
        }
        
        return fileInfos;
    }

    /**
     * Get file type based on extension
     */
    getFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.zip': 'application/zip',
            '.json': 'application/json',
            '.csv': 'text/csv'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Add download to history
     */
    addDownloadToHistory(browserId, downloadInfo) {
        if (!this.downloadStates.has(browserId)) {
            this.downloadStates.set(browserId, []);
        }
        
        const downloads = this.downloadStates.get(browserId);
        downloads.push({
            ...downloadInfo,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 downloads
        if (downloads.length > 100) {
            downloads.splice(0, downloads.length - 100);
        }
    }

    /**
     * Get download history for a browser
     */
    getDownloadHistory(browserId) {
        return this.downloadStates.get(browserId) || [];
    }

    /**
     * Clear download history for a browser
     */
    clearDownloadHistory(browserId) {
        this.downloadStates.delete(browserId);
    }

    /**
     * Create a temporary file for testing
     */
    async createTempFile(content, extension = '.txt') {
        const tempDir = process.env.TMPDIR || '/tmp';
        const fileName = `temp-${Date.now()}${extension}`;
        const filePath = path.join(tempDir, fileName);
        
        await fs.writeFile(filePath, content);
        return filePath;
    }

    /**
     * Validate file upload constraints
     */
    validateFileUpload(filePath, constraints = {}) {
        const stats = require('fs').statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        const validation = {
            valid: true,
            errors: []
        };

        // Check file size
        if (constraints.maxSize && stats.size > constraints.maxSize) {
            validation.valid = false;
            validation.errors.push(`File size ${stats.size} exceeds maximum ${constraints.maxSize}`);
        }

        // Check file type
        if (constraints.allowedTypes && !constraints.allowedTypes.includes(ext)) {
            validation.valid = false;
            validation.errors.push(`File type ${ext} not allowed. Allowed: ${constraints.allowedTypes.join(', ')}`);
        }

        return validation;
    }
}

module.exports = BrowserFileTool;
