const ToolBase = require('../base/ToolBase');
const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * API Request Tool - Perform HTTP API requests with validation and session management
 */
class ApiRequestTool extends ToolBase {
    static definition = {
        name: "api_request",
        description: "Perform HTTP API requests with validation, session management, and request chaining capabilities for comprehensive API testing.",
        input_schema: {
            type: "object",
            properties: {
                sessionId: {
                    type: "string",
                    description: "Session ID for tracking multiple related requests"
                },
                method: {
                    type: "string",
                    enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
                    default: "GET",
                    description: "HTTP method for single request mode"
                },
                url: {
                    type: "string",
                    description: "URL for single request mode (required if not using chain)"
                },
                headers: {
                    type: "object",
                    additionalProperties: { type: "string" },
                    description: "HTTP headers for single request"
                },
                data: {
                    description: "Request body data (string, object, or buffer)"
                },
                expect: {
                    type: "object",
                    properties: {
                        status: { type: "number", description: "Expected HTTP status code" },
                        contentType: { type: "string", description: "Expected content type (partial match)" },
                        body: { description: "Expected response body (exact or partial match)" },
                        bodyRegex: { type: "string", description: "Regular expression to match against response body" }
                    },
                    description: "Validation expectations for response"
                },
                chain: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Step name for referencing results" },
                            method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"], default: "GET" },
                            url: { type: "string", description: "URL with template support {{step.field}}" },
                            headers: { type: "object", additionalProperties: { type: "string" } },
                            data: { description: "Request body with template support" },
                            expect: {
                                type: "object",
                                properties: {
                                    status: { type: "number" },
                                    contentType: { type: "string" },
                                    body: {},
                                    bodyRegex: { type: "string" }
                                }
                            },
                            extract: {
                                type: "object",
                                additionalProperties: { type: "string" },
                                description: "Extract fields from response: {varName: 'response.field.path'}"
                            }
                        },
                        required: ["name", "url"]
                    },
                    description: "Array of chained requests with template support"
                },
                timeout: {
                    type: "number",
                    default: 30000,
                    description: "Request timeout in milliseconds"
                }
            }
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the request(s) completed successfully" },
                sessionId: { type: "string", description: "Session ID for tracking" },
                mode: { type: "string", enum: ["single", "chain"], description: "Request mode used" },
                result: {
                    type: "object",
                    properties: {
                        ok: { type: "boolean" },
                        status: { type: "number" },
                        contentType: { type: "string" },
                        body: {},
                        validation: { type: "object" },
                        bodyValidation: { type: "object" }
                    },
                    description: "Single request result"
                },
                results: {
                    type: "array",
                    description: "Chain request results"
                },
                requestCount: { type: "number", description: "Number of requests made" },
                executionTime: { type: "number", description: "Total execution time in milliseconds" }
            },
            required: ["success", "sessionId"]
        }
    };

    constructor() {
        super();
        // Global session store (shared across tool instances)
        if (!global.__API_SESSION_STORE__) {
            global.__API_SESSION_STORE__ = new Map();
        }
        this.sessionStore = global.__API_SESSION_STORE__;
    }

    async execute(parameters) {
        const startTime = Date.now();
        const {
            sessionId = this.generateSessionId(),
            method = "GET",
            url,
            headers = {},
            data,
            expect,
            chain,
            timeout = 30000
        } = parameters;

        // Initialize or get session
        if (!this.sessionStore.has(sessionId)) {
            this.sessionStore.set(sessionId, {
                sessionId,
                startTime: new Date().toISOString(),
                logs: [],
                status: 'running'
            });
        }

        const session = this.sessionStore.get(sessionId);

        try {
            let result;
            
            if (Array.isArray(chain) && chain.length > 0) {
                // Chain mode
                result = await this.executeChain(chain, session, timeout);
                result.mode = 'chain';
            } else {
                // Single request mode
                if (!url) {
                    throw new Error('URL is required for single request mode');
                }
                result = await this.executeSingleRequest({
                    method, url, headers, data, expect, timeout
                }, session);
                result.mode = 'single';
            }

            session.status = 'completed';
            session.endTime = new Date().toISOString();
            session.executionTime = Date.now() - startTime;

            return {
                success: true,
                sessionId,
                ...result,
                executionTime: Date.now() - startTime
            };

        } catch (error) {
            session.status = 'failed';
            session.error = error.message;
            session.endTime = new Date().toISOString();
            
            throw new Error(`API request failed: ${error.message}`);
        }
    }

    /**
     * Execute a single HTTP request
     */
    async executeSingleRequest(params, session) {
        const { method, url, headers, data, expect, timeout } = params;

        const response = await this.makeHttpRequest(method, url, headers, data, timeout);
        
        // Parse response body
        let responseBody = response.body;
        const contentType = response.headers['content-type'] || '';
        
        if (contentType.includes('application/json')) {
            try {
                responseBody = JSON.parse(response.body);
            } catch (e) {
                // Keep as string if JSON parsing fails
            }
        }

        // Validate response
        const validation = this.validateResponse(response, expect);
        const bodyValidation = this.validateResponseBody(responseBody, expect);

        // Log to session
        session.logs.push({
            type: 'single',
            request: { method, url, headers, data },
            response: {
                status: response.statusCode,
                contentType,
                headers: response.headers,
                body: responseBody
            },
            validation,
            bodyValidation,
            timestamp: new Date().toISOString()
        });

        const result = {
            ok: validation.status && validation.contentType && bodyValidation.matched,
            status: response.statusCode,
            contentType,
            body: responseBody,
            validation,
            bodyValidation
        };

        return {
            result,
            requestCount: 1
        };
    }

    /**
     * Execute a chain of HTTP requests
     */
    async executeChain(chain, session, timeout) {
        const stepVars = {};
        const results = [];

        for (const step of chain) {
            // Render templates in URL, headers, and data
            const url = this.renderTemplate(step.url, stepVars);
            const headers = {};
            
            for (const [key, value] of Object.entries(step.headers || {})) {
                headers[key] = this.renderTemplate(value, stepVars);
            }

            let data = step.data;
            if (typeof data === 'string') {
                data = this.renderTemplate(data, stepVars);
            }

            // Execute request
            const response = await this.makeHttpRequest(
                step.method || 'GET', 
                url, 
                headers, 
                data, 
                timeout
            );

            // Parse response body
            let responseBody = response.body;
            const contentType = response.headers['content-type'] || '';
            
            if (contentType.includes('application/json')) {
                try {
                    responseBody = JSON.parse(response.body);
                } catch (e) {
                    // Keep as string if JSON parsing fails
                }
            }

            // Validate response
            const validation = this.validateResponse(response, step.expect);
            const bodyValidation = this.validateResponseBody(responseBody, step.expect);

            // Extract variables for next steps
            const extracted = step.extract ? this.extractFields(responseBody, step.extract) : {};
            
            // Add extracted variables to stepVars
            Object.assign(stepVars, extracted);
            stepVars[step.name] = {
                ...extracted,
                body: responseBody,
                status: response.statusCode,
                contentType
            };

            // Record step result
            const stepResult = {
                name: step.name,
                status: response.statusCode,
                contentType,
                body: responseBody,
                validation,
                bodyValidation,
                extracted
            };

            results.push(stepResult);

            // Log to session
            session.logs.push({
                type: 'request',
                request: { method: step.method || 'GET', url, headers, data },
                response: {
                    status: response.statusCode,
                    contentType,
                    headers: response.headers,
                    body: responseBody
                },
                validation,
                bodyValidation,
                timestamp: new Date().toISOString()
            });
        }

        // Log chain completion
        session.logs.push({
            type: 'chain',
            steps: results,
            timestamp: new Date().toISOString()
        });

        return {
            results,
            requestCount: chain.length
        };
    }

    /**
     * Make HTTP request using Node.js built-in modules
     */
    async makeHttpRequest(method, urlString, headers = {}, data, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const url = new URL(urlString);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: method.toUpperCase(),
                headers: {
                    'User-Agent': 'CDP-Browser-Control/1.0',
                    ...headers
                },
                timeout
            };

            // Add Content-Length for requests with body
            if (data) {
                const bodyString = typeof data === 'string' ? data : JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(bodyString);
                
                if (!options.headers['Content-Type']) {
                    options.headers['Content-Type'] = typeof data === 'object' 
                        ? 'application/json' 
                        : 'text/plain';
                }
            }

            const req = lib.request(options, (res) => {
                let body = '';
                
                res.on('data', (chunk) => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timeout after ${timeout}ms`));
            });

            // Write request body if present
            if (data) {
                const bodyString = typeof data === 'string' ? data : JSON.stringify(data);
                req.write(bodyString);
            }

            req.end();
        });
    }

    /**
     * Render template strings with variable substitution
     */
    renderTemplate(template, vars) {
        if (typeof template !== 'string') return template;
        
        return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
            const parts = path.split('.');
            let value = vars;
            
            for (const part of parts) {
                value = value?.[part];
            }
            
            return value !== undefined ? String(value) : '';
        });
    }

    /**
     * Extract fields from response using dot notation paths
     */
    extractFields(obj, extractMap) {
        const result = {};
        
        for (const [varName, path] of Object.entries(extractMap)) {
            const parts = path.split('.');
            let value = obj;
            
            for (const part of parts) {
                value = value?.[part];
            }
            
            result[varName] = value;
        }
        
        return result;
    }

    /**
     * Validate HTTP response
     */
    validateResponse(response, expect = {}) {
        return {
            status: expect.status ? response.statusCode === expect.status : true,
            contentType: expect.contentType 
                ? (response.headers['content-type'] || '').includes(expect.contentType)
                : true
        };
    }

    /**
     * Validate response body
     */
    validateResponseBody(responseBody, expect = {}) {
        let bodyValidation = { 
            matched: true, 
            reason: 'No body expectation set.' 
        };

        if (expect.body !== undefined) {
            if (typeof responseBody === 'object' && responseBody !== null && typeof expect.body === 'object') {
                // Partial object match
                bodyValidation.matched = Object.entries(expect.body).every(
                    ([key, value]) => JSON.stringify(responseBody[key]) === JSON.stringify(value)
                );
                bodyValidation.reason = bodyValidation.matched
                    ? 'Partial/exact body match succeeded.'
                    : 'Partial/exact body match failed.';
            } else if (typeof expect.body === 'string') {
                // String match
                bodyValidation.matched = JSON.stringify(responseBody) === expect.body || responseBody === expect.body;
                bodyValidation.reason = bodyValidation.matched
                    ? 'Exact string match succeeded.'
                    : 'Exact string match failed.';
            } else {
                bodyValidation.matched = false;
                bodyValidation.reason = 'Body type mismatch.';
            }
        }

        if (expect.bodyRegex) {
            const pattern = new RegExp(expect.bodyRegex);
            const target = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
            const regexMatch = pattern.test(target);
            
            bodyValidation = {
                matched: regexMatch,
                reason: regexMatch ? 'Regex match succeeded.' : 'Regex match failed.'
            };
        }

        return bodyValidation;
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    /**
     * Get session information
     */
    getSession(sessionId) {
        return this.sessionStore.get(sessionId);
    }

    /**
     * List all sessions
     */
    listSessions() {
        return Array.from(this.sessionStore.values());
    }

    /**
     * Clear session data
     */
    clearSession(sessionId) {
        return this.sessionStore.delete(sessionId);
    }
}

module.exports = ApiRequestTool;
