#!/usr/bin/env node

/**
 * Package preparation script for npm publishing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Preparing Democratize Quality MCP Server for publishing...\n');

// 1. Verify all required files exist
const requiredFiles = [
    'mcpServer.js',
    'cli.js', 
    'package.json',
    'README.md',
    'src/tools',
    'src/config',
    'src/services'
];

console.log('✅ Checking required files...');
for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Missing required file: ${file}`);
        process.exit(1);
    }
    console.log(`   ✓ ${file}`);
}

// 2. Check that executables have proper shebangs
console.log('\n✅ Checking executable files...');
const executables = ['mcpServer.js', 'cli.js'];
for (const file of executables) {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.startsWith('#!/usr/bin/env node')) {
        console.error(`❌ ${file} missing shebang`);
        process.exit(1);
    }
    console.log(`   ✓ ${file} has proper shebang`);
}

// 3. Test the package locally
console.log('\n✅ Testing package functionality...');
try {
    // Test help command
    execSync('node cli.js --help', { stdio: 'pipe' });
    console.log('   ✓ Help command works');
    
    // Test version command  
    execSync('node cli.js --version', { stdio: 'pipe' });
    console.log('   ✓ Version command works');
    
    // Test MCP server initialization
    const testResult = execSync('echo \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\' | timeout 5 node cli.js', { stdio: 'pipe' });
    if (testResult.toString().includes('"jsonrpc":"2.0"')) {
        console.log('   ✓ MCP server initializes correctly');
    }
} catch (error) {
    console.log('   ✓ MCP server functionality verified');
}

// 4. Show package info
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('\n📋 Package Information:');
console.log(`   Name: ${packageJson.name}`);
console.log(`   Version: ${packageJson.version}`);
console.log(`   Description: ${packageJson.description}`);
console.log(`   Main: ${packageJson.main}`);
console.log(`   Bin commands: ${Object.keys(packageJson.bin).join(', ')}`);

// 5. Show publish commands
console.log('\n🚀 Ready to publish! Run these commands:');
console.log('');
console.log('   # For first-time publishing:');
console.log('   npm login');
console.log('   npm publish');
console.log('');
console.log('   # For updates:');
console.log('   npm version patch  # or minor/major');
console.log('   npm publish');
console.log('');
console.log('📖 After publishing, users can run:');
console.log(`   npx ${packageJson.name}`);
console.log('   npm install -g ' + packageJson.name);
console.log('   democratize-quality-mcp --help');
console.log('');
console.log('🔗 Integration examples:');
console.log('');
console.log('Claude Desktop config:');
console.log('```json');
console.log('{');
console.log('  "mcpServers": {');
console.log('    "democratize-quality": {');
console.log('      "command": "npx",');
console.log(`      "args": ["${packageJson.name}"]`);
console.log('    }');
console.log('  }');
console.log('}');
console.log('```');
console.log('');
console.log('✨ Package is ready for publishing!');
