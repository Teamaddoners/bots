const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const yaml = require('yaml');
const ConfigManager = require('../utils/ConfigManager');
require('dotenv').config();

class WebEditor {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.config = new ConfigManager();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.adminToken = process.env.WEB_ADMIN_TOKEN || null;
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    setupRoutes() {
        // Main dashboard route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // API routes
        this.app.get('/api/config', (req, res) => {
            if (!this.isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
            res.json(this.config.config);
        });

        this.app.post('/api/config', (req, res) => {
            if (!this.isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
            try {
                const { path: configPath, value } = req.body;
                this.config.set(configPath, value);
                this.io.emit('configUpdated', { path: configPath, value });
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/config/bulk', (req, res) => {
            if (!this.isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
            try {
                const updates = req.body;
                for (const { path: configPath, value } of updates) {
                    this.config.set(configPath, value);
                }
                this.io.emit('configBulkUpdate', updates);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/validate', (req, res) => {
            if (!this.isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
            const validation = this.config.validate();
            res.json(validation);
        });

        this.app.post('/api/export', (req, res) => {
            if (!this.isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
            try {
                const configData = this.config.config;
                res.setHeader('Content-Type', 'application/x-yaml');
                res.setHeader('Content-Disposition', 'attachment; filename="config.yml"');
                res.send(yaml.stringify(configData));
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/import', (req, res) => {
            if (!this.isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
            try {
                const { configData } = req.body;
                // Validate the imported config
                const tempConfig = new ConfigManager();
                tempConfig.config = configData;
                const validation = tempConfig.validate();
                
                if (validation.valid) {
                    this.config.config = configData;
                    this.config.save();
                    this.io.emit('configImported', configData);
                    res.json({ success: true });
                } else {
                    res.status(400).json({ error: 'Invalid config', details: validation.errors });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    isAuthorized(req) {
        if (!this.adminToken) return true; // open if no token set
        const header = req.headers['x-admin-token'] || req.headers['authorization'];
        if (!header) return false;
        const token = header.startsWith('Bearer ')? header.substring(7): header;
        return token === this.adminToken;
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Client connected to web editor');
            
            socket.on('disconnect', () => {
                console.log('Client disconnected from web editor');
            });

            socket.on('requestConfig', () => {
                socket.emit('configData', this.config.config);
            });
        });

        // Listen for config changes and broadcast to all clients
        this.config.on('configUpdated', (newConfig) => {
            this.io.emit('configUpdated', newConfig);
        });
    }

    start(port = process.env.WEB_PORT || 3000) {
        const host = process.env.WEB_HOST || 'localhost';
        this.server.listen(port, host, () => {
            console.log(`🌐 Crenors Web Editor running on http://${host}:${port}`);
            console.log('📝 Made by Team Addoners');
        });
    }
}

// Start the web editor if this file is run directly
if (require.main === module) {
    const editor = new WebEditor();
    editor.start();
}

module.exports = WebEditor;
