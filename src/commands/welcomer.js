const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcomer')
        .setDescription('Welcomer system configuration')
        .addSubcommand(subcommand =>
            subcommand.setName('setup')
                .setDescription('Setup the welcomer system')
                .addChannelOption(option =>
                    option.setName('welcome_channel')
                        .setDescription('Channel for welcome messages')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('leave_channel')
                        .setDescription('Channel for leave messages')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('message')
                .setDescription('Set welcome/leave messages')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Message type')
                        .addChoices(
                            { name: 'Welcome', value: 'welcome' },
                            { name: 'Leave', value: 'leave' }
                        )
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Message text (use {user}, {server}, {memberCount} as variables)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('autorole')
                .setDescription('Manage auto roles')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: 'Add', value: 'add' },
                            { name: 'Remove', value: 'remove' },
                            { name: 'List', value: 'list' }
                        )
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to add/remove')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('card')
                .setDescription('Configure welcome card settings')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable/disable welcome cards')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('background')
                        .setDescription('Background color (hex code)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('text_color')
                        .setDescription('Text color (hex code)')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('show_avatar')
                        .setDescription('Show user avatar on card')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('show_level')
                        .setDescription('Show user level on card')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('test')
                .setDescription('Test the welcomer system')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Test type')
                        .addChoices(
                            { name: 'Welcome', value: 'welcome' },
                            { name: 'Leave', value: 'leave' },
                            { name: 'Card', value: 'card' }
                        )
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        const welcomerModule = bot.getModule('welcomer');
        
        if (!welcomerModule) {
            return interaction.reply({ content: 'Welcomer module is not loaded.', ephemeral: true });
        }

        try {
            switch (subcommand) {
                case 'setup':
                    await this.handleSetup(interaction, welcomerModule);
                    break;
                case 'message':
                    await this.handleMessage(interaction, welcomerModule);
                    break;
                case 'autorole':
                    await this.handleAutoRole(interaction, welcomerModule);
                    break;
                case 'card':
                    await this.handleCard(interaction, welcomerModule);
                    break;
                case 'test':
                    await this.handleTest(interaction, welcomerModule);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            bot.logger.error('Error in welcomer command:', error);
            await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
    },

    async handleSetup(interaction, welcomerModule) {
        const welcomeChannel = interaction.options.getChannel('welcome_channel');
        const leaveChannel = interaction.options.getChannel('leave_channel');

        await welcomerModule.setWelcomeChannel(welcomeChannel.id);
        if (leaveChannel) {
            await welcomerModule.setLeaveChannel(leaveChannel.id);
        }

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('Welcomer System Setup')
            .setDescription('Welcomer system has been configured successfully!')
            .addFields(
                { name: 'Welcome Channel', value: welcomeChannel.toString(), inline: true },
                { name: 'Leave Channel', value: leaveChannel ? leaveChannel.toString() : 'Same as welcome', inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleMessage(interaction, welcomerModule) {
        const type = interaction.options.getString('type');
        const text = interaction.options.getString('text');

        if (type === 'welcome') {
            await welcomerModule.setWelcomeMessage(text);
        } else {
            await welcomerModule.setLeaveMessage(text);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)} Message Updated`)
            .setDescription(`**New message:**\n${text}`)
            .addFields(
                { name: 'Available Variables', value: '`{user}` - User mention\n`{username}` - Username\n`{server}` - Server name\n`{memberCount}` - Member count\n`{mention}` - User mention', inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleAutoRole(interaction, welcomerModule) {
        const action = interaction.options.getString('action');
        const role = interaction.options.getRole('role');

        switch (action) {
            case 'add':
                if (!role) {
                    return interaction.reply({ content: 'Please specify a role to add.', ephemeral: true });
                }
                
                await welcomerModule.addAutoRole(role.id);
                
                const addEmbed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('Auto Role Added')
                    .setDescription(`New members will now automatically receive the ${role} role.`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [addEmbed] });
                break;

            case 'remove':
                if (!role) {
                    return interaction.reply({ content: 'Please specify a role to remove.', ephemeral: true });
                }
                
                await welcomerModule.removeAutoRole(role.id);
                
                const removeEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle('Auto Role Removed')
                    .setDescription(`The ${role} role has been removed from auto-assignment.`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [removeEmbed] });
                break;

            case 'list':
                const autoRoles = welcomerModule.autoRoles;
                
                if (autoRoles.length === 0) {
                    return interaction.reply({ content: 'No auto roles are currently configured.', ephemeral: true });
                }

                const roleList = autoRoles.map(roleId => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    return role ? role.toString() : `Unknown Role (${roleId})`;
                }).join('\n');

                const listEmbed = new EmbedBuilder()
                    .setColor('#5865f2')
                    .setTitle('Auto Roles')
                    .setDescription(roleList)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [listEmbed] });
                break;
        }
    },

    async handleCard(interaction, welcomerModule) {
        const enabled = interaction.options.getBoolean('enabled');
        const background = interaction.options.getString('background');
        const textColor = interaction.options.getString('text_color');
        const showAvatar = interaction.options.getBoolean('show_avatar');
        const showLevel = interaction.options.getBoolean('show_level');

        const settings = {};
        if (enabled !== null) settings.enabled = enabled;
        if (background) settings.background = background;
        if (textColor) settings.textColor = textColor;
        if (showAvatar !== null) settings.showAvatar = showAvatar;
        if (showLevel !== null) settings.showLevel = showLevel;

        if (Object.keys(settings).length > 0) {
            await welcomerModule.updateWelcomeCard(settings);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('Welcome Card Settings Updated')
            .setDescription('Welcome card configuration has been updated.')
            .addFields(
                { name: 'Enabled', value: welcomerModule.welcomeCard.enabled ? 'Yes' : 'No', inline: true },
                { name: 'Background', value: welcomerModule.welcomeCard.background, inline: true },
                { name: 'Text Color', value: welcomerModule.welcomeCard.textColor, inline: true },
                { name: 'Show Avatar', value: welcomerModule.welcomeCard.showAvatar ? 'Yes' : 'No', inline: true },
                { name: 'Show Level', value: welcomerModule.welcomeCard.showLevel ? 'Yes' : 'No', inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleTest(interaction, welcomerModule) {
        const type = interaction.options.getString('type');

        if (type === 'welcome') {
            const welcomeCard = await welcomerModule.generateWelcomeCard(interaction.member);
            if (welcomeCard) {
                await interaction.reply({ 
                    content: '**Welcome Message Test:**\n' + welcomerModule.formatMessage(welcomerModule.welcomeMessage, interaction.member),
                    files: [welcomeCard]
                });
            } else {
                await interaction.reply({ 
                    content: '**Welcome Message Test:**\n' + welcomerModule.formatMessage(welcomerModule.welcomeMessage, interaction.member)
                });
            }
        } else if (type === 'leave') {
            await interaction.reply({ 
                content: '**Leave Message Test:**\n' + welcomerModule.formatMessage(welcomerModule.leaveMessage, interaction.member)
            });
        } else if (type === 'card') {
            const welcomeCard = await welcomerModule.generateWelcomeCard(interaction.member);
            if (welcomeCard) {
                await interaction.reply({ files: [welcomeCard] });
            } else {
                await interaction.reply({ content: 'Failed to generate welcome card.', ephemeral: true });
            }
        }
    }
};
