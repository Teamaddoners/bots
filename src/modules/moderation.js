const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class ModerationModule {
    constructor() {
        this.name = 'moderation';
        this.commands = [];
        this.autoModEnabled = false;
        this.spamProtection = false;
        this.capsFilter = false;
        this.linkFilter = false;
        this.profanityFilter = false;
    }

    init(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.database = bot.database;
        this.logger = bot.logger;
        
        this.setupCommands();
        this.setupEventHandlers();
        this.loadConfig();
    }

    loadConfig() {
        const modConfig = this.config.get('modules.moderation');
        if (modConfig) {
            this.autoModEnabled = modConfig.autoMod?.enabled || false;
            this.spamProtection = modConfig.autoMod?.spamProtection || false;
            this.capsFilter = modConfig.autoMod?.capsFilter || false;
            this.linkFilter = modConfig.autoMod?.linkFilter || false;
            this.profanityFilter = modConfig.autoMod?.profanityFilter || false;
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupCommands() {
        // Kick command
        this.commands.push({
            data: new SlashCommandBuilder()
                .setName('kick')
                .setDescription('Kick a member from the server')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to kick')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the kick')
                        .setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
            execute: this.kickUser.bind(this)
        });

        // Ban command
        this.commands.push({
            data: new SlashCommandBuilder()
                .setName('ban')
                .setDescription('Ban a member from the server')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to ban')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the ban')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('delete_messages')
                        .setDescription('Number of days of messages to delete (0-7)')
                        .setMinValue(0)
                        .setMaxValue(7)
                        .setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
            execute: this.banUser.bind(this)
        });

        // Mute command
        this.commands.push({
            data: new SlashCommandBuilder()
                .setName('mute')
                .setDescription('Mute a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to mute')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Duration of the mute (e.g., 1h, 30m, 1d)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the mute')
                        .setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
            execute: this.muteUser.bind(this)
        });

        // Unmute command
        this.commands.push({
            data: new SlashCommandBuilder()
                .setName('unmute')
                .setDescription('Unmute a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to unmute')
                        .setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
            execute: this.unmuteUser.bind(this)
        });

        // Clear messages command
        this.commands.push({
            data: new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Clear messages from a channel')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to clear (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Clear messages from a specific user')
                        .setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
            execute: this.clearMessages.bind(this)
        });

        // Warn command
        this.commands.push({
            data: new SlashCommandBuilder()
                .setName('warn')
                .setDescription('Warn a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to warn')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the warning')
                        .setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
            execute: this.warnUser.bind(this)
        });

        // Warnings command
        this.commands.push({
            data: new SlashCommandBuilder()
                .setName('warnings')
                .setDescription('View warnings for a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to check warnings for')
                        .setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
            execute: this.viewWarnings.bind(this)
        });

        // Auto-mod toggle command
        this.commands.push({
            data: new SlashCommandBuilder()
                .setName('automod')
                .setDescription('Configure auto-moderation settings')
                .addSubcommand(subcommand =>
                    subcommand.setName('toggle')
                        .setDescription('Toggle auto-moderation on/off'))
                .addSubcommand(subcommand =>
                    subcommand.setName('settings')
                        .setDescription('View current auto-moderation settings'))
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            execute: this.autoModConfig.bind(this)
        });
    }

    setupEventHandlers() {
        this.bot.client.on('messageCreate', this.handleMessage.bind(this));
    }

    async kickUser(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }

        if (!member.kickable) {
            return interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });
        }

        try {
            await member.kick(reason);
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('User Kicked')
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.logger.info(`User ${user.tag} kicked by ${interaction.user.tag} for: ${reason}`);
        } catch (error) {
            this.logger.error('Error kicking user:', error);
            await interaction.reply({ content: 'An error occurred while kicking the user.', ephemeral: true });
        }
    }

    async banUser(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

        try {
            await interaction.guild.members.ban(user, { 
                reason: reason,
                deleteMessageDays: deleteMessages
            });
            
            const embed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('User Banned')
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Messages Deleted', value: `${deleteMessages} days`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.logger.info(`User ${user.tag} banned by ${interaction.user.tag} for: ${reason}`);
        } catch (error) {
            this.logger.error('Error banning user:', error);
            await interaction.reply({ content: 'An error occurred while banning the user.', ephemeral: true });
        }
    }

    async muteUser(interaction) {
        const user = interaction.options.getUser('user');
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }

        try {
            let timeoutDuration = null;
            if (duration) {
                timeoutDuration = this.parseDuration(duration);
                if (!timeoutDuration) {
                    return interaction.reply({ content: 'Invalid duration format. Use formats like: 1h, 30m, 1d', ephemeral: true });
                }
            }

            await member.timeout(timeoutDuration, reason);
            
            const embed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle('User Muted')
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Duration', value: duration || 'Until manually removed', inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.logger.info(`User ${user.tag} muted by ${interaction.user.tag} for: ${reason}`);
        } catch (error) {
            this.logger.error('Error muting user:', error);
            await interaction.reply({ content: 'An error occurred while muting the user.', ephemeral: true });
        }
    }

    async unmuteUser(interaction) {
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }

        try {
            await member.timeout(null);
            
            const embed = new EmbedBuilder()
                .setColor('#2ed573')
                .setTitle('User Unmuted')
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.logger.info(`User ${user.tag} unmuted by ${interaction.user.tag}`);
        } catch (error) {
            this.logger.error('Error unmuting user:', error);
            await interaction.reply({ content: 'An error occurred while unmuting the user.', ephemeral: true });
        }
    }

    async clearMessages(interaction) {
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');
        const channel = interaction.channel;

        try {
            const messages = await channel.messages.fetch({ limit: amount });
            let messagesToDelete = messages;

            if (user) {
                messagesToDelete = messages.filter(msg => msg.author.id === user.id);
            }

            // Filter out messages older than 14 days
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            messagesToDelete = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);

            if (messagesToDelete.size === 0) {
                return interaction.reply({ content: 'No messages found to delete.', ephemeral: true });
            }

            await channel.bulkDelete(messagesToDelete);
            
            const embed = new EmbedBuilder()
                .setColor('#3742fa')
                .setTitle('Messages Cleared')
                .addFields(
                    { name: 'Amount', value: `${messagesToDelete.size}`, inline: true },
                    { name: 'Channel', value: channel.toString(), inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.logger.info(`${messagesToDelete.size} messages cleared by ${interaction.user.tag} in ${channel.name}`);
        } catch (error) {
            this.logger.error('Error clearing messages:', error);
            await interaction.reply({ content: 'An error occurred while clearing messages.', ephemeral: true });
        }
    }

    async warnUser(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        try {
            // Store warning in database
            await this.database.execute(
                'INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [interaction.guild.id, user.id, interaction.user.id, reason]
            );

            const embed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle('User Warned')
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            this.logger.info(`User ${user.tag} warned by ${interaction.user.tag} for: ${reason}`);
        } catch (error) {
            this.logger.error('Error warning user:', error);
            await interaction.reply({ content: 'An error occurred while warning the user.', ephemeral: true });
        }
    }

    async viewWarnings(interaction) {
        const user = interaction.options.getUser('user');

        try {
            const warnings = await this.database.query(
                'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC',
                [interaction.guild.id, user.id]
            );

            if (warnings.length === 0) {
                return interaction.reply({ content: `${user.tag} has no warnings.`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle(`Warnings for ${user.tag}`)
                .setThumbnail(user.displayAvatarURL());

            warnings.forEach((warning, index) => {
                embed.addFields({
                    name: `Warning #${index + 1}`,
                    value: `**Reason:** ${warning.reason}\n**Moderator:** <@${warning.moderator_id}>\n**Date:** <t:${Math.floor(new Date(warning.created_at).getTime() / 1000)}:F>`,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.logger.error('Error fetching warnings:', error);
            await interaction.reply({ content: 'An error occurred while fetching warnings.', ephemeral: true });
        }
    }

    async autoModConfig(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'toggle') {
            this.autoModEnabled = !this.autoModEnabled;
            this.config.set('modules.moderation.autoMod.enabled', this.autoModEnabled);
            
            const status = this.autoModEnabled ? 'enabled' : 'disabled';
            await interaction.reply({ content: `Auto-moderation has been ${status}.`, ephemeral: true });
        } else if (subcommand === 'settings') {
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('Auto-Moderation Settings')
                .addFields(
                    { name: 'Status', value: this.autoModEnabled ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Spam Protection', value: this.spamProtection ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Caps Filter', value: this.capsFilter ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Link Filter', value: this.linkFilter ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Profanity Filter', value: this.profanityFilter ? 'Enabled' : 'Disabled', inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }

    async handleMessage(message) {
        if (!this.autoModEnabled || message.author.bot || !message.guild) return;

        try {
            // Spam protection
            if (this.spamProtection) {
                await this.checkSpam(message);
            }

            // Caps filter
            if (this.capsFilter) {
                await this.checkCaps(message);
            }

            // Link filter
            if (this.linkFilter) {
                await this.checkLinks(message);
            }

            // Profanity filter
            if (this.profanityFilter) {
                await this.checkProfanity(message);
            }
        } catch (error) {
            this.logger.error('Error in auto-moderation:', error);
        }
    }

    async checkSpam(message) {
        // Simple spam detection - check for repeated messages
        const recentMessages = await message.channel.messages.fetch({ limit: 5 });
        const userMessages = recentMessages.filter(msg => 
            msg.author.id === message.author.id && 
            msg.content === message.content &&
            Date.now() - msg.createdTimestamp < 10000 // 10 seconds
        );

        if (userMessages.size >= 3) {
            await message.delete();
            await message.channel.send(`${message.author}, please don't spam!`);
        }
    }

    async checkCaps(message) {
        const capsRatio = (message.content.match(/[A-Z]/g) || []).length / message.content.length;
        
        if (capsRatio > 0.7 && message.content.length > 10) {
            await message.delete();
            await message.channel.send(`${message.author}, please don't use excessive caps!`);
        }
    }

    async checkLinks(message) {
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        const links = message.content.match(linkRegex);
        
        if (links && links.length > 0) {
            await message.delete();
            await message.channel.send(`${message.author}, links are not allowed in this channel!`);
        }
    }

    async checkProfanity(message) {
        // Simple profanity filter - in a real implementation, you'd use a proper profanity library
        const profanityWords = ['badword1', 'badword2']; // Replace with actual profanity list
        const hasProfanity = profanityWords.some(word => 
            message.content.toLowerCase().includes(word.toLowerCase())
        );
        
        if (hasProfanity) {
            await message.delete();
            await message.channel.send(`${message.author}, please keep the chat family-friendly!`);
        }
    }

    parseDuration(duration) {
        const regex = /(\d+)([smhd])/;
        const match = duration.match(regex);
        
        if (!match) return null;
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return null;
        }
    }

    getCommands() {
        return this.commands;
    }
}

module.exports = ModerationModule;
