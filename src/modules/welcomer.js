const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
let createCanvas, loadImage, registerFont;
try {
    ({ createCanvas, loadImage, registerFont } = require('canvas'));
} catch (_) {
    // canvas optional; features degrade gracefully
}
const path = require('path');

class WelcomerModule {
    constructor() {
        this.name = 'welcomer';
        this.enabled = false;
        this.welcomeChannel = null;
        this.leaveChannel = null;
        this.welcomeMessage = 'Welcome {user} to {server}!';
        this.leaveMessage = '{user} has left {server}.';
        this.autoRoles = [];
        this.welcomeCard = {
            enabled: true,
            background: '#2C2F33',
            textColor: '#FFFFFF',
            showAvatar: true,
            showLevel: true
        };
    }

    init(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.database = bot.database;
        this.logger = bot.logger;
        
        this.loadConfig();
        this.setupEventHandlers();
    }

    loadConfig() {
        const welcomerConfig = this.config.get('modules.welcomer');
        if (welcomerConfig) {
            this.enabled = welcomerConfig.enabled || false;
            this.welcomeChannel = welcomerConfig.welcomeChannel;
            this.leaveChannel = welcomerConfig.leaveChannel;
            this.welcomeMessage = welcomerConfig.welcomeMessage || 'Welcome {user} to {server}!';
            this.leaveMessage = welcomerConfig.leaveMessage || '{user} has left {server}.';
            this.autoRoles = welcomerConfig.autoRoles || [];
            this.welcomeCard = welcomerConfig.welcomeCard || {
                enabled: true,
                background: '#2C2F33',
                textColor: '#FFFFFF',
                showAvatar: true,
                showLevel: true
            };
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupEventHandlers() {
        this.bot.client.on('guildMemberAdd', this.handleMemberJoin.bind(this));
        this.bot.client.on('guildMemberRemove', this.handleMemberLeave.bind(this));
    }

    async handleMemberJoin(member) {
        if (!this.enabled) return;

        try {
            // Assign auto roles
            await this.assignAutoRoles(member);

            // Send welcome message
            await this.sendWelcomeMessage(member);

            // Generate welcome card
            if (this.welcomeCard.enabled) {
                await this.sendWelcomeCard(member);
            }

            this.logger.info(`New member joined: ${member.user.tag} in ${member.guild.name}`);
        } catch (error) {
            this.logger.error('Error handling member join:', error);
        }
    }

    async handleMemberLeave(member) {
        if (!this.enabled) return;

        try {
            await this.sendLeaveMessage(member);
            this.logger.info(`Member left: ${member.user.tag} from ${member.guild.name}`);
        } catch (error) {
            this.logger.error('Error handling member leave:', error);
        }
    }

    async assignAutoRoles(member) {
        try {
            for (const roleId of this.autoRoles) {
                const role = member.guild.roles.cache.get(roleId);
                if (role && member.guild.members.me.roles.highest.position > role.position) {
                    await member.roles.add(role);
                    this.logger.info(`Assigned auto role ${role.name} to ${member.user.tag}`);
                }
            }
        } catch (error) {
            this.logger.error('Error assigning auto roles:', error);
        }
    }

    async sendWelcomeMessage(member) {
        try {
            const channelId = this.welcomeChannel || member.guild.systemChannelId;
            if (!channelId) return;

            const channel = member.guild.channels.cache.get(channelId);
            if (!channel) return;

            const message = this.formatMessage(this.welcomeMessage, member);
            
            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('👋 Welcome!')
                .setDescription(message)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${member.user.tag}`, inline: true },
                    { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'Member Count', value: member.guild.memberCount.toString(), inline: true }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            this.logger.error('Error sending welcome message:', error);
        }
    }

    async sendLeaveMessage(member) {
        try {
            const channelId = this.leaveChannel || member.guild.systemChannelId;
            if (!channelId) return;

            const channel = member.guild.channels.cache.get(channelId);
            if (!channel) return;

            const message = this.formatMessage(this.leaveMessage, member);
            
            const embed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('👋 Goodbye!')
                .setDescription(message)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${member.user.tag}`, inline: true },
                    { name: 'Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
                    { name: 'Member Count', value: member.guild.memberCount.toString(), inline: true }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            this.logger.error('Error sending leave message:', error);
        }
    }

    async sendWelcomeCard(member) {
        try {
            const channelId = this.welcomeChannel || member.guild.systemChannelId;
            if (!channelId) return;

            const channel = member.guild.channels.cache.get(channelId);
            if (!channel) return;

            const welcomeCard = await this.generateWelcomeCard(member);
            if (welcomeCard) {
                await channel.send({ files: [welcomeCard] });
            }
        } catch (error) {
            this.logger.error('Error sending welcome card:', error);
        }
    }

    async generateWelcomeCard(member) {
        try {
            if (!createCanvas) return null;
            const canvas = createCanvas(800, 400);
            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = this.welcomeCard.background;
            ctx.fillRect(0, 0, 800, 400);

            // Background pattern or gradient
            const gradient = ctx.createLinearGradient(0, 0, 800, 400);
            gradient.addColorStop(0, this.welcomeCard.background);
            gradient.addColorStop(1, this.darkenColor(this.welcomeCard.background, 0.2));
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 400);

            // Welcome text
            ctx.fillStyle = this.welcomeCard.textColor;
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Welcome!', 400, 100);

            // Server name
            ctx.font = 'bold 32px Arial';
            ctx.fillText(`to ${member.guild.name}`, 400, 150);

            // User avatar
            if (this.welcomeCard.showAvatar) {
                const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128 }));
                ctx.save();
                ctx.beginPath();
                ctx.arc(400, 250, 60, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, 340, 190, 120, 120);
                ctx.restore();
            }

