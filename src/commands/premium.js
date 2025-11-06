const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('Premium features management')
        .addSubcommand(subcommand =>
            subcommand.setName('status')
                .setDescription('Check premium status'))
        .addSubcommand(subcommand =>
            subcommand.setName('features')
                .setDescription('View available premium features'))
        .addSubcommand(subcommand =>
            subcommand.setName('starboard')
                .setDescription('Configure starboard')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Starboard channel')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('threshold')
                        .setDescription('Minimum stars required')
                        .setMinValue(1)
                        .setMaxValue(50)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('verification')
                .setDescription('Setup verification system')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Verification channel')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to give after verification')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('suggestions')
                .setDescription('Setup suggestions system')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Suggestions channel')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('sticky')
                .setDescription('Manage sticky messages')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: 'Set', value: 'set' },
                            { name: 'Remove', value: 'remove' }
                        )
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for sticky message')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('content')
                        .setDescription('Sticky message content')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('tempvoice')
                .setDescription('Setup temporary voice channels')
                .addChannelOption(option =>
                    option.setName('create_channel')
                        .setDescription('Channel to create temp channels from')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        const premiumModule = bot.getModule('premium');
        
        if (!premiumModule) {
            return interaction.reply({ content: 'Premium module is not loaded.', ephemeral: true });
        }

        if (!premiumModule.enabled) {
            return interaction.reply({ content: 'Premium features are disabled.', ephemeral: true });
        }

        // Check if guild has premium
        if (!premiumModule.isPremiumGuild(interaction.guild.id)) {
            return interaction.reply({ 
                content: 'This server does not have premium features enabled.', 
                ephemeral: true 
            });
        }

        try {
            switch (subcommand) {
                case 'status':
                    await this.handleStatus(interaction, premiumModule);
                    break;
                case 'features':
                    await this.handleFeatures(interaction, premiumModule);
                    break;
                case 'starboard':
                    await this.handleStarboard(interaction, premiumModule);
                    break;
                case 'verification':
                    await this.handleVerification(interaction, premiumModule);
                    break;
                case 'suggestions':
                    await this.handleSuggestions(interaction, premiumModule);
                    break;
                case 'sticky':
                    await this.handleSticky(interaction, premiumModule);
                    break;
                case 'tempvoice':
                    await this.handleTempVoice(interaction, premiumModule);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            bot.logger.error('Error in premium command:', error);
            await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
    },

    async handleStatus(interaction, premiumModule) {
        const status = await premiumModule.getPremiumStatus(interaction.guild.id);
        
        if (!status) {
            return interaction.reply({ 
                content: 'This server does not have premium features.', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('👑 Premium Status')
            .setDescription('This server has premium features enabled!')
            .addFields(
                { name: 'Premium', value: '✅ Active', inline: true },
                { name: 'Expires', value: status.expiresAt ? `<t:${Math.floor(new Date(status.expiresAt).getTime() / 1000)}:R>` : 'Never', inline: true }
            )
            .setTimestamp();

        // Add enabled features
        const enabledFeatures = Object.entries(status.features)
            .filter(([_, enabled]) => enabled)
            .map(([feature, _]) => feature);

        if (enabledFeatures.length > 0) {
            embed.addFields({
                name: 'Enabled Features',
                value: enabledFeatures.map(feature => `• ${feature}`).join('\n'),
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    },

    async handleFeatures(interaction, premiumModule) {
        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('👑 Premium Features')
            .setDescription('Here are all the premium features available:')
            .addFields(
                { name: '🎨 Custom Status', value: 'Set custom bot status and activity', inline: true },
                { name: '🚫 Remove Branding', value: 'Remove bot branding from messages', inline: true },
                { name: '🔧 Custom Modules', value: 'Access to beta modules and features', inline: true },
                { name: '✅ Verification', value: 'Advanced verification system', inline: true },
                { name: '😀 Auto React', value: 'Automatic reactions to messages', inline: true },
                { name: '⭐ Starboard', value: 'Starboard for highlighting messages', inline: true },
                { name: '🔊 Temp Voice', value: 'Temporary voice channels', inline: true },
                { name: '📌 Sticky Messages', value: 'Sticky messages in channels', inline: true },
                { name: '😀 Emoji Manager', value: 'Advanced emoji management', inline: true },
                { name: '🎂 Birthdays', value: 'Birthday tracking and notifications', inline: true },
                { name: '💡 Suggestions', value: 'Suggestion system for server improvements', inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleStarboard(interaction, premiumModule) {
        const channel = interaction.options.getChannel('channel');
        const threshold = interaction.options.getInteger('threshold') || 3;

        // Enable starboard feature
        await premiumModule.setFeature(interaction.guild.id, 'starboard', true);

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('⭐ Starboard Configured')
            .setDescription('Starboard has been set up successfully!')
            .addFields(
                { name: 'Channel', value: channel.toString(), inline: true },
                { name: 'Threshold', value: threshold.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleVerification(interaction, premiumModule) {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');

        // Enable verification feature
        await premiumModule.setFeature(interaction.guild.id, 'verification', true);

        // Create verification panel
        await premiumModule.createVerificationPanel(interaction.guild.id, channel.id, role.id);

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('✅ Verification System Setup')
            .setDescription('Verification system has been configured!')
            .addFields(
                { name: 'Channel', value: channel.toString(), inline: true },
                { name: 'Role', value: role.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleSuggestions(interaction, premiumModule) {
        const channel = interaction.options.getChannel('channel');

        // Enable suggestions feature
        await premiumModule.setFeature(interaction.guild.id, 'suggestions', true);

        // Create suggestions panel
        await premiumModule.createSuggestionPanel(interaction.guild.id, channel.id);

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('💡 Suggestions System Setup')
            .setDescription('Suggestions system has been configured!')
            .addFields(
                { name: 'Channel', value: channel.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleSticky(interaction, premiumModule) {
        const action = interaction.options.getString('action');
        const channel = interaction.options.getChannel('channel');
        const content = interaction.options.getString('content');

        if (action === 'set') {
            if (!channel || !content) {
                return interaction.reply({ 
                    content: 'Please provide both channel and content for the sticky message.', 
                    ephemeral: true 
                });
            }

            // Enable sticky messages feature
            await premiumModule.setFeature(interaction.guild.id, 'stickyMessages', true);

            // Store sticky message in database
            await premiumModule.database.execute(
                'INSERT OR REPLACE INTO sticky_messages (channel_id, content) VALUES (?, ?)',
                [channel.id, content]
            );

            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('📌 Sticky Message Set')
                .setDescription('Sticky message has been configured!')
                .addFields(
                    { name: 'Channel', value: channel.toString(), inline: true },
                    { name: 'Content', value: content, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else if (action === 'remove') {
            if (!channel) {
                return interaction.reply({ 
                    content: 'Please provide a channel to remove the sticky message from.', 
                    ephemeral: true 
                });
            }

            // Remove sticky message
            await premiumModule.database.execute(
                'DELETE FROM sticky_messages WHERE channel_id = ?',
                [channel.id]
            );

            const embed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('📌 Sticky Message Removed')
                .setDescription('Sticky message has been removed!')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    },

    async handleTempVoice(interaction, premiumModule) {
        const createChannel = interaction.options.getChannel('create_channel');

        // Enable temp voice feature
        await premiumModule.setFeature(interaction.guild.id, 'tempVoice', true);

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('🔊 Temporary Voice Channels Setup')
            .setDescription('Temporary voice channels have been configured!')
            .addFields(
                { name: 'Create Channel', value: createChannel.toString(), inline: true },
                { name: 'How it works', value: 'Users can join the create channel to automatically get their own temporary voice channel.', inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
