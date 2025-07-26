# Basic Browser Automation

This example demonstrates basic browser automation tasks.

## Complete Workflow

```json
// 1. Launch browser
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "browser_launch",
    "arguments": {
      "headless": true,
      "userDataDir": "./browser-session"
    }
  }
}

// Response: { "browserId": "browser-abc123", "port": 9222 }

// 2. Navigate to page
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "browserId": "browser-abc123",
      "url": "https://example.com"
    }
  }
}

// 3. Take screenshot
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "browser_screenshot",
    "arguments": {
      "browserId": "browser-abc123",
      "fileName": "homepage.png"
    }
  }
}

// 4. Extract page content
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "browser_dom",
    "arguments": {
      "browserId": "browser-abc123"
    }
  }
}

// 5. Close browser
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "browser_close",
    "arguments": {
      "browserId": "browser-abc123"
    }
  }
}
```

## Error Handling

Always handle errors appropriately:

```json
// If a tool call fails, you'll receive an error response:
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Tool 'browser_navigate' execution failed: Browser instance 'invalid-id' not found",
    "data": {
      "tool_name": "browser_navigate",
      "original_error": "Browser instance 'invalid-id' not found"
    }
  }
}
```

## Best Practices

1. **Always close browsers** when done to free resources
2. **Use persistent profiles** for authenticated sessions
3. **Handle errors gracefully** with retry logic
4. **Take screenshots** for debugging and verification
5. **Use meaningful file names** for screenshots