            // Username
            ctx.font = 'bold 28px Arial';
            ctx.fillText(member.user.username, 400, 320);

            // Member count
            ctx.font = '20px Arial';
            ctx.fillText(`Member #${member.guild.memberCount}`, 400, 350);

            // Level info (if leveling is enabled)
            if (this.welcomeCard.showLevel) {
                const levelingModule = this.bot.getModule('leveling');
                if (levelingModule && levelingModule.enabled) {
                    const userStats = await levelingModule.getUserStats(member.guild.id, member.id);
                    if (userStats) {
                        ctx.font = '18px Arial';
                        ctx.fillText(`Level ${userStats.level}`, 400, 370);
                    }
                }
            }

            const buffer = canvas.toBuffer('image/png');
            return new AttachmentBuilder(buffer, { name: 'welcome.png' });
        } catch (error) {
            this.logger.error('Error generating welcome card:', error);
            return null;
        }
    }

    formatMessage(message, member) {
        return message
            .replace(/{user}/g, member.user.toString())
            .replace(/{username}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{memberCount}/g, member.guild.memberCount.toString())
            .replace(/{mention}/g, member.toString());
    }

    darkenColor(color, amount) {
        // Simple color darkening function
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
        
        return `#${Math.floor(r).toString(16).padStart(2, '0')}${Math.floor(g).toString(16).padStart(2, '0')}${Math.floor(b).toString(16).padStart(2, '0')}`;
    }

    async addAutoRole(roleId) {
        if (!this.autoRoles.includes(roleId)) {
            this.autoRoles.push(roleId);
            this.config.set('modules.welcomer.autoRoles', this.autoRoles);
        }
    }

    async removeAutoRole(roleId) {
        this.autoRoles = this.autoRoles.filter(id => id !== roleId);
        this.config.set('modules.welcomer.autoRoles', this.autoRoles);
    }

    async setWelcomeChannel(channelId) {
        this.welcomeChannel = channelId;
        this.config.set('modules.welcomer.welcomeChannel', channelId);
    }

    async setLeaveChannel(channelId) {
        this.leaveChannel = channelId;
        this.config.set('modules.welcomer.leaveChannel', channelId);
    }

    async setWelcomeMessage(message) {
        this.welcomeMessage = message;
        this.config.set('modules.welcomer.welcomeMessage', message);
    }

    async setLeaveMessage(message) {
        this.leaveMessage = message;
        this.config.set('modules.welcomer.leaveMessage', message);
    }

    async updateWelcomeCard(settings) {
        this.welcomeCard = { ...this.welcomeCard, ...settings };
        this.config.set('modules.welcomer.welcomeCard', this.welcomeCard);
    }
}

module.exports = WelcomerModule;
