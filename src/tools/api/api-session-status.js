const ToolBase = require('../base/ToolBase');

/**
 * API Session Status Tool - Query API test session status and results
 */
class ApiSessionStatusTool extends ToolBase {
    static definition = {
        name: "api_session_status",
        description: "Query API test session status, logs, and results by sessionId. Provides detailed information about request history and validation results.",
        input_schema: {
            type: "object",
            properties: {
                sessionId: {
                    type: "string",
                    description: "The session ID to query"
                },
                includeDetails: {
                    type: "boolean",
                    default: true,
                    description: "Whether to include detailed request/response data"
                },
                filterByType: {
                    type: "string",
                    enum: ["single", "request", "chain", "all"],
                    default: "all",
                    description: "Filter logs by request type"
                },
                limit: {
                    type: "number",
                    default: 50,
                    description: "Maximum number of log entries to return"
                }
            },
            required: ["sessionId"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether the session was found" },
                found: { type: "boolean", description: "Whether the session exists" },
                session: {
                    type: "object",
                    properties: {
                        sessionId: { type: "string" },
                        status: { type: "string" },
                        startTime: { type: "string" },
                        endTime: { type: "string" },
                        executionTime: { type: "number" },
                        error: { type: "string" }
                    },
                    description: "Session metadata"
                },
                summary: {
                    type: "object",
                    properties: {
                        totalRequests: { type: "number" },
                        successfulRequests: { type: "number" },
                        failedRequests: { type: "number" },
                        chainSteps: { type: "number" },
                        logEntries: { type: "number" }
                    },
                    description: "Session summary statistics"
                },
                logs: {
                    type: "array",
                    description: "Session log entries (filtered and limited)"
                },
                validationSummary: {
                    type: "object",
                    properties: {
                        passedValidations: { type: "number" },
                        failedValidations: { type: "number" },
                        validationRate: { type: "number" }
                    },
                    description: "Validation statistics"
                }
            },
            required: ["success", "found"]
        }
    };

    constructor() {
        super();
        // Access the global session store
        if (!global.__API_SESSION_STORE__) {
            global.__API_SESSION_STORE__ = new Map();
        }
        this.sessionStore = global.__API_SESSION_STORE__;
    }

    async execute(parameters) {
        const {
            sessionId,
            includeDetails = true,
            filterByType = "all",
            limit = 50
        } = parameters;

        const session = this.sessionStore.get(sessionId);
        
        if (!session) {
            return {
                success: false,
                found: false,
                message: `Session not found: ${sessionId}`,
                availableSessions: Array.from(this.sessionStore.keys())
            };
        }

        // Filter logs by type
        let filteredLogs = session.logs || [];
        if (filterByType !== "all") {
            filteredLogs = filteredLogs.filter(log => log.type === filterByType);
        }

        // Apply limit
        const logs = filteredLogs.slice(-limit);

        // Generate summary statistics
        const summary = this.generateSummary(session.logs || []);
        const validationSummary = this.generateValidationSummary(session.logs || []);

        // Prepare session metadata (without sensitive details if not requested)
        const sessionMetadata = {
            sessionId: session.sessionId,
            status: session.status,
            startTime: session.startTime,
            endTime: session.endTime,
            executionTime: session.executionTime,
            error: session.error
        };

        // Optionally strip detailed request/response data
        const processedLogs = includeDetails 
            ? logs 
            : logs.map(log => this.stripSensitiveData(log));

        return {
            success: true,
            found: true,
            session: sessionMetadata,
            summary,
            validationSummary,
            logs: processedLogs,
            logCount: logs.length,
            totalLogCount: (session.logs || []).length
        };
    }

    /**
     * Generate summary statistics for the session
     */
    generateSummary(logs) {
        const summary = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            chainSteps: 0,
            singleRequests: 0,
            logEntries: logs.length
        };

        for (const log of logs) {
            switch (log.type) {
                case 'single':
                    summary.totalRequests++;
                    summary.singleRequests++;
                    if (this.isRequestSuccessful(log)) {
                        summary.successfulRequests++;
                    } else {
                        summary.failedRequests++;
                    }
                    break;
                    
                case 'request':
                    summary.totalRequests++;
                    summary.chainSteps++;
                    if (this.isRequestSuccessful(log)) {
                        summary.successfulRequests++;
                    } else {
                        summary.failedRequests++;
                    }
                    break;
                    
                case 'chain':
                    // Chain logs contain summary of multiple steps
                    if (log.steps) {
                        summary.chainSteps += log.steps.length;
                    }
                    break;
            }
        }

