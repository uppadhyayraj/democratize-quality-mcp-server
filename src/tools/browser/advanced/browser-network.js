const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');

/**
 * Enhanced Network Tool - Monitor and analyze network requests
 * Inspired by Playwright MCP network capabilities
 */
class BrowserNetworkTool extends ToolBase {
    static definition = {
        name: "browser_network",
        description: "Monitor network requests, analyze performance, and get detailed network information. Supports filtering and real-time monitoring.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                action: {
                    type: "string",
                    enum: ["list", "monitor", "clear", "filter", "performance"],
                    description: "The network action to perform"
                },
                filter: {
                    type: "object",
                    properties: {
                        url: { type: "string", description: "URL pattern to filter (regex supported)" },
                        method: { type: "string", description: "HTTP method to filter (GET, POST, etc.)" },
                        status: { type: "number", description: "HTTP status code to filter" },
                        resourceType: { 
                            type: "string", 
                            enum: ["Document", "Stylesheet", "Image", "Media", "Font", "Script", "TextTrack", "XHR", "Fetch", "EventSource", "WebSocket", "Manifest", "Other"],
                            description: "Resource type to filter"
                        }
                    },
                    description: "Filter criteria for network requests"
                },
                includeResponseBody: {
                    type: "boolean",
                    default: false,
                    description: "Whether to include response body in results (for list action)"
                },
                includeRequestBody: {
                    type: "boolean", 
                    default: false,
                    description: "Whether to include request body in results (for list action)"
                },
                limit: {
                    type: "number",
                    default: 50,
                    description: "Maximum number of requests to return"
                }
            },
            required: ["browserId", "action"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the operation was successful" },
                action: { type: "string", description: "The action that was performed" },
                requests: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            url: { type: "string" },
                            method: { type: "string" },
                            status: { type: "number" },
                            statusText: { type: "string" },
                            resourceType: { type: "string" },
                            timing: { type: "object" },
                            headers: { type: "object" },
                            size: { type: "number" }
                        }
                    },
                    description: "List of network requests"
                },
                summary: {
                    type: "object",
                    properties: {
                        totalRequests: { type: "number" },
                        failedRequests: { type: "number" },
                        totalSize: { type: "number" },
                        averageTime: { type: "number" }
                    },
                    description: "Network summary statistics"
                },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "action", "browserId"]
        }
    };

    constructor() {
        super();
        this.networkData = new Map(); // browserId -> network data
    }

    async execute(parameters) {
        const { 
            browserId, 
            action, 
            filter = {}, 
            includeResponseBody = false,
            includeRequestBody = false,
            limit = 50
        } = parameters;
        
        const browser = browserService.getBrowser(browserId);
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
            case 'monitor':
                await this.startNetworkMonitoring(client, browserId);
                result.success = true;
                result.message = 'Network monitoring started';
                break;
                
            case 'list':
                const requests = await this.listRequests(browserId, filter, includeRequestBody, includeResponseBody, limit);
                result.success = true;
                result.requests = requests.requests;
                result.summary = requests.summary;
                break;
                
            case 'clear':
                this.clearNetworkData(browserId);
                result.success = true;
                result.message = 'Network data cleared';
                break;
                
            case 'filter':
                const filteredRequests = await this.filterRequests(browserId, filter, limit);
                result.success = true;
                result.requests = filteredRequests.requests;
                result.summary = filteredRequests.summary;
                break;
                
            case 'performance':
                const perfData = await this.getPerformanceData(browserId);
                result.success = true;
                result.performance = perfData;
                break;
                
            default:
                throw new Error(`Unsupported network action: ${action}`);
        }

        return result;
    }

    /**
     * Start monitoring network requests
     */
    async startNetworkMonitoring(client, browserId) {
        // Enable network domain
        await client.Network.enable();
        
        // Initialize storage for this browser
        if (!this.networkData.has(browserId)) {
            this.networkData.set(browserId, {
                requests: [],
                responses: new Map(),
                startTime: Date.now()
            });
        }

        const networkStore = this.networkData.get(browserId);

        // Listen for network events
        client.Network.requestWillBeSent((params) => {
            const request = {
                requestId: params.requestId,
                url: params.request.url,
                method: params.request.method,
                headers: params.request.headers,
                postData: params.request.postData,
                timestamp: params.timestamp,
                resourceType: params.type,
                initiator: params.initiator,
                startTime: Date.now()
            };
            
            networkStore.requests.push(request);
        });

        client.Network.responseReceived((params) => {
            const response = {
                requestId: params.requestId,
                url: params.response.url,
                status: params.response.status,
                statusText: params.response.statusText,
                headers: params.response.headers,
                mimeType: params.response.mimeType,
                timestamp: params.timestamp,
                encodedDataLength: params.response.encodedDataLength,
                fromCache: params.response.fromDiskCache || params.response.fromServiceWorker
            };
            
            networkStore.responses.set(params.requestId, response);
        });

        client.Network.loadingFinished((params) => {
            const request = networkStore.requests.find(r => r.requestId === params.requestId);
            const response = networkStore.responses.get(params.requestId);
            
            if (request && response) {
                request.endTime = Date.now();
                request.duration = request.endTime - request.startTime;
                request.response = response;
                request.encodedDataLength = params.encodedDataLength;
            }
        });

        client.Network.loadingFailed((params) => {
            const request = networkStore.requests.find(r => r.requestId === params.requestId);
            if (request) {
                request.failed = true;
                request.errorText = params.errorText;
                request.endTime = Date.now();
                request.duration = request.endTime - request.startTime;
            }
        });
    }

    /**
     * List network requests with optional filtering
     */
    async listRequests(browserId, filter, includeRequestBody, includeResponseBody, limit) {
        const networkStore = this.networkData.get(browserId);
        if (!networkStore) {
            return { requests: [], summary: this.createSummary([]) };
        }

        let requests = [...networkStore.requests];
        
        // Apply filters
        requests = this.applyFilters(requests, filter);
        
        // Limit results
        requests = requests.slice(-limit);
        
        // Format requests
        const formattedRequests = await Promise.all(
            requests.map(req => this.formatRequest(req, includeRequestBody, includeResponseBody))
        );

        return {
            requests: formattedRequests,
            summary: this.createSummary(formattedRequests)
        };
    }

    /**
     * Filter existing requests
     */
    async filterRequests(browserId, filter, limit) {
        return this.listRequests(browserId, filter, false, false, limit);
    }

    /**
     * Get performance data
     */
    async getPerformanceData(browserId) {
        const networkStore = this.networkData.get(browserId);
        if (!networkStore) {
            return { error: 'No network data available' };
        }

        const requests = networkStore.requests.filter(r => r.response && !r.failed);
        
        if (requests.length === 0) {
            return { error: 'No completed requests found' };
        }

        const totalSize = requests.reduce((sum, req) => sum + (req.encodedDataLength || 0), 0);
        const totalTime = requests.reduce((sum, req) => sum + (req.duration || 0), 0);
        const avgTime = totalTime / requests.length;

        const resourceTypes = {};
        requests.forEach(req => {
            const type = req.resourceType || 'Other';
            if (!resourceTypes[type]) {
                resourceTypes[type] = { count: 0, size: 0 };
            }
            resourceTypes[type].count++;
            resourceTypes[type].size += req.encodedDataLength || 0;
        });

        const statusCodes = {};
        requests.forEach(req => {
            const status = req.response?.status || 'Unknown';
            statusCodes[status] = (statusCodes[status] || 0) + 1;
        });

        return {
            totalRequests: requests.length,
            totalSize: totalSize,
            averageResponseTime: Math.round(avgTime),
            resourceTypes: resourceTypes,
            statusCodes: statusCodes,
            slowestRequests: requests
                .sort((a, b) => (b.duration || 0) - (a.duration || 0))
                .slice(0, 5)
                .map(req => ({
                    url: req.url,
                    duration: req.duration,
                    size: req.encodedDataLength
                })),
            largestRequests: requests
                .sort((a, b) => (b.encodedDataLength || 0) - (a.encodedDataLength || 0))
                .slice(0, 5)
                .map(req => ({
                    url: req.url,
                    size: req.encodedDataLength,
                    duration: req.duration
                }))
        };
    }

    /**
     * Apply filters to requests
     */
    applyFilters(requests, filter) {
        return requests.filter(req => {
            if (filter.url) {
                const urlRegex = new RegExp(filter.url, 'i');
                if (!urlRegex.test(req.url)) return false;
            }
            
            if (filter.method && req.method !== filter.method.toUpperCase()) {
                return false;
            }
            
            if (filter.status && req.response?.status !== filter.status) {
                return false;
            }
            
            if (filter.resourceType && req.resourceType !== filter.resourceType) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * Format a single request for output
     */
    async formatRequest(request, includeRequestBody, includeResponseBody) {
        const formatted = {
            url: request.url,
            method: request.method,
            resourceType: request.resourceType,
            status: request.response?.status,
            statusText: request.response?.statusText,
            duration: request.duration,
            size: request.encodedDataLength,
            failed: request.failed || false,
            fromCache: request.response?.fromCache || false,
            timestamp: request.timestamp
        };

        if (includeRequestBody && request.postData) {
            formatted.requestBody = request.postData;
        }

        if (request.headers) {
            formatted.requestHeaders = request.headers;
        }

        if (request.response?.headers) {
            formatted.responseHeaders = request.response.headers;
        }

        if (request.errorText) {
            formatted.error = request.errorText;
        }

        return formatted;
    }

    /**
     * Create summary statistics
     */
    createSummary(requests) {
        const completed = requests.filter(r => !r.failed);
        const failed = requests.filter(r => r.failed);
        
        const totalSize = completed.reduce((sum, req) => sum + (req.size || 0), 0);
        const totalTime = completed.reduce((sum, req) => sum + (req.duration || 0), 0);
        const avgTime = completed.length > 0 ? totalTime / completed.length : 0;

        return {
            totalRequests: requests.length,
            completedRequests: completed.length,
            failedRequests: failed.length,
            totalSize: totalSize,
            averageTime: Math.round(avgTime)
        };
    }

    /**
     * Clear network data for a browser
     */
    clearNetworkData(browserId) {
        this.networkData.delete(browserId);
    }
}

module.exports = BrowserNetworkTool;
