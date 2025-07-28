#!/usr/bin/env node

const ApiRequestTool = require('../src/tools/api/api-request.js');
const ApiSessionReportTool = require('../src/tools/api/api-session-report.js');

async function testChainValidationReport() {
    console.log('Testing chain validation reporting...');
    
    const apiTool = new ApiRequestTool();
    const reportTool = new ApiSessionReportTool();
    
    // Create a test session with chain validation expectations
    const sessionId = 'test-chain-validation-' + Date.now();
    
    try {
        // Make a chain request with validation expectations
        const result = await apiTool.execute({
            sessionId: sessionId,
            chain: [
                {
                    name: 'get_post',
                    method: 'GET',
                    url: 'https://jsonplaceholder.typicode.com/posts/1',
                    expect: {
                        status: 200, // This should pass
                        contentType: 'application/json',
                        body: {
                            id: 1, // This should pass
                            userId: 999 // This should fail - API returns userId: 1
                        }
                    }
                },
                {
                    name: 'get_user',
                    method: 'GET',
                    url: 'https://jsonplaceholder.typicode.com/users/1',
                    expect: {
                        status: 201, // This should fail - API returns 200
                        contentType: 'text/html', // This should fail - API returns JSON
                        bodyRegex: '"name"\\s*:\\s*"John"' // This might pass depending on the data
                    }
                }
            ]
        });
        
        console.log('Chain Request Result:', JSON.stringify(result, null, 2));
        
        // Generate the report
        const reportResult = await reportTool.execute({
            sessionId: sessionId,
            outputPath: 'chain-validation-test-report.html',
            title: 'Chain Validation Test Report',
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
testChainValidationReport().catch(console.error);