        return summary;
    }

    /**
     * Generate validation summary statistics
     */
    generateValidationSummary(logs) {
        let passedValidations = 0;
        let failedValidations = 0;
        let totalValidations = 0;

        for (const log of logs) {
            if (log.validation && log.bodyValidation) {
                totalValidations++;
                
                const isValid = log.validation.status && 
                               log.validation.contentType && 
                               log.bodyValidation.matched;
                
                if (isValid) {
                    passedValidations++;
                } else {
                    failedValidations++;
                }
            }
            
            // Also check chain steps
            if (log.type === 'chain' && log.steps) {
                for (const step of log.steps) {
                    if (step.validation && step.bodyValidation) {
                        totalValidations++;
                        
                        const isValid = step.validation.status && 
                                       step.validation.contentType && 
                                       step.bodyValidation.matched;
                        
                        if (isValid) {
                            passedValidations++;
                        } else {
                            failedValidations++;
                        }
                    }
                }
            }
        }

        return {
            passedValidations,
            failedValidations,
            totalValidations,
            validationRate: totalValidations > 0 
                ? Math.round((passedValidations / totalValidations) * 100) / 100 
                : 0
        };
    }

    /**
     * Check if a request was successful based on validation
     */
    isRequestSuccessful(log) {
        return log.validation && 
               log.bodyValidation &&
               log.validation.status && 
               log.validation.contentType && 
               log.bodyValidation.matched;
    }

    /**
     * Remove sensitive data from logs when details are not requested
     */
    stripSensitiveData(log) {
        const stripped = {
            type: log.type,
            timestamp: log.timestamp
        };

        if (log.request) {
            stripped.request = {
                method: log.request.method,
                url: log.request.url,
                hasHeaders: !!(log.request.headers && Object.keys(log.request.headers).length > 0),
                hasData: !!log.request.data
            };
        }

        if (log.response) {
            stripped.response = {
                status: log.response.status,
                contentType: log.response.contentType,
                hasBody: !!log.response.body
            };
        }

        if (log.validation) {
            stripped.validation = log.validation;
        }

        if (log.bodyValidation) {
            stripped.bodyValidation = {
                matched: log.bodyValidation.matched,
                reason: log.bodyValidation.reason
            };
        }

        // Handle chain steps
        if (log.steps) {
            stripped.steps = log.steps.map(step => this.stripSensitiveData({
                type: 'request',
                request: step.request || {
                    method: step.method,
                    url: step.url,
                    headers: step.headers,
                    data: step.data
                },
                response: {
                    status: step.status,
                    contentType: step.contentType,
                    body: step.body
                },
                validation: step.validation,
                bodyValidation: step.bodyValidation
            }));
        }

        return stripped;
    }

    /**
     * Get detailed analysis of a specific request by index
     */
    getRequestDetails(sessionId, requestIndex) {
        const session = this.sessionStore.get(sessionId);
        if (!session || !session.logs) {
            return null;
        }

        const requestLogs = session.logs.filter(log => 
            log.type === 'single' || log.type === 'request'
        );

        if (requestIndex >= requestLogs.length) {
            return null;
        }

        return requestLogs[requestIndex];
    }

    /**
     * Get session timing analysis
     */
    getTimingAnalysis(sessionId) {
        const session = this.sessionStore.get(sessionId);
        if (!session || !session.logs) {
            return null;
        }

        const requests = session.logs.filter(log => 
            log.type === 'single' || log.type === 'request'
        );

        if (requests.length === 0) {
            return { message: 'No requests found for timing analysis' };
        }

        // Calculate request intervals
        const timings = [];
        for (let i = 0; i < requests.length; i++) {
            const current = new Date(requests[i].timestamp);
            const previous = i > 0 ? new Date(requests[i - 1].timestamp) : new Date(session.startTime);
            
            timings.push({
                requestIndex: i,
                timestamp: requests[i].timestamp,
                intervalMs: current.getTime() - previous.getTime()
            });
        }

        return {
            totalRequests: requests.length,
            sessionDuration: session.executionTime || 0,
            averageInterval: timings.reduce((sum, t) => sum + t.intervalMs, 0) / timings.length,
            timings
        };
    }

    /**
     * List all available sessions
     */
    listAllSessions() {
        return Array.from(this.sessionStore.entries()).map(([id, session]) => ({
            sessionId: id,
            status: session.status,
            startTime: session.startTime,
            requestCount: (session.logs || []).filter(log => 
                log.type === 'single' || log.type === 'request'
            ).length,
            logCount: (session.logs || []).length
        }));
    }
}

module.exports = ApiSessionStatusTool;
