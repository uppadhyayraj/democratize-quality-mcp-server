# Authentication and Sessions

This example shows how to handle login flows and maintain authenticated sessions.

## Persistent Browser Profile

Use a persistent profile to maintain login sessions:

```json
// Launch with persistent profile
{
  "method": "tools/call",
  "params": {
    "name": "browser_launch",
    "arguments": {
      "headless": false,
      "userDataDir": "./auth-session"
    }
  }
}
```

## Login Workflow

```json
// 1. Navigate to login page
{
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "browserId": "browser-123",
      "url": "https://example.com/login"
    }
  }
}

// 2. Fill username
{
  "method": "tools/call",
  "params": {
    "name": "browser_type",
    "arguments": {
      "browserId": "browser-123",
      "locator": { "type": "css", "value": "#username" },
      "text": "your-username"
    }
  }
}

// 3. Fill password
{
  "method": "tools/call",
  "params": {
    "name": "browser_type",
    "arguments": {
      "browserId": "browser-123",
      "locator": { "type": "css", "value": "#password" },
      "text": "your-password"
    }
  }
}

// 4. Click login button
{
  "method": "tools/call",
  "params": {
    "name": "browser_click",
    "arguments": {
      "browserId": "browser-123",
      "locator": { "type": "css", "value": "#login-button" }
    }
  }
}

// 5. Take screenshot to verify login
{
  "method": "tools/call",
  "params": {
    "name": "browser_screenshot",
    "arguments": {
      "browserId": "browser-123",
      "fileName": "after-login.png"
    }
  }
}
```

## Session Reuse

Once authenticated, the session is preserved:

```json
// Later session - reuse the same profile
{
  "method": "tools/call",
  "params": {
    "name": "browser_launch",
    "arguments": {
      "headless": true,
      "userDataDir": "./auth-session"
    }
  }
}

// Navigate to protected page (already authenticated)
{
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "browserId": "browser-456",
      "url": "https://example.com/dashboard"
    }
  }
}
```

## Tips

- Use non-headless mode for initial login setup
- Keep the userDataDir consistent across sessions
- Take screenshots to verify authentication state
- Handle 2FA and captcha challenges manually when needed
