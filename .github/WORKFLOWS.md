# GitHub Actions Workflows

This repository includes automated GitHub Actions workflows for CI/CD, testing, and publishing.

## 🔄 Workflows Overview

### 1. **CI Workflow** (`.github/workflows/ci.yml`)
**Triggers:** Push to main/develop, Pull Requests to main
**Purpose:** Continuous Integration testing

**What it does:**
- Tests on Node.js versions 16, 18, and 20
- Runs `npm test` and validation checks
- Tests CLI commands functionality
- Validates package.json configuration
- Ensures MCP server can start correctly

### 2. **Release Workflow** (`.github/workflows/release.yml`)
**Triggers:** Manual dispatch via GitHub Actions UI
**Purpose:** Create versioned releases with changelog

**What it does:**
- Allows selection of release type (patch/minor/major)
- Supports prerelease versions
- Automatically bumps version in package.json
- Updates version references in README.md
- Creates git tags and GitHub releases
- Generates changelog from commit history

### 3. **Publish Workflow** (`.github/workflows/publish-npm.yml`)
**Triggers:** GitHub release published, Manual dispatch
**Purpose:** Automatically publish to NPM

**What it does:**
- Runs full test suite
- Executes pre-publish validation checks
- Publishes to NPM with provenance
- Creates detailed release summary
- Provides installation instructions

## 🛠️ Setup Requirements

### 1. NPM Token Setup
1. Go to [npm.com](https://www.npmjs.com/) and log in
2. Navigate to Access Tokens in your account settings
3. Create a new "Automation" token with "Publish" permissions
4. In your GitHub repository:
   - Go to **Settings** → **Secrets and variables** → **Actions**
   - Create a new secret named `NPM_TOKEN`
   - Paste your npm token as the value

### 2. Organization Setup (if using @democratize-quality)
1. Create the npm organization: `npm org create democratize-quality`
2. Add your npm account as an owner
3. Ensure publishing permissions are correctly set

## 🚀 Usage Instructions

### Creating a Release

1. **Go to GitHub Actions tab** in your repository
2. **Select "Release" workflow**
3. **Click "Run workflow"**
4. **Choose release type:**
   - `patch`: Bug fixes (1.0.0 → 1.0.1)
   - `minor`: New features (1.0.0 → 1.1.0)
   - `major`: Breaking changes (1.0.0 → 2.0.0)
5. **Check "prerelease"** if this is a beta/alpha version
6. **Click "Run workflow"**

This will:
- ✅ Bump the version
- ✅ Create a git tag
- ✅ Generate a GitHub release
- ✅ Trigger the publish workflow automatically

### Manual Publishing

1. **Go to GitHub Actions tab**
2. **Select "Publish to NPM" workflow**
3. **Click "Run workflow"**
4. **Optionally specify a version** (or leave empty for current)
5. **Click "Run workflow"**

### Monitoring Workflow Status

- **Green checkmark** ✅: Workflow succeeded
- **Red X** ❌: Workflow failed - check logs for details
- **Yellow circle** 🟡: Workflow in progress

## 📋 Workflow Security Features

### NPM Provenance
- All packages are published with npm provenance
- Provides cryptographic proof of package origin
- Enhances supply chain security

### Minimal Permissions
- Workflows use least-privilege access
- Secrets are only accessible when needed
- Limited to specific repository actions

### Automated Validation
- Full test suite runs before publishing
- Package validation ensures correctness
- CLI functionality is verified

## 🔧 Customization

### Modifying Test Matrix
Edit `.github/workflows/ci.yml` to change Node.js versions:
```yaml
strategy:
  matrix:
    node-version: [16, 18, 20, 22]  # Add Node 22
```

### Changing Release Branch
Edit workflows to use different default branch:
```yaml
on:
  push:
    branches: [ main, develop ]  # Change to your branches
```

### Adding Deployment Environments
Add environment protection rules in repository settings:
- **Settings** → **Environments**
- Create "production" environment
- Add protection rules and required reviewers

## 🐛 Troubleshooting

### Common Issues

**1. NPM_TOKEN not working**
- Verify token has "Automation" type and "Publish" permissions
- Check token hasn't expired
- Ensure organization permissions are correct

**2. Version conflicts**
- Check if version already exists on npm
- Verify git tags are unique
- Use prerelease for testing: `1.0.0-beta.1`

**3. Tests failing in CI**
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Test locally with same Node version

**4. Release workflow not triggering publish**
- Ensure release is marked as "published" not "draft"
- Check workflow permissions in repository settings
- Verify branch protection rules allow automation

### Getting Help

1. Check workflow logs in GitHub Actions tab
2. Review the specific failing step
3. Compare with successful workflow runs
4. Check repository settings and permissions

---

## 📖 Example Workflow Run

### Typical Release Process:
1. **Development** → Code changes, tests pass in CI
2. **Release** → Run release workflow (e.g., minor bump)
3. **Version** → 1.0.0 → 1.1.0, tagged and released
4. **Publish** → Automatically publishes to NPM
5. **Users** → Can install: `npx @democratize-quality/mcp-server`

### Timeline:
- **CI Workflow**: ~2-3 minutes per push/PR
- **Release Workflow**: ~1-2 minutes 
- **Publish Workflow**: ~2-3 minutes
- **Total**: New release to npm in ~5 minutes! ⚡

---

*Automated workflows ensure consistent, reliable releases while maintaining quality standards.*
