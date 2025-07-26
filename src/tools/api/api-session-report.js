const ToolBase = require('../base/ToolBase');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * API Session Report Tool - Generate comprehensive HTML reports for API test sessions
 */
class ApiSessionReportTool extends ToolBase {
    static definition = {
        name: "api_session_report",
        description: "Generate comprehensive HTML report for API test session with detailed request/response logs, validation results, and timing analysis.",
        input_schema: {
            type: "object",
            properties: {
                sessionId: {
                    type: "string",
                    description: "The session ID to generate report for"
                },
                outputPath: {
                    type: "string",
                    description: "Path where to save the HTML report (relative to output directory)"
                },
                title: {
                    type: "string",
                    default: "API Test Session Report",
                    description: "Title for the HTML report"
                },
                includeRequestData: {
                    type: "boolean",
                    default: true,
                    description: "Whether to include request data in the report"
                },
                includeResponseData: {
                    type: "boolean",
                    default: true,
                    description: "Whether to include response data in the report"
                },
                includeTiming: {
                    type: "boolean",
                    default: true,
                    description: "Whether to include timing analysis"
                },
                theme: {
                    type: "string",
                    enum: ["light", "dark", "auto"],
                    default: "light",
                    description: "Report theme"
                }
            },
            required: ["sessionId", "outputPath"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether report was generated successfully" },
                reportPath: { type: "string", description: "Path to the generated report" },
                fileSize: { type: "number", description: "Size of generated report in bytes" },
                sessionSummary: {
                    type: "object",
                    properties: {
                        requestCount: { type: "number" },
                        successRate: { type: "number" },
                        totalDuration: { type: "number" }
                    },
                    description: "Summary of session metrics"
                },
                reportUrl: { type: "string", description: "URL to view the report" }
            },
            required: ["success"]
        }
    };

    constructor() {
        super();
        // Access the global session store
        if (!global.__API_SESSION_STORE__) {
            global.__API_SESSION_STORE__ = new Map();
        }
        this.sessionStore = global.__API_SESSION_STORE__;
        
        // Use output directory from environment or default to user home directory
        const defaultOutputDir = process.env.HOME 
            ? path.join(process.env.HOME, '.mcp-browser-control') 
            : path.join(os.tmpdir(), 'mcp-browser-control');
        this.outputDir = process.env.OUTPUT_DIR || defaultOutputDir;
    }

