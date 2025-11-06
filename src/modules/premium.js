const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class PremiumModule {
    constructor() {
        this.name = 'premium';
        this.enabled = false;
        this.features = {
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
        };
        this.premiumGuilds = new Map();
    }

    init(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.database = bot.database;
        this.logger = bot.logger;
        
        this.loadConfig();
        this.setupEventHandlers();
        this.loadPremiumGuilds();
    }

    loadConfig() {
        const premiumConfig = this.config.get('modules.premium');
        if (premiumConfig) {
            this.enabled = premiumConfig.enabled || false;
            this.features = premiumConfig.features || this.features;
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupEventHandlers() {
        this.bot.client.on('messageCreate', this.handleMessage.bind(this));
        this.bot.client.on('messageReactionAdd', this.handleReactionAdd.bind(this));
        this.bot.client.on('voiceStateUpdate', this.handleVoiceStateUpdate.bind(this));
    }

    async loadPremiumGuilds() {
        try {
            const guilds = await this.database.query('SELECT * FROM premium_guilds');
            for (const guild of guilds) {
                this.premiumGuilds.set(guild.guild_id, {
                    features: JSON.parse(guild.features),
                    expiresAt: guild.expires_at
                });
            }
        } catch (error) {
            this.logger.error('Error loading premium guilds:', error);
        }
    }

    async handleMessage(message) {
        if (!this.enabled || message.author.bot) return;

        const guildId = message.guild?.id;
        if (!guildId || !this.isPremiumGuild(guildId)) return;

        try {
            // Auto-react feature
            if (this.features.autoReact && this.hasFeature(guildId, 'autoReact')) {
                await this.handleAutoReact(message);
            }

            // Starboard feature
            if (this.features.starboard && this.hasFeature(guildId, 'starboard')) {
                await this.handleStarboard(message);
            }

            // Sticky messages feature
            if (this.features.stickyMessages && this.hasFeature(guildId, 'stickyMessages')) {
                await this.handleStickyMessages(message);
            }
        } catch (error) {
            this.logger.error('Error handling premium message features:', error);
        }
    }

    async handleReactionAdd(reaction, user) {
        if (!this.enabled || user.bot) return;

        const guildId = reaction.message.guild?.id;
        if (!guildId || !this.isPremiumGuild(guildId)) return;

        try {
            // Starboard feature
            if (this.features.starboard && this.hasFeature(guildId, 'starboard')) {
                await this.handleStarboardReaction(reaction, user);
            }
        } catch (error) {
            this.logger.error('Error handling premium reaction:', error);
        }
    }

    async handleVoiceStateUpdate(oldState, newState) {
        if (!this.enabled) return;

        const guildId = newState.guild.id;
        if (!this.isPremiumGuild(guildId)) return;

        try {
            // Temporary voice channels feature
            if (this.features.tempVoice && this.hasFeature(guildId, 'tempVoice')) {
                await this.handleTempVoice(oldState, newState);
            }
        } catch (error) {
            this.logger.error('Error handling premium voice state update:', error);
        }
    }

    async handleAutoReact(message) {
        // Simple auto-react implementation
        const reactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        
        try {
            await message.react(randomReaction);
        } catch (error) {
            this.logger.error('Error auto-reacting:', error);
        }
    }

    async handleStarboard(message) {
        // Check if message has enough stars
        const starReaction = message.reactions.cache.get('⭐');
        if (!starReaction || starReaction.count < 3) return;

        // Check if already in starboard
        const existing = await this.database.query(
            'SELECT * FROM starboard WHERE original_message_id = ?',
            [message.id]
        );

        if (existing.length > 0) return;

        // Create starboard embed
        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setDescription(message.content)
            .addFields(
                { name: 'Author', value: message.author.toString(), inline: true },
                { name: 'Channel', value: message.channel.toString(), inline: true },
                { name: 'Stars', value: starReaction.count.toString(), inline: true }
            )
            .setTimestamp(message.createdAt);

        if (message.attachments.size > 0) {
            embed.setImage(message.attachments.first().url);
        }

        // Post to starboard channel
        const starboardChannel = message.guild.channels.cache.find(ch => 
            ch.name.includes('starboard') || ch.name.includes('stars')
        );

        if (starboardChannel) {
            const starboardMessage = await starboardChannel.send({ embeds: [embed] });
            
            // Store in database
            await this.database.execute(
                'INSERT INTO starboard (guild_id, original_message_id, starboard_message_id, stars) VALUES (?, ?, ?, ?)',
                [message.guild.id, message.id, starboardMessage.id, starReaction.count]
            );
        }
    }

    async handleStarboardReaction(reaction, user) {
        if (reaction.emoji.name !== '⭐') return;

        const message = reaction.message;
        const starReaction = message.reactions.cache.get('⭐');
        
        if (starReaction.count >= 3) {
            await this.handleStarboard(message);
        }
    }

    async handleStickyMessages(message) {
        // Check if message is in a channel with sticky messages
        const stickyChannel = await this.database.query(
            'SELECT * FROM sticky_messages WHERE channel_id = ?',
            [message.channel.id]
        );

        if (stickyChannel.length === 0) return;

        const sticky = stickyChannel[0];
        
        // Delete old sticky message if it exists
        if (sticky.message_id) {
            try {
                const oldMessage = await message.channel.messages.fetch(sticky.message_id);
                await oldMessage.delete();
            } catch (error) {
                // Message might not exist anymore
            }
        }

        // Post new sticky message
        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('📌 Sticky Message')
            .setDescription(sticky.content)
            .setTimestamp();

        const stickyMessage = await message.channel.send({ embeds: [embed] });
        
        // Update database
        await this.database.execute(
            'UPDATE sticky_messages SET message_id = ? WHERE channel_id = ?',
            [stickyMessage.id, message.channel.id]
        );
    }

    async handleTempVoice(oldState, newState) {
        // Check if user joined a "Create Channel" channel
        const createChannel = newState.guild.channels.cache.find(ch => 
            ch.name.includes('Create') && ch.type === 2 // Voice channel
        );

        if (newState.channelId === createChannel?.id) {
            // Create temporary voice channel
            const tempChannel = await newState.guild.channels.create({
                name: `${newState.member.user.username}'s Channel`,
                type: 2, // Voice channel
                parent: createChannel.parent
            });

            // Move user to new channel
            await newState.member.voice.setChannel(tempChannel);
        }

        // Check if user left a temporary channel
        if (oldState.channelId && oldState.channel.members.size === 0) {
            const channelName = oldState.channel.name;
            if (channelName.includes("'s Channel")) {
                await oldState.channel.delete();
            }
        }
    }

    async addPremiumGuild(guildId, features, expiresAt = null) {
        try {
            await this.database.execute(
                'INSERT OR REPLACE INTO premium_guilds (guild_id, features, expires_at) VALUES (?, ?, ?)',
                [guildId, JSON.stringify(features), expiresAt]
            );

            this.premiumGuilds.set(guildId, { features, expiresAt });
            this.logger.info(`Added premium features for guild ${guildId}`);
        } catch (error) {
            this.logger.error('Error adding premium guild:', error);
        }
    }

    async removePremiumGuild(guildId) {
        try {
            await this.database.execute(
                'DELETE FROM premium_guilds WHERE guild_id = ?',
                [guildId]
            );

            this.premiumGuilds.delete(guildId);
            this.logger.info(`Removed premium features for guild ${guildId}`);
        } catch (error) {
            this.logger.error('Error removing premium guild:', error);
        }
    }

    isPremiumGuild(guildId) {
        const guild = this.premiumGuilds.get(guildId);
        if (!guild) return false;

        // Check if premium has expired
        if (guild.expiresAt && new Date(guild.expiresAt) < new Date()) {
            this.removePremiumGuild(guildId);
            return false;
        }

        return true;
    }

    hasFeature(guildId, feature) {
        const guild = this.premiumGuilds.get(guildId);
        if (!guild) return false;

        return guild.features[feature] === true;
    }

    async setFeature(guildId, feature, enabled) {
        const guild = this.premiumGuilds.get(guildId);
        if (!guild) return false;

        guild.features[feature] = enabled;
        await this.database.execute(
            'UPDATE premium_guilds SET features = ? WHERE guild_id = ?',
            [JSON.stringify(guild.features), guildId]
        );

        this.premiumGuilds.set(guildId, guild);
        return true;
    }

    async createVerificationPanel(guildId, channelId, roleId) {
        try {
            const channel = this.bot.client.channels.cache.get(channelId);
            if (!channel) return false;

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('🔐 Server Verification')
                .setDescription('Click the button below to verify your account and gain access to the server.')
                .setFooter({ text: 'This helps keep our server safe from bots and spam.' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('verify_button')
                        .setLabel('Verify Account')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅')
                );

            await channel.send({ embeds: [embed], components: [row] });
            return true;
        } catch (error) {
            this.logger.error('Error creating verification panel:', error);
            return false;
        }
    }

    async handleVerification(interaction) {
        try {
            const member = interaction.member;
            const roleId = this.config.get('modules.premium.verificationRole');
            
            if (roleId) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('✅ Verification Complete')
                .setDescription('Your account has been verified! Welcome to the server.')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            this.logger.error('Error handling verification:', error);
            await interaction.reply({ 
                content: 'An error occurred during verification.', 
                ephemeral: true 
            });
        }
    }

    async createSuggestionPanel(guildId, channelId) {
        try {
            const channel = this.bot.client.channels.cache.get(channelId);
            if (!channel) return false;

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('💡 Suggestions')
                .setDescription('Have an idea to improve our server? Submit a suggestion using the button below!')
                .setFooter({ text: 'All suggestions are reviewed by our staff team.' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('suggest_button')
                        .setLabel('Submit Suggestion')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💡')
                );

            await channel.send({ embeds: [embed], components: [row] });
            return true;
        } catch (error) {
            this.logger.error('Error creating suggestion panel:', error);
            return false;
        }
    }

    async handleSuggestion(interaction) {
        try {
            // This would typically open a modal for the user to submit their suggestion
            // For now, we'll just acknowledge the interaction
            await interaction.reply({ 
                content: 'Suggestion feature is not fully implemented yet.', 
                ephemeral: true 
            });
        } catch (error) {
            this.logger.error('Error handling suggestion:', error);
        }
    }

    async getPremiumStatus(guildId) {
        const guild = this.premiumGuilds.get(guildId);
        if (!guild) return null;

        return {
            isPremium: true,
            features: guild.features,
            expiresAt: guild.expiresAt
        };
    }
}

module.exports = PremiumModule;
