const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
let createCanvas, loadImage, registerFont;
try {
    ({ createCanvas, loadImage, registerFont } = require('canvas'));
} catch (_) {
    // canvas optional; features degrade gracefully
}
const path = require('path');

class LevelingModule {
    constructor() {
        this.name = 'leveling';
        this.enabled = false;
        this.messageXP = 15;
        this.voiceXP = 10;
        this.levelUpMessage = true;
        this.levelUpChannel = null;
        this.roleRewards = [];
        this.xpBoosters = [];
        this.userCooldowns = new Map();
        this.voiceTime = new Map();
    }

    init(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.database = bot.database;
        this.logger = bot.logger;
        
        this.loadConfig();
        this.setupEventHandlers();
        this.setupVoiceTracking();
    }

    loadConfig() {
        const levelingConfig = this.config.get('modules.leveling');
        if (levelingConfig) {
            this.enabled = levelingConfig.enabled || false;
            this.messageXP = levelingConfig.messageXP || 15;
            this.voiceXP = levelingConfig.voiceXP || 10;
            this.levelUpMessage = levelingConfig.levelUpMessage || true;
            this.levelUpChannel = levelingConfig.levelUpChannel;
            this.roleRewards = levelingConfig.roleRewards || [];
            this.xpBoosters = levelingConfig.xpBoosters || [];
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupEventHandlers() {
        this.bot.client.on('messageCreate', this.handleMessage.bind(this));
        this.bot.client.on('guildMemberAdd', this.handleMemberJoin.bind(this));
    }

    setupVoiceTracking() {
        this.bot.client.on('voiceStateUpdate', this.handleVoiceStateUpdate.bind(this));
        
        // Award voice XP every minute
        setInterval(() => {
            this.awardVoiceXP();
        }, 60000);
    }

    async handleMessage(message) {
        if (!this.enabled || message.author.bot || !message.guild) return;

        // Check cooldown
        const cooldownKey = `${message.guild.id}-${message.author.id}`;
        const lastMessage = this.userCooldowns.get(cooldownKey);
        const now = Date.now();
        
        if (lastMessage && (now - lastMessage) < 60000) { // 1 minute cooldown
            return;
        }

        this.userCooldowns.set(cooldownKey, now);

        try {
            await this.awardMessageXP(message.guild.id, message.author.id, this.messageXP);
        } catch (error) {
            this.logger.error('Error awarding message XP:', error);
        }
    }

    async handleMemberJoin(member) {
        if (!this.enabled) return;

        try {
            // Initialize user in database
            await this.database.execute(
                'INSERT OR IGNORE INTO users (id, guild_id, xp, level, total_xp) VALUES (?, ?, 0, 0, 0)',
                [member.id, member.guild.id]
            );
        } catch (error) {
            this.logger.error('Error initializing new member:', error);
        }
    }

    async handleVoiceStateUpdate(oldState, newState) {
        if (!this.enabled) return;

        const guildId = newState.guild.id;
        const userId = newState.member.id;

        // User joined voice channel
        if (!oldState.channelId && newState.channelId) {
            this.voiceTime.set(`${guildId}-${userId}`, Date.now());
        }
        // User left voice channel
        else if (oldState.channelId && !newState.channelId) {
            const joinTime = this.voiceTime.get(`${guildId}-${userId}`);
            if (joinTime) {
                const timeSpent = Date.now() - joinTime;
                const minutesSpent = Math.floor(timeSpent / 60000);
                
                if (minutesSpent >= 1) {
                    await this.awardVoiceXP(guildId, userId, this.voiceXP * minutesSpent);
                }
                
                this.voiceTime.delete(`${guildId}-${userId}`);
            }
        }
    }

    async awardMessageXP(guildId, userId, xp) {
        try {
            const user = await this.database.getUser(guildId, userId);
            if (!user) {
                // Create new user
                await this.database.execute(
                    'INSERT INTO users (id, guild_id, xp, level, total_xp) VALUES (?, ?, ?, 0, ?)',
                    [userId, guildId, xp, xp]
                );
                return;
            }

            const newXP = user.xp + xp;
            const newLevel = Math.floor(newXP / 1000);
            const oldLevel = user.level;

            // Update user XP
            await this.database.updateUserXP(guildId, userId, xp);

            // Check for level up
            if (newLevel > oldLevel) {
                await this.handleLevelUp(guildId, userId, newLevel, newXP);
            }
        } catch (error) {
            this.logger.error('Error awarding message XP:', error);
        }
    }

    async awardVoiceXP(guildId, userId, xp) {
        try {
            const user = await this.database.getUser(guildId, userId);
            if (!user) return;

            const newXP = user.xp + xp;
            const newLevel = Math.floor(newXP / 1000);
            const oldLevel = user.level;

            // Update user XP
            await this.database.updateUserXP(guildId, userId, xp);

            // Check for level up
            if (newLevel > oldLevel) {
                await this.handleLevelUp(guildId, userId, newLevel, newXP);
            }
        } catch (error) {
            this.logger.error('Error awarding voice XP:', error);
        }
    }

    async handleLevelUp(guildId, userId, newLevel, newXP) {
        try {
            const guild = this.bot.client.guilds.cache.get(guildId);
            const member = guild?.members.cache.get(userId);
            
            if (!member) return;

            // Send level up message
            if (this.levelUpMessage) {
                await this.sendLevelUpMessage(member, newLevel, newXP);
            }

            // Check for role rewards
            await this.checkRoleRewards(member, newLevel);

            // Generate level card
            const levelCard = await this.generateLevelCard(member, newLevel, newXP);
            
            this.logger.info(`User ${member.user.tag} leveled up to level ${newLevel} in ${guild.name}`);
        } catch (error) {
            this.logger.error('Error handling level up:', error);
        }
    }

    async sendLevelUpMessage(member, newLevel, newXP) {
        try {
            const channelId = this.levelUpChannel || member.guild.systemChannelId;
            if (!channelId) return;

            const channel = member.guild.channels.cache.get(channelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('🎉 Level Up!')
                .setDescription(`Congratulations ${member}! You've reached level **${newLevel}**!`)
                .addFields(
                    { name: 'Total XP', value: newXP.toString(), inline: true },
                    { name: 'XP to Next Level', value: (1000 - (newXP % 1000)).toString(), inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            this.logger.error('Error sending level up message:', error);
        }
    }

    async checkRoleRewards(member, newLevel) {
        try {
            for (const reward of this.roleRewards) {
                if (newLevel >= reward.level && !member.roles.cache.has(reward.roleId)) {
                    const role = member.guild.roles.cache.get(reward.roleId);
                    if (role) {
                        await member.roles.add(role);
                        this.logger.info(`Added role ${role.name} to ${member.user.tag} for reaching level ${newLevel}`);
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error checking role rewards:', error);
        }
    }

    async generateLevelCard(member, level, xp) {
        try {
            if (!createCanvas) return null;
            const canvas = createCanvas(800, 300);
            const ctx = canvas.getContext('2d');

            // Background
            const gradient = ctx.createLinearGradient(0, 0, 800, 300);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 300);

            // Avatar
            const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128 }));
            ctx.save();
            ctx.beginPath();
            ctx.arc(100, 150, 60, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 40, 90, 120, 120);
            ctx.restore();

            // Username
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(member.user.username, 200, 120);

            // Level
            ctx.font = 'bold 24px Arial';
            ctx.fillText(`Level ${level}`, 200, 150);

            // XP Bar
            const xpInLevel = xp % 1000;
            const xpBarWidth = 400;
            const xpBarHeight = 20;
            const xpBarX = 200;
            const xpBarY = 180;

            // Background bar
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(xpBarX, xpBarY, xpBarWidth, xpBarHeight);

            // Progress bar
            const progress = xpInLevel / 1000;
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(xpBarX, xpBarY, xpBarWidth * progress, xpBarHeight);

            // XP Text
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${xpInLevel}/1000 XP`, xpBarX + xpBarWidth / 2, xpBarY + 15);

            // Total XP
            ctx.textAlign = 'left';
            ctx.fillText(`Total XP: ${xp}`, 200, 230);

            const buffer = canvas.toBuffer('image/png');
            return new AttachmentBuilder(buffer, { name: 'levelcard.png' });
        } catch (error) {
            this.logger.error('Error generating level card:', error);
            return null;
        }
    }

    async getLeaderboard(guildId, limit = 10) {
        try {
            return await this.database.getLeaderboard(guildId, limit);
        } catch (error) {
            this.logger.error('Error getting leaderboard:', error);
            return [];
        }
    }

    async getUserRank(guildId, userId) {
        try {
            const leaderboard = await this.database.query(
                'SELECT id, total_xp FROM users WHERE guild_id = ? ORDER BY total_xp DESC',
                [guildId]
            );
            
            const userIndex = leaderboard.findIndex(user => user.id === userId);
            return userIndex + 1;
        } catch (error) {
            this.logger.error('Error getting user rank:', error);
            return null;
        }
    }

    async getUserStats(guildId, userId) {
        try {
            return await this.database.getUser(guildId, userId);
        } catch (error) {
            this.logger.error('Error getting user stats:', error);
            return null;
        }
    }

    async addRoleReward(level, roleId) {
        this.roleRewards.push({ level, roleId });
        this.config.set('modules.leveling.roleRewards', this.roleRewards);
    }

    async removeRoleReward(roleId) {
        this.roleRewards = this.roleRewards.filter(reward => reward.roleId !== roleId);
        this.config.set('modules.leveling.roleRewards', this.roleRewards);
    }

    async addXPBooster(multiplier, duration, roleId = null) {
        const booster = {
            multiplier,
            duration,
            roleId,
            expiresAt: Date.now() + duration
        };
        
        this.xpBoosters.push(booster);
        this.config.set('modules.leveling.xpBoosters', this.xpBoosters);
    }

    getXPBooster(userId, guildId) {
        const userBoosters = this.xpBoosters.filter(booster => 
            !booster.roleId || 
            this.bot.client.guilds.cache.get(guildId)?.members.cache.get(userId)?.roles.cache.has(booster.roleId)
        );

        if (userBoosters.length === 0) return 1;

        const activeBoosters = userBoosters.filter(booster => booster.expiresAt > Date.now());
        if (activeBoosters.length === 0) return 1;

        return Math.max(...activeBoosters.map(booster => booster.multiplier));
    }
}

module.exports = LevelingModule;
