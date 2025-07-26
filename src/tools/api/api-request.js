const ToolBase = require('../base/ToolBase');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { z } = require('zod');

// Input schema for the API request tool
const chainStepSchema = z.object({
    name: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).optional(),
    url: z.string(),
    headers: z.record(z.string()).optional(),
    data: z.any().optional(),
    expect: z.object({
        status: z.number().optional(),
        contentType: z.string().optional(),
        body: z.any().optional(),
        bodyRegex: z.string().optional()
    }).optional(),
    extract: z.record(z.string()).optional() // { varName: 'field' }
});

const apiRequestInputSchema = z.object({
    sessionId: z.string().optional(), // New: session management
    // Single-request legacy mode
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).optional(),
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),
    data: z.any().optional(),
    expect: z.object({
        status: z.number().optional(),
        contentType: z.string().optional(),
        body: z.any().optional(),
        bodyRegex: z.string().optional()
    }).optional(),
    // Chaining mode
    chain: z.array(chainStepSchema).optional()
});

// --- In-memory session store ---
const sessionStore = global.__API_SESSION_STORE__ || new Map();
global.__API_SESSION_STORE__ = sessionStore;

/**
 * API Request Tool - Perform HTTP API requests with validation and session management
 */
class ApiRequestTool extends ToolBase {
    static definition = {
        name: "api_request",
        description: "Perform HTTP API requests with validation, session management, and request chaining capabilities for comprehensive API testing.",
        input_schema: {
            type: "object",
            // Keep minimal schema for ToolBase compatibility, actual validation done with Zod
            properties: {}
        }
    };

    constructor() {
        super();
        this.sessionStore = sessionStore;
    }

    async execute(parameters) {
        // Validate input with Zod schema
        const input = apiRequestInputSchema.parse(parameters);

        // --- Session Management ---
        const uuid = () => {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                return crypto.randomUUID();
            // Simple pseudo-unique fallback: not cryptographically secure, but fine for session IDs
            return 'session-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        };
        
        const sessionId = input.sessionId || uuid();
        if (!sessionStore.has(sessionId)) {
            sessionStore.set(sessionId, {
                sessionId,
                startTime: new Date().toISOString(),
                logs: [],
                status: 'running'
            });
        }
        const session = sessionStore.get(sessionId);

        // --- API CHAINING SUPPORT ---
        function renderTemplate(str, vars) {
            return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
                const [step, ...rest] = path.split('.');
                let val = vars[step];
                for (const p of rest)
                    val = val?.[p];
                return val !== undefined ? String(val) : '';
            });
        }

        function extractFields(obj, extract) {
            const result = {};
            for (const [k, path] of Object.entries(extract || {})) {
                const parts = path.split('.');
                let val = obj;
                for (const p of parts)
                    val = val?.[p];
                result[k] = val;
            }
            return result;
        }