    async execute(parameters) {
        const {
            sessionId,
            outputPath,
            title = "API Test Session Report",
            includeRequestData = true,
            includeResponseData = true,
            includeTiming = true,
            theme = "light"
        } = parameters;

        const session = this.sessionStore.get(sessionId);
        
        if (!session) {
            return {
                success: false,
                error: `Session not found: ${sessionId}`,
                availableSessions: Array.from(this.sessionStore.keys())
            };
        }

        try {
            // Ensure output directory exists
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
            }

            // Generate report data
            const reportData = this.generateReportData(
                session, 
                includeRequestData, 
                includeResponseData, 
                includeTiming
            );

            // Generate HTML content
            const htmlContent = this.generateHtmlReport(reportData, title, theme);

            // Write report to file
            const fullOutputPath = path.join(this.outputDir, outputPath);
            const outputDir = path.dirname(fullOutputPath);
            
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(fullOutputPath, htmlContent, 'utf8');

            // Get file size
            const stats = fs.statSync(fullOutputPath);

            return {
                success: true,
                reportPath: fullOutputPath,
                fileSize: stats.size,
                sessionSummary: {
                    requestCount: reportData.summary.totalRequests,
                    successRate: reportData.summary.successRate,
                    totalDuration: reportData.session.executionTime || 0
                },
                reportUrl: `file://${fullOutputPath}`
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to generate report: ${error.message}`
            };
        }
    }

    /**
     * Generate structured report data from session
     */
    generateReportData(session, includeRequestData, includeResponseData, includeTiming) {
        const logs = session.logs || [];
        
        // Generate summary
        const summary = this.generateSummary(logs);
        
        // Process logs for display
        const processedLogs = logs.map(log => this.processLogForReport(
            log, 
            includeRequestData, 
            includeResponseData
        ));

        // Generate timing data if requested
        const timingData = includeTiming ? this.generateTimingData(logs, session) : null;

        return {
            session: {
                sessionId: session.sessionId,
                status: session.status,
                startTime: session.startTime,
                endTime: session.endTime,
                executionTime: session.executionTime,
                error: session.error
            },
            summary,
            logs: processedLogs,
            timing: timingData,
            metadata: {
                generatedAt: new Date().toISOString(),
                includeRequestData,
                includeResponseData,
                includeTiming
            }
        };
    }

    /**
     * Generate summary statistics
     */
    generateSummary(logs) {
        let totalRequests = 0;
        let successfulRequests = 0;
        let failedRequests = 0;
        let validationsPassed = 0;
        let validationsFailed = 0;

        for (const log of logs) {
            if (log.type === 'single' || log.type === 'request') {
                totalRequests++;
                
                const isValid = log.validation && 
                               log.bodyValidation &&
                               log.validation.status && 
                               log.validation.contentType && 
                               log.bodyValidation.matched;

                if (isValid) {
                    successfulRequests++;
                    validationsPassed++;
                } else {
                    failedRequests++;
                    validationsFailed++;
                }
            } else if (log.type === 'chain' && log.steps) {
                totalRequests += log.steps.length;
                
                for (const step of log.steps) {
                    const isValid = step.validation && 
                                   step.bodyValidation &&
                                   step.validation.status && 
                                   step.validation.contentType && 
                                   step.bodyValidation.matched;

                    if (isValid) {
                        successfulRequests++;
                        validationsPassed++;
                    } else {
                        failedRequests++;
                        validationsFailed++;
                    }
                }
            }
        }

        return {
            totalRequests,
            successfulRequests,
            failedRequests,
            successRate: totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) / 100 : 0,
            validationsPassed,
            validationsFailed,
            validationRate: (validationsPassed + validationsFailed) > 0 
                ? Math.round((validationsPassed / (validationsPassed + validationsFailed)) * 100) / 100 
                : 0,
            logEntries: logs.length
        };
    }

    /**
     * Process individual log entry for report display
     */
    processLogForReport(log, includeRequestData, includeResponseData) {
        const processed = {
            type: log.type,
            timestamp: log.timestamp,
            formattedTime: new Date(log.timestamp).toLocaleString()
        };

        // Process request data
        if (log.request && includeRequestData) {
            processed.request = {
                method: log.request.method,
                url: log.request.url,
                headers: log.request.headers || {},
                data: log.request.data || null
            };
        } else if (log.request) {
            processed.request = {
                method: log.request.method,
                url: log.request.url,
                hasHeaders: !!(log.request.headers && Object.keys(log.request.headers).length > 0),
                hasData: !!log.request.data
            };
        }

        // Process response data
        if (log.response && includeResponseData) {
            processed.response = {
                status: log.response.status,
                statusText: log.response.statusText || '',
                contentType: log.response.contentType,
                headers: log.response.headers || {},
                body: log.response.body || null
            };
        } else if (log.response) {
            processed.response = {
                status: log.response.status,
                statusText: log.response.statusText || '',
                contentType: log.response.contentType,
                hasHeaders: !!(log.response.headers && Object.keys(log.response.headers).length > 0),
                bodySize: log.response.body ? log.response.body.length : 0
            };
        }

        // Include validation results
        if (log.validation) {
            processed.validation = log.validation;
        }

        if (log.bodyValidation) {
            processed.bodyValidation = log.bodyValidation;
        }

        // Process chain steps
        if (log.steps) {
            processed.steps = log.steps.map(step => this.processLogForReport({
                type: 'request',
                timestamp: log.timestamp,
                request: {
                    method: step.method,
                    url: step.url,
                    headers: step.headers,
                    data: step.data
                },
                response: {
                    status: step.status,
                    statusText: step.statusText,
                    contentType: step.contentType,
                    headers: step.headers,
                    body: step.body
                },
                validation: step.validation,
                bodyValidation: step.bodyValidation
            }, includeRequestData, includeResponseData));
        }

        return processed;
    }

    /**
     * Generate timing analysis data
     */
    generateTimingData(logs, session) {
        const requests = logs.filter(log => log.type === 'single' || log.type === 'request');
        
        if (requests.length === 0) {
            return null;
        }

        const sessionStart = new Date(session.startTime).getTime();
        const timings = [];

        for (let i = 0; i < requests.length; i++) {
            const requestTime = new Date(requests[i].timestamp).getTime();
            const relativeTime = requestTime - sessionStart;
            
            timings.push({
                index: i,
                timestamp: requests[i].timestamp,
                relativeTimeMs: relativeTime,
                method: requests[i].request?.method || 'UNKNOWN',
                url: requests[i].request?.url || 'UNKNOWN',
                status: requests[i].response?.status || 0
            });
        }

        return {
            sessionDurationMs: session.executionTime || 0,
            requestCount: requests.length,
            averageIntervalMs: timings.length > 1 
                ? Math.round((timings[timings.length - 1].relativeTimeMs) / (timings.length - 1))
                : 0,
            timings
        };
    }

    /**
     * Generate complete HTML report
     */
    generateHtmlReport(reportData, title, theme) {
        const css = this.generateCSS(theme);
        const jsCode = this.generateJavaScript();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)}</title>
    <style>${css}</style>
</head>
<body class="theme-${theme}">
    <div class="container">
        <header class="header">
            <h1>${this.escapeHtml(title)}</h1>
            <div class="session-info">
                <span class="session-id">Session: ${this.escapeHtml(reportData.session.sessionId)}</span>
                <span class="status status-${reportData.session.status}">${reportData.session.status}</span>
            </div>
        </header>

        <section class="summary">
            <h2>Summary</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-value">${reportData.summary.totalRequests}</div>
                    <div class="summary-label">Total Requests</div>
                </div>
                <div class="summary-card success">
                    <div class="summary-value">${reportData.summary.successfulRequests}</div>
                    <div class="summary-label">Successful</div>
                </div>
                <div class="summary-card failure">
                    <div class="summary-value">${reportData.summary.failedRequests}</div>
                    <div class="summary-label">Failed</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${Math.round(reportData.summary.successRate * 100)}%</div>
                    <div class="summary-label">Success Rate</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${reportData.session.executionTime || 0}ms</div>
                    <div class="summary-label">Duration</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${Math.round(reportData.summary.validationRate * 100)}%</div>
                    <div class="summary-label">Validation Rate</div>
                </div>
            </div>
        </section>

        ${reportData.timing ? this.generateTimingSection(reportData.timing) : ''}

        <section class="logs">
            <h2>Request Logs</h2>
            <div class="logs-container">
                ${reportData.logs.map((log, index) => this.generateLogEntry(log, index)).join('')}
            </div>
        </section>

        <footer class="footer">
            <p>Report generated at ${new Date(reportData.metadata.generatedAt).toLocaleString()}</p>
        </footer>
    </div>

    <script>${jsCode}</script>
</body>
</html>`;
    }

    /**
     * Generate CSS styles for the report
     */
    generateCSS(theme) {
        return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }

        .theme-dark {
            color: #e0e0e0;
            background-color: #1a1a1a;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .theme-dark .header {
            background: #2d2d2d;
        }

        .header h1 {
            color: #2c3e50;
            font-size: 2em;
        }

        .theme-dark .header h1 {
            color: #ecf0f1;
        }

        .session-info {
            display: flex;
            gap: 15px;
            align-items: center;
        }

        .session-id {
            font-family: monospace;
            background: #f8f9fa;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.9em;
        }

        .theme-dark .session-id {
            background: #3a3a3a;
        }

        .status {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }

        .status-completed {
            background: #d4edda;
            color: #155724;
        }

        .status-running {
            background: #fff3cd;
            color: #856404;
        }

        .status-failed {
            background: #f8d7da;
            color: #721c24;
        }

        .summary {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .theme-dark .summary {
            background: #2d2d2d;
        }

        .summary h2 {
            margin-bottom: 20px;
            color: #2c3e50;
        }

        .theme-dark .summary h2 {
            color: #ecf0f1;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
        }

        .summary-card {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #6c757d;
        }

        .theme-dark .summary-card {
            background: #3a3a3a;
        }

        .summary-card.success {
            border-left-color: #28a745;
        }

        .summary-card.failure {
            border-left-color: #dc3545;
        }

        .summary-value {
            font-size: 2em;
            font-weight: bold;
            color: #2c3e50;
        }

        .theme-dark .summary-value {
            color: #ecf0f1;
        }

        .summary-label {
            font-size: 0.9em;
            color: #6c757d;
            margin-top: 5px;
        }

        .logs {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .theme-dark .logs {
            background: #2d2d2d;
        }

        .logs h2 {
            margin-bottom: 20px;
            color: #2c3e50;
        }

        .theme-dark .logs h2 {
            color: #ecf0f1;
        }

        .log-entry {
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
        }

        .theme-dark .log-entry {
            border-color: #4a4a4a;
        }

        .log-header {
            background: #f8f9fa;
            padding: 15px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .theme-dark .log-header {
            background: #3a3a3a;
        }

        .log-header:hover {
            background: #e9ecef;
        }

        .theme-dark .log-header:hover {
            background: #4a4a4a;
        }

        .log-title {
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .method {
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .method-get { background: #28a745; color: white; }
        .method-post { background: #007bff; color: white; }
        .method-put { background: #ffc107; color: black; }
        .method-delete { background: #dc3545; color: white; }
        .method-patch { background: #6f42c1; color: white; }

        .status-code {
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .status-2xx { background: #28a745; color: white; }
        .status-3xx { background: #ffc107; color: black; }
        .status-4xx { background: #fd7e14; color: white; }
        .status-5xx { background: #dc3545; color: white; }

        .log-body {
            padding: 20px;
            background: white;
            display: none;
        }

        .theme-dark .log-body {
            background: #2d2d2d;
        }

        .log-body.expanded {
            display: block;
        }

        .request-response-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .request-section, .response-section {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
        }

        .theme-dark .request-section,
        .theme-dark .response-section {
            background: #3a3a3a;
        }

        .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #2c3e50;
        }

        .theme-dark .section-title {
            color: #ecf0f1;
        }

        .code-block {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .validation-results {
            margin-top: 15px;
            padding: 15px;
            border-radius: 6px;
        }

        .validation-passed {
            background: #d4edda;
            border-left: 4px solid #28a745;
        }

        .validation-failed {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
        }

        .timing-section {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .theme-dark .timing-section {
            background: #2d2d2d;
        }

        .timing-chart {
            margin-top: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 6px;
        }

        .theme-dark .timing-chart {
            background: #3a3a3a;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-size: 0.9em;
        }

        @media (max-width: 768px) {
            .header {
                flex-direction: column;
                gap: 15px;
                text-align: center;
            }

            .request-response-grid {
                grid-template-columns: 1fr;
            }

            .summary-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        `;
    }

    /**
     * Generate JavaScript for interactivity
     */
    generateJavaScript() {
        return `
        document.addEventListener('DOMContentLoaded', function() {
            // Toggle log entry expansion
            const logHeaders = document.querySelectorAll('.log-header');
            logHeaders.forEach(header => {
                header.addEventListener('click', function() {
                    const logBody = this.nextElementSibling;
                    logBody.classList.toggle('expanded');
                    
                    const arrow = this.querySelector('.arrow');
                    if (arrow) {
                        arrow.textContent = logBody.classList.contains('expanded') ? '▼' : '▶';
                    }
                });
            });

            // Pretty print JSON in code blocks
            const codeBlocks = document.querySelectorAll('.code-block');
            codeBlocks.forEach(block => {
                try {
                    const content = block.textContent;
                    const parsed = JSON.parse(content);
                    block.textContent = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    // Not JSON, leave as is
                }
            });
        });
        `;
    }

    /**
     * Generate timing section HTML
     */
    generateTimingSection(timing) {
        return `
        <section class="timing-section">
            <h2>Timing Analysis</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-value">${timing.sessionDurationMs}ms</div>
                    <div class="summary-label">Total Duration</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${timing.requestCount}</div>
                    <div class="summary-label">Requests</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${timing.averageIntervalMs}ms</div>
                    <div class="summary-label">Avg Interval</div>
                </div>
            </div>
            <div class="timing-chart">
                <h3>Request Timeline</h3>
                ${timing.timings.map(t => `
                    <div style="margin: 5px 0; padding: 5px; background: rgba(0,123,255,0.1); border-radius: 3px;">
                        <strong>${t.method} ${this.escapeHtml(t.url)}</strong> 
                        - ${t.relativeTimeMs}ms 
                        <span class="status-code status-${Math.floor(t.status / 100)}xx">${t.status}</span>
                    </div>
                `).join('')}
            </div>
        </section>
        `;
    }

    /**
     * Generate individual log entry HTML
     */
    generateLogEntry(log, index) {
        const isChain = log.type === 'chain';
        const hasValidation = log.validation && log.bodyValidation;
        const isValidationPassed = hasValidation && 
            log.validation.status && 
            log.validation.contentType && 
            log.bodyValidation.matched;

        let method = 'UNKNOWN';
        let url = 'UNKNOWN';
        let statusCode = 0;

        if (log.request) {
            method = log.request.method || 'UNKNOWN';
            url = log.request.url || 'UNKNOWN';
        }

        if (log.response) {
            statusCode = log.response.status || 0;
        }

        const statusClass = `status-${Math.floor(statusCode / 100)}xx`;

        return `
        <div class="log-entry">
            <div class="log-header">
                <div class="log-title">
                    <span class="arrow">▶</span>
                    <span class="method method-${method.toLowerCase()}">${method}</span>
                    <span>${this.escapeHtml(url)}</span>
                    ${statusCode > 0 ? `<span class="status-code ${statusClass}">${statusCode}</span>` : ''}
                    ${hasValidation ? 
                        `<span class="validation-badge ${isValidationPassed ? 'passed' : 'failed'}">
                            ${isValidationPassed ? '✓' : '✗'} Validation
                        </span>` : ''
                    }
                </div>
                <div class="log-time">${log.formattedTime}</div>
            </div>
            <div class="log-body">
                ${isChain ? this.generateChainStepsHtml(log.steps) : this.generateRequestResponseHtml(log)}
                ${hasValidation ? this.generateValidationHtml(log.validation, log.bodyValidation) : ''}
            </div>
        </div>
        `;
    }

    /**
     * Generate chain steps HTML
     */
    generateChainStepsHtml(steps) {
        if (!steps || steps.length === 0) {
            return '<p>No steps found in chain.</p>';
        }

        return `
        <div class="chain-steps">
            <h4>Chain Steps (${steps.length})</h4>
            ${steps.map((step, index) => `
                <div class="chain-step">
                    <h5>Step ${index + 1}</h5>
                    ${this.generateRequestResponseHtml(step)}
                </div>
            `).join('')}
        </div>
        `;
    }

    /**
     * Generate request/response HTML
     */
    generateRequestResponseHtml(log) {
        return `
        <div class="request-response-grid">
            <div class="request-section">
                <div class="section-title">Request</div>
                ${log.request ? `
                    <p><strong>Method:</strong> ${log.request.method}</p>
                    <p><strong>URL:</strong> ${this.escapeHtml(log.request.url)}</p>
                    ${Object.keys(log.request.headers || {}).length > 0 ? `
                        <p><strong>Headers:</strong></p>
                        <div class="code-block">${this.escapeHtml(JSON.stringify(log.request.headers, null, 2))}</div>
                    ` : ''}
                    ${log.request.data ? `
                        <p><strong>Body:</strong></p>
                        <div class="code-block">${this.escapeHtml(JSON.stringify(log.request.data, null, 2))}</div>
                    ` : ''}
                ` : '<p>No request data available</p>'}
            </div>
            <div class="response-section">
                <div class="section-title">Response</div>
                ${log.response ? `
                    <p><strong>Status:</strong> ${log.response.status} ${log.response.statusText || ''}</p>
                    <p><strong>Content-Type:</strong> ${log.response.contentType || 'unknown'}</p>
                    ${Object.keys(log.response.headers || {}).length > 0 ? `
                        <p><strong>Headers:</strong></p>
                        <div class="code-block">${this.escapeHtml(JSON.stringify(log.response.headers, null, 2))}</div>
                    ` : ''}
                    ${log.response.body ? `
                        <p><strong>Body:</strong></p>
                        <div class="code-block">${this.escapeHtml(typeof log.response.body === 'string' ? log.response.body : JSON.stringify(log.response.body, null, 2))}</div>
                    ` : ''}
                ` : '<p>No response data available</p>'}
            </div>
        </div>
        `;
    }

    /**
     * Generate validation results HTML
     */
    generateValidationHtml(validation, bodyValidation) {
        const isPassed = validation.status && validation.contentType && bodyValidation.matched;
        
        return `
        <div class="validation-results ${isPassed ? 'validation-passed' : 'validation-failed'}">
            <h4>Validation Results</h4>
            <p><strong>Status Code:</strong> ${validation.status ? '✓ Passed' : '✗ Failed'}</p>
            <p><strong>Content Type:</strong> ${validation.contentType ? '✓ Passed' : '✗ Failed'}</p>
            <p><strong>Body Validation:</strong> ${bodyValidation.matched ? '✓ Passed' : '✗ Failed'}</p>
            ${bodyValidation.reason ? `<p><strong>Reason:</strong> ${this.escapeHtml(bodyValidation.reason)}</p>` : ''}
        </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (typeof text !== 'string') {
            return String(text);
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

module.exports = ApiSessionReportTool;
