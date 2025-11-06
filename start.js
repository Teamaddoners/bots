const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

console.log('🚀 Starting Crenors Discord Bot...');
console.log('📝 Made by Team Addoners');
console.log('');

// Check if .env file exists
const fs = require('fs');
if (!fs.existsSync('.env')) {
    console.log('❌ .env file not found!');
    console.log('📋 Please copy env.example to .env and configure your settings.');
    console.log('   cp env.example .env');
    process.exit(1);
}

// Check required environment variables
const requiredVars = ['BOT_TOKEN', 'BOT_OWNER_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log('');
    console.log('📋 Please set these in your .env file.');
    process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log('🌐 Starting web editor...');

// Start web editor
const webEditor = spawn('node', ['src/web_editor/server.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
});

webEditor.on('error', (err) => {
    console.error('❌ Failed to start web editor:', err);
    process.exit(1);
});

// Start bot after a short delay
setTimeout(() => {
    console.log('🤖 Starting Discord bot...');
    
    const bot = spawn('node', ['src/index.js'], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    bot.on('error', (err) => {
        console.error('❌ Failed to start bot:', err);
        process.exit(1);
    });

    bot.on('exit', (code) => {
        console.log(`🤖 Bot exited with code ${code}`);
        webEditor.kill();
        process.exit(code);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        bot.kill();
        webEditor.kill();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down...');
        bot.kill();
        webEditor.kill();
        process.exit(0);
    });

}, 2000);

webEditor.on('exit', (code) => {
    console.log(`🌐 Web editor exited with code ${code}`);
    process.exit(code);
});
