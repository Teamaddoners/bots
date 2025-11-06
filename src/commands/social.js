const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('social')
        .setDescription('Social media notification management')
        .addSubcommand(subcommand =>
            subcommand.setName('youtube')
                .setDescription('Configure YouTube notifications')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: 'Setup', value: 'setup' },
                            { name: 'Remove', value: 'remove' },
                            { name: 'Status', value: 'status' }
                        )
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('channel_id')
                        .setDescription('YouTube channel ID')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('webhook_url')
                        .setDescription('Webhook URL for notifications')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('twitter')
                .setDescription('Configure Twitter notifications')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: 'Add Account', value: 'add' },
                            { name: 'Remove Account', value: 'remove' },
                            { name: 'List Accounts', value: 'list' }
                        )
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('account')
                        .setDescription('Twitter account name')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('twitch')
                .setDescription('Configure Twitch notifications')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: 'Add Streamer', value: 'add' },
                            { name: 'Remove Streamer', value: 'remove' },
                            { name: 'List Streamers', value: 'list' }
                        )
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('streamer')
                        .setDescription('Twitch streamer name')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('reddit')
                .setDescription('Configure Reddit notifications')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: 'Add Subreddit', value: 'add' },
                            { name: 'Remove Subreddit', value: 'remove' },
                            { name: 'List Subreddits', value: 'list' }
                        )
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('subreddit')
                        .setDescription('Subreddit name')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('notifications')
                .setDescription('Manage notification channels')
                .addStringOption(option =>
                    option.setName('platform')
                        .setDescription('Social media platform')
                        .addChoices(
                            { name: 'YouTube', value: 'youtube' },
                            { name: 'Twitter', value: 'twitter' },
                            { name: 'Twitch', value: 'twitch' },
                            { name: 'Reddit', value: 'reddit' }
                        )
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: 'Add Channel', value: 'add' },
                            { name: 'Remove Channel', value: 'remove' },
                            { name: 'List Channels', value: 'list' }
                        )
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for notifications')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        const socialModule = bot.getModule('social');
        
        if (!socialModule) {
            return interaction.reply({ content: 'Social module is not loaded.', ephemeral: true });
        }

        if (!socialModule.enabled) {
            return interaction.reply({ content: 'Social media notifications are disabled.', ephemeral: true });
        }

        try {
            switch (subcommand) {
                case 'youtube':
                    await this.handleYouTube(interaction, socialModule);
                    break;
                case 'twitter':
                    await this.handleTwitter(interaction, socialModule);
                    break;
                case 'twitch':
                    await this.handleTwitch(interaction, socialModule);
                    break;
                case 'reddit':
                    await this.handleReddit(interaction, socialModule);
                    break;
                case 'notifications':
                    await this.handleNotifications(interaction, socialModule);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            bot.logger.error('Error in social command:', error);
            await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
    },

    async handleYouTube(interaction, socialModule) {
        const action = interaction.options.getString('action');
        const channelId = interaction.options.getString('channel_id');
        const webhookUrl = interaction.options.getString('webhook_url');

        switch (action) {
            case 'setup':
                if (!channelId) {
                    return interaction.reply({ 
                        content: 'Please provide a YouTube channel ID.', 
                        ephemeral: true 
                    });
                }

                await socialModule.setYouTubeChannel(channelId);
                if (webhookUrl) {
                    await socialModule.setYouTubeWebhook(webhookUrl);
                }

                const setupEmbed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('YouTube Notifications Setup')
                    .setDescription('YouTube notifications have been configured successfully!')
                    .addFields(
                        { name: 'Channel ID', value: channelId, inline: true },
                        { name: 'Webhook', value: webhookUrl || 'Not configured', inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [setupEmbed] });
                break;

            case 'remove':
                await socialModule.setYouTubeChannel(null);
                await socialModule.setYouTubeWebhook(null);

                const removeEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle('YouTube Notifications Removed')
                    .setDescription('YouTube notifications have been disabled.')
                    .setTimestamp();

                await interaction.reply({ embeds: [removeEmbed] });
                break;

            case 'status':
                const statusEmbed = new EmbedBuilder()
                    .setColor('#5865f2')
                    .setTitle('YouTube Notifications Status')
                    .addFields(
                        { name: 'Enabled', value: socialModule.platforms.youtube.enabled ? 'Yes' : 'No', inline: true },
                        { name: 'Channel ID', value: socialModule.platforms.youtube.channel || 'Not set', inline: true },
                        { name: 'Webhook', value: socialModule.platforms.youtube.webhook || 'Not set', inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [statusEmbed] });
                break;
        }
    },

    async handleTwitter(interaction, socialModule) {
        const action = interaction.options.getString('action');
        const account = interaction.options.getString('account');

        switch (action) {
            case 'add':
                if (!account) {
                    return interaction.reply({ 
                        content: 'Please provide a Twitter account name.', 
                        ephemeral: true 
                    });
                }

                await socialModule.addTwitterAccount(account);

                const addEmbed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('Twitter Account Added')
                    .setDescription(`Added @${account} to Twitter monitoring.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [addEmbed] });
                break;

            case 'remove':
                if (!account) {
                    return interaction.reply({ 
                        content: 'Please provide a Twitter account name to remove.', 
                        ephemeral: true 
                    });
                }

                await socialModule.removeTwitterAccount(account);

                const removeEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle('Twitter Account Removed')
                    .setDescription(`Removed @${account} from Twitter monitoring.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [removeEmbed] });
                break;

            case 'list':
                const accounts = socialModule.platforms.twitter.accounts;
                
                if (accounts.length === 0) {
                    return interaction.reply({ 
                        content: 'No Twitter accounts are being monitored.', 
                        ephemeral: true 
                    });
                }

                const listEmbed = new EmbedBuilder()
                    .setColor('#5865f2')
                    .setTitle('Monitored Twitter Accounts')
                    .setDescription(accounts.map(account => `@${account}`).join('\n'))
                    .setTimestamp();

                await interaction.reply({ embeds: [listEmbed] });
                break;
        }
    },

    async handleTwitch(interaction, socialModule) {
        const action = interaction.options.getString('action');
        const streamer = interaction.options.getString('streamer');

        switch (action) {
            case 'add':
                if (!streamer) {
                    return interaction.reply({ 
                        content: 'Please provide a Twitch streamer name.', 
                        ephemeral: true 
                    });
                }

                await socialModule.addTwitchStreamer(streamer);

                const addEmbed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('Twitch Streamer Added')
                    .setDescription(`Added ${streamer} to Twitch monitoring.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [addEmbed] });
                break;

            case 'remove':
                if (!streamer) {
                    return interaction.reply({ 
                        content: 'Please provide a Twitch streamer name to remove.', 
                        ephemeral: true 
                    });
                }

                await socialModule.removeTwitchStreamer(streamer);

                const removeEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle('Twitch Streamer Removed')
                    .setDescription(`Removed ${streamer} from Twitch monitoring.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [removeEmbed] });
                break;

            case 'list':
                const streamers = socialModule.platforms.twitch.streamers;
                
                if (streamers.length === 0) {
                    return interaction.reply({ 
                        content: 'No Twitch streamers are being monitored.', 
                        ephemeral: true 
                    });
                }

                const listEmbed = new EmbedBuilder()
                    .setColor('#5865f2')
                    .setTitle('Monitored Twitch Streamers')
                    .setDescription(streamers.map(streamer => streamer).join('\n'))
                    .setTimestamp();

                await interaction.reply({ embeds: [listEmbed] });
                break;
        }
    },

    async handleReddit(interaction, socialModule) {
        const action = interaction.options.getString('action');
        const subreddit = interaction.options.getString('subreddit');

        switch (action) {
            case 'add':
                if (!subreddit) {
                    return interaction.reply({ 
                        content: 'Please provide a subreddit name.', 
                        ephemeral: true 
                    });
                }

                await socialModule.addRedditSubreddit(subreddit);

                const addEmbed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('Subreddit Added')
                    .setDescription(`Added r/${subreddit} to Reddit monitoring.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [addEmbed] });
                break;

            case 'remove':
                if (!subreddit) {
                    return interaction.reply({ 
                        content: 'Please provide a subreddit name to remove.', 
                        ephemeral: true 
                    });
                }

                await socialModule.removeRedditSubreddit(subreddit);

                const removeEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle('Subreddit Removed')
                    .setDescription(`Removed r/${subreddit} from Reddit monitoring.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [removeEmbed] });
                break;

            case 'list':
                const subreddits = socialModule.platforms.reddit.subreddits;
                
                if (subreddits.length === 0) {
                    return interaction.reply({ 
                        content: 'No subreddits are being monitored.', 
                        ephemeral: true 
                    });
                }

                const listEmbed = new EmbedBuilder()
                    .setColor('#5865f2')
                    .setTitle('Monitored Subreddits')
                    .setDescription(subreddits.map(subreddit => `r/${subreddit}`).join('\n'))
                    .setTimestamp();

                await interaction.reply({ embeds: [listEmbed] });
                break;
        }
    },

    async handleNotifications(interaction, socialModule) {
        const platform = interaction.options.getString('platform');
        const action = interaction.options.getString('action');
        const channel = interaction.options.getChannel('channel');

        switch (action) {
            case 'add':
                if (!channel) {
                    return interaction.reply({ 
                        content: 'Please select a channel for notifications.', 
                        ephemeral: true 
                    });
                }

                await socialModule.addNotification(interaction.guild.id, platform, channel.id);

                const addEmbed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('Notification Channel Added')
                    .setDescription(`Added ${channel} for ${platform} notifications.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [addEmbed] });
                break;

            case 'remove':
                await socialModule.removeNotification(interaction.guild.id, platform);

                const removeEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle('Notification Channel Removed')
                    .setDescription(`Removed ${platform} notifications.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [removeEmbed] });
                break;

            case 'list':
                const notifications = await socialModule.getNotifications(interaction.guild.id);
                const platformNotifications = notifications.filter(n => n.platform === platform);
                
                if (platformNotifications.length === 0) {
                    return interaction.reply({ 
                        content: `No ${platform} notification channels configured.`, 
                        ephemeral: true 
                    });
                }

                const listEmbed = new EmbedBuilder()
                    .setColor('#5865f2')
                    .setTitle(`${platform} Notification Channels`)
                    .setDescription(platformNotifications.map(n => `<#${n.channel_id}>`).join('\n'))
                    .setTimestamp();

                await interaction.reply({ embeds: [listEmbed] });
                break;
        }
    }
};
