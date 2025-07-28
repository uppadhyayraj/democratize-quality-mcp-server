#!/usr/bin/env node

const ApiRequestTool = require('../src/tools/api/api-request.js');
const ApiSessionReportTool = require('../src/tools/api/api-session-report.js');

async function testValidationReport() {
    console.log('Testing enhanced validation reporting...');
    
    const apiTool = new ApiRequestTool();
    const reportTool = new ApiSessionReportTool();
    
    // Create a test session with validation expectations
    const sessionId = 'test-validation-' + Date.now();
    
    try {
        // Make a request with validation expectations that will likely fail
        const result = await apiTool.execute({
            sessionId: sessionId,
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            expect: {
                status: 201, // This should fail - API returns 200
                contentType: 'application/json',
                body: {
                    id: 999, // This should fail - API returns id: 1
                    title: 'Expected Title'
                }
            }
        });
        
        console.log('API Request Result:', JSON.stringify(result, null, 2));
        
        // Generate the report
        const reportResult = await reportTool.execute({
            sessionId: sessionId,
            outputPath: 'validation-test-report.html',
            title: 'Enhanced Validation Test Report',
            includeRequestData: true,
            includeResponseData: true,
            includeTiming: true
        });
        
        console.log('\nReport Generation Result:', JSON.stringify(reportResult, null, 2));
        
        if (reportResult.success) {
            console.log(`\nReport saved to: ${reportResult.reportPath}`);
            console.log(`Open this URL in your browser: ${reportResult.reportUrl}`);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testValidationReport().catch(console.error);
