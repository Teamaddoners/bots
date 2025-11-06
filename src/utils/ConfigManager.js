const fs = require('fs-extra');
const path = require('path');
const yaml = require('yaml');
const EventEmitter = require('events');

class ConfigManager extends EventEmitter {
    constructor() {
        super();
        this.configPath = path.join(__dirname, '..', '..', 'config.yml');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                this.createDefaultConfig();
            }
            
            const fileContent = fs.readFileSync(this.configPath, 'utf8');
            return yaml.parse(fileContent);
        } catch (error) {
            console.error('Error loading config:', error);
            return this.getDefaultConfig();
        }
    }

    createDefaultConfig() {
        const defaultConfig = this.getDefaultConfig();
        fs.writeFileSync(this.configPath, yaml.stringify(defaultConfig));
        console.log('Created default config.yml file');
    }

    getDefaultConfig() {
        return {
            bot: {
                token: process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
                prefix: process.env.BOT_PREFIX || '!',
                ownerId: process.env.BOT_OWNER_ID || 'YOUR_USER_ID_HERE',
                status: 'online',
                activity: {
                    type: 'WATCHING',
                    name: 'Crenors Bot - Made by Team Addoners'
                }
            },
            permissions: {
                adminRoles: [],
                moderatorRoles: [],
                djRoles: []
            },
            modules: {
                moderation: {
                    enabled: true,
                    autoMod: {
                        enabled: true,
                        spamProtection: true,
                        capsFilter: true,
                        linkFilter: false,
                        profanityFilter: false
                    },
                    commands: {
                        kick: { enabled: true, cooldown: 3 },
                        ban: { enabled: true, cooldown: 5 },
                        mute: { enabled: true, cooldown: 3 },
                        clear: { enabled: true, cooldown: 2 }
                    }
                },
                leveling: {
                    enabled: true,
                    messageXP: 15,
                    voiceXP: 10,
                    levelUpMessage: true,
                    levelUpChannel: null,
                    roleRewards: [],
                    xpBoosters: []
                },
                welcomer: {
                    enabled: true,
                    welcomeChannel: null,
                    leaveChannel: null,
                    welcomeMessage: 'Welcome {user} to {server}!',
                    leaveMessage: '{user} has left {server}.',
                    autoRoles: [],
                    welcomeCard: {
                        enabled: true,
                        background: '#2C2F33',
                        textColor: '#FFFFFF',
                        showAvatar: true,
                        showLevel: true
                    }
                },
                tickets: {
                    enabled: true,
                    panels: [],
                    transcriptChannel: null,
                    autoClose: {
                        enabled: false,
                        time: 24
                    }
                },
                polls: {
                    enabled: true,
                    defaultDuration: 24,
                    allowMultiple: false,
                    requireRole: null
                },
                music: {
                    enabled: true,
                    defaultVolume: 50,
                    djRole: null,
                    maxQueue: 100,
                    defaultPlaylist: null
                },
                social: {
                    enabled: true,
                    youtube: {
                        enabled: false,
                        channel: null,
                        webhook: null
                    },
                    twitter: {
                        enabled: false,
                        accounts: []
                    },
                    twitch: {
                        enabled: false,
                        streamers: []
                    },
                    reddit: {
                        enabled: false,
                        subreddits: []
                    }
                },
                premium: {
                    enabled: false,
                    features: {
                        customStatus: false,
                        removeBranding: false,
                        customModules: false,
                        verification: false,
                        autoReact: false,
                        starboard: false,
                        tempVoice: false,
                        stickyMessages: false,
                        emojiManager: false,
                        birthdays: false,
                        suggestions: false
                    }
                }
            },
            webEditor: {
                enabled: true,
                port: 3000,
                adminOnly: true,
                theme: 'dark'
            }
        };
    }

    get(path) {
        return this.getNestedValue(this.config, path);
    }

    set(path, value) {
        this.setNestedValue(this.config, path, value);
        this.save();
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    save() {
        try {
            fs.writeFileSync(this.configPath, yaml.stringify(this.config, { indent: 2 }));
            this.emit('configUpdated', this.config);
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    reload() {
        this.config = this.loadConfig();
        this.emit('configUpdated', this.config);
    }

    validate() {
        const errors = [];
        
        if (!this.config.bot.token || this.config.bot.token === 'YOUR_BOT_TOKEN_HERE') {
            errors.push('Bot token is not set');
        }
        
        if (!this.config.bot.ownerId || this.config.bot.ownerId === 'YOUR_USER_ID_HERE') {
            errors.push('Owner ID is not set');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = ConfigManager;