        // If 'chain' is present, execute steps sequentially
        if (Array.isArray(input.chain)) {
            const stepVars = {};
            const results = [];
            
            for (const step of input.chain) {
                // Render templates in url, headers, data
                const url = renderTemplate(step.url, stepVars);
                const headers = {};
                for (const k in (step.headers || {}))
                    headers[k] = renderTemplate(step.headers[k], stepVars);
                
                let data = step.data;
                if (typeof data === 'string')
                    data = renderTemplate(data, stepVars);

                // Execute request using Node.js built-in modules
                const response = await this.makeHttpRequest(
                    step.method || 'GET',
                    url,
                    headers,
                    data
                );

                const status = response.statusCode;
                const contentType = response.headers['content-type'] || '';
                let responseBody = response.body;
                
                if (contentType.includes('application/json')) {
                    try {
                        responseBody = JSON.parse(response.body);
                    } catch (e) {
                        // Keep as string if JSON parsing fails
                    }
                }

                // Validation
                const expect = step.expect || {};
                const validation = {
                    status: expect.status ? status === expect.status : true,
                    contentType: expect.contentType ? contentType.includes(expect.contentType) : true
                };
                
                let bodyValidation = { matched: true, reason: 'No body expectation set.' };
                if (expect.body !== undefined) {
                    if (typeof responseBody === 'object' && responseBody !== null && typeof expect.body === 'object') {
                        bodyValidation.matched = Object.entries(expect.body).every(
                            ([k, v]) => JSON.stringify(responseBody[k]) === JSON.stringify(v)
                        );
                        bodyValidation.reason = bodyValidation.matched
                            ? 'Partial/exact body match succeeded.'
                            : 'Partial/exact body match failed.';
                    } else if (typeof expect.body === 'string') {
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

                // Extract variables
                const extracted = step.extract ? extractFields(responseBody, step.extract) : {};
                // Add extracted variables directly to stepVars for template rendering
                Object.assign(stepVars, extracted);
                // Also store step results for reference
                stepVars[step.name] = { ...extracted, body: responseBody, status, contentType };

                // Record step result
                results.push({
                    name: step.name,
                    status,
                    contentType,
                    body: responseBody,
                    validation,
                    bodyValidation,
                    extracted
                });

                // Log to session
                session.logs.push({
                    type: 'request',
                    request: {
                        method: step.method || 'GET',
                        url,
                        headers,
                        data
                    },
                    response: {
                        status,
                        contentType,
                        body: responseBody
                    },
                    validation,
                    bodyValidation,
                    timestamp: new Date().toISOString()
                });
            }

            // Log to session
            session.logs.push({
                type: 'chain',
                steps: results,
                timestamp: new Date().toISOString()
            });
            session.status = 'completed';
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ sessionId, results }, null, 2)
                }]
            };
        }

        // --- SINGLE REQUEST MODE (legacy) ---
        const { method, url, headers, data, expect } = input;

        // Validate required parameters for single request mode
        if (!url)
            throw new Error('URL is required for single request mode');

        const response = await this.makeHttpRequest(
            method || 'GET',
            url,
            headers,
            data
        );

        const status = response.statusCode;
        const contentType = response.headers['content-type'] || '';
        let responseBody = response.body;
        
        if (contentType.includes('application/json')) {
            try {
                responseBody = JSON.parse(response.body);
            } catch (e) {
                // Keep as string if JSON parsing fails
            }
        }

        // Basic validation
        const validation = {
            status: expect?.status ? status === expect.status : true,
            contentType: expect?.contentType ? contentType.includes(expect?.contentType) : true
        };

        // --- Enhanced Response Body Validation ---
        let bodyValidation = { matched: true, reason: 'No body expectation set.' };
        if (expect?.body !== undefined) {
            if (typeof responseBody === 'object' && responseBody !== null && typeof expect.body === 'object') {
                // Partial match: all keys/values in expect.body must be present in responseBody
                bodyValidation.matched = Object.entries(expect.body).every(
                    ([k, v]) => JSON.stringify(responseBody[k]) === JSON.stringify(v)
                );
                bodyValidation.reason = bodyValidation.matched
                    ? 'Partial/exact body match succeeded.'
                    : 'Partial/exact body match failed.';
            } else if (typeof expect.body === 'string') {
                bodyValidation.matched = JSON.stringify(responseBody) === expect.body || responseBody === expect.body;
                bodyValidation.reason = bodyValidation.matched
                    ? 'Exact string match succeeded.'
                    : 'Exact string match failed.';
            } else {
                bodyValidation.matched = false;
                bodyValidation.reason = 'Body type mismatch.';
            }
        }
        if (expect?.bodyRegex) {
            const pattern = new RegExp(expect.bodyRegex);
            const target = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
            const regexMatch = pattern.test(target);
            bodyValidation = {
                matched: regexMatch,
                reason: regexMatch ? 'Regex match succeeded.' : 'Regex match failed.'
            };
        }
        // --- End Enhanced Validation ---

        // Log to session
        if (session && session.logs) {
            session.logs.push({
                type: 'single',
                request: {
                    method: method || 'GET',
                    url,
                    headers,
                    data
                },
                response: {
                    status,
                    contentType,
                    body: responseBody
                },
                validation,
                bodyValidation,
                timestamp: new Date().toISOString()
            });
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    ok: validation.status && validation.contentType && bodyValidation.matched,
                    status,
                    contentType,
                    body: responseBody,
                    validation,
                    bodyValidation
                }, null, 2)
            }]
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
}

module.exports = ApiRequestTool;
