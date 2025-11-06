const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('yaml');
const chalk = require('chalk');
const winston = require('winston');
const chokidar = require('chokidar');
require('dotenv').config();

// Import modules
const ConfigManager = require('./utils/ConfigManager');
const Logger = require('./utils/Logger');
const Database = require('./utils/Database');

class DiscordBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.commands = new Collection();
        this.events = new Collection();
        this.modules = new Collection();
        
        this.config = new ConfigManager();
        this.logger = new Logger();
        this.database = new Database();
        
        this.setupEventHandlers();
        this.loadCommands();
        this.loadEvents();
        this.loadModules();
        this.setupConfigWatcher();
    }

    async start() {
        try {
            await this.database.init();
            await this.client.login(this.config.get('bot.token'));
            this.logger.info('Bot started successfully!');
        } catch (error) {
            this.logger.error('Failed to start bot:', error);
            process.exit(1);
        }
    }

    setupEventHandlers() {
        this.client.once(Events.ClientReady, () => {
            this.logger.info(`Logged in as ${this.client.user.tag}!`);
            this.client.user.setActivity('Managing servers', { type: 'WATCHING' });
        });

        this.client.on(Events.Error, (error) => {
            this.logger.error('Discord client error:', error);
        });

        this.client.on(Events.Warn, (warning) => {
            this.logger.warn('Discord client warning:', warning);
        });
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
            return;
        }

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                this.commands.set(command.data.name, command);
                this.logger.info(`Loaded command: ${command.data.name}`);
            } else {
                this.logger.warn(`Command ${file} is missing required properties`);
            }
        }
    }

    loadEvents() {
        const eventsPath = path.join(__dirname, 'events');
        if (!fs.existsSync(eventsPath)) {
            fs.mkdirSync(eventsPath, { recursive: true });
            return;
        }

        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
        
        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            
            if (event.once) {
                this.client.once(event.name, (...args) => event.execute(...args, this));
            } else {
                this.client.on(event.name, (...args) => event.execute(...args, this));
            }
            
            this.logger.info(`Loaded event: ${event.name}`);
        }
    }

    loadModules() {
        const modulesPath = path.join(__dirname, 'modules');
        if (!fs.existsSync(modulesPath)) {
            fs.mkdirSync(modulesPath, { recursive: true });
            return;
        }

        const moduleFiles = fs.readdirSync(modulesPath).filter(file => file.endsWith('.js'));
        
        for (const file of moduleFiles) {
            const filePath = path.join(modulesPath, file);
            const module = require(filePath);
            
            if (module.init) {
                module.init(this);
                this.modules.set(module.name, module);
                this.logger.info(`Loaded module: ${module.name}`);
            }
        }
    }

    setupConfigWatcher() {
        const configPath = path.join(__dirname, '..', 'config.yml');
        const watcher = chokidar.watch(configPath);
        
        watcher.on('change', () => {
            this.logger.info('Config file changed, reloading...');
            this.config.reload();
            this.broadcastConfigUpdate();
        });
    }

    broadcastConfigUpdate() {
        // Notify all modules of config update
        this.modules.forEach(module => {
            if (module.onConfigUpdate) {
                module.onConfigUpdate(this.config);
            }
        });
    }

    getCommand(name) {
        return this.commands.get(name);
    }

    getModule(name) {
        return this.modules.get(name);
    }
}

// Start the bot
const bot = new DiscordBot();
bot.start();

module.exports = DiscordBot;
