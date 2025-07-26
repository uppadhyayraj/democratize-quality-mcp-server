# Tool Reference

Complete reference for all available tools

---

## Table of Contents

- [Browser Tools](#browser-tools)
  - [browser_click](#browser-click)
  - [browser_close](#browser-close)
  - [browser_dom](#browser-dom)
  - [browser_launch](#browser-launch)
  - [browser_navigate](#browser-navigate)
  - [browser_screenshot](#browser-screenshot)
  - [browser_type](#browser-type)

## Browser Tools

Tools for browser automation and control.

### browser_click

**Description:** Simulates a click on a specific element in the browser.

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `browserId` | string | ✅ | The ID of the browser instance. |
| `selector` | string | ✅ | The CSS selector of the element to click. |

#### Output

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the click was successful. |
| `browserId` | string | The browser instance ID that was used. |

#### Example Usage

```json
{
  "tool": "browser_click",
  "parameters": {
    "browserId": "browser-123",
    "locator": {
      "type": "css",
      "value": "#submit-button"
    }
  }
}
```

*Click a button using CSS selector*


---

### browser_close

**Description:** Closes a specific browser instance and cleans up its resources. Always call this when done with a browser.

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `browserId` | string | ✅ | The ID of the browser instance to close. |

#### Output

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Confirmation message of successful closure. |
| `browserId` | string | The browser instance ID that was closed. |

#### Example Usage

```json
{
  "tool": "browser_close",
  "parameters": {
    "browserId": "example"
  }
}
```

*Basic usage example*


---

### browser_dom

**Description:** Interacts with the DOM of the current browser page.

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `browserId` | string | ✅ | The ID of the browser instance. |
| `action` | string | ✅ | The DOM action to perform (e.g., 'click', 'type'). |
| `selector` | string | ✅ | The CSS selector of the element to interact with. |
| `text` | string | ❌ | The text to type into the element (if applicable). |

#### Output

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the DOM action was successful. |
| `browserId` | string | The browser instance ID that was used. |

#### Example Usage

```json
{
  "tool": "browser_dom",
  "parameters": {
    "browserId": "example",
    "action": "example",
    "selector": "example"
  }
}
```

*Basic usage example*


---

### browser_launch

**Description:** Launches a new web browser instance. Returns a unique browserId. Use this before any other browser actions.

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `headless` | boolean | ❌ | Whether to launch the browser in headless mode (no UI). Defaults to true. Set to false for manual login. |
| `userDataDir` | string | ❌ | Optional. A path (relative to the server) to a directory to store persistent user data (e.g., login sessions, cookies). Use for authenticated sessions. If not provided, a temporary profile is used. |
| `port` | number | ❌ | Optional. The port for remote debugging. If not provided, Chrome will choose an available port. |

#### Output

| Field | Type | Description |
|-------|------|-------------|
| `browserId` | string | The unique ID of the launched browser instance. |
| `port` | number | The port the browser instance is running on for remote debugging. |
| `userDataDir` | string | The absolute path to the user data directory used. |

#### Example Usage

```json
{
  "tool": "browser_launch",
  "parameters": {
    "headless": true
  }
}
```

*Launch a headless browser instance*

```json
{
  "tool": "browser_launch",
  "parameters": {
    "headless": false,
    "userDataDir": "./my_profile"
  }
}
```

*Launch browser with custom profile for authenticated sessions*


---

### browser_navigate

**Description:** Navigates a specific browser instance to a given URL.

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `browserId` | string | ✅ | The ID of the browser instance to navigate. |
| `url` | string | ✅ | The URL to navigate to. Must include protocol (http:// or https://). |

#### Output

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Confirmation message of successful navigation. |
| `url` | string | The URL that was navigated to. |
| `browserId` | string | The browser instance ID that was used. |

#### Example Usage

```json
{
  "tool": "browser_navigate",
  "parameters": {
    "browserId": "browser-123",
    "url": "https://example.com"
  }
}
```

*Navigate to a website*


---

### browser_screenshot

**Description:** Captures a screenshot of the current browser page. Returns base64 encoded image data. Optionally saves to disk.

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `browserId` | string | ✅ | The ID of the browser instance. |
| `fileName` | string | ❌ | Optional. The name of the file to save the screenshot as (e.g., 'my_page.png'). Saved to the server's configured output directory. If not provided, a timestamped name is used. |
| `saveToDisk` | boolean | ❌ | Optional. Whether to save the screenshot to disk on the server. Defaults to true. Set to false to only receive base64 data. |

#### Output

| Field | Type | Description |
|-------|------|-------------|
| `imageData` | string | Base64 encoded PNG image data. |
| `format` | string | Image format (e.g., 'png'). |
| `fileName` | string | The file name if saved to disk. |
| `browserId` | string | The browser instance ID that was used. |

#### Example Usage

```json
{
  "tool": "browser_screenshot",
  "parameters": {
    "browserId": "browser-123",
    "fileName": "page-capture.png"
  }
}
```

*Take a screenshot and save it*


---

### browser_type

**Description:** Types text into a specific input field in the browser.

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `browserId` | string | ✅ | The ID of the browser instance. |
| `selector` | string | ✅ | The CSS selector of the input field. |
| `text` | string | ✅ | The text to type into the input field. |

#### Output

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the typing was successful. |
| `browserId` | string | The browser instance ID that was used. |

#### Example Usage

```json
{
  "tool": "browser_type",
  "parameters": {
    "browserId": "browser-123",
    "locator": {
      "type": "css",
      "value": "#email-input"
    },
    "text": "user@example.com"
  }
}
```

*Type text into an input field*


---


## Feature Flags

Tools can be enabled or disabled using feature flags:

| Feature Flag | Environment Variable | Description |
|--------------|---------------------|-------------|
| `enableBrowserTools` | `MCP_FEATURES_ENABLEBROWSERTOOLS` | Enable/disable all browser automation tools |
| `enableFileTools` | `MCP_FEATURES_ENABLEFILETOOLS` | Enable/disable file system tools |
| `enableNetworkTools` | `MCP_FEATURES_ENABLENETWORKTOOLS` | Enable/disable network tools |
| `enableDebugMode` | `MCP_FEATURES_ENABLEDEBUGMODE` | Enable/disable debug mode |

### Usage Examples

```bash
# Disable browser tools
MCP_FEATURES_ENABLEBROWSERTOOLS=false node mcpServer.js

# Run in production mode
NODE_ENV=production node mcpServer.js

# Enable debug mode
MCP_FEATURES_ENABLEDEBUGMODE=true node mcpServer.js
```

