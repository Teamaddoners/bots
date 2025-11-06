const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Ticket system management')
        .addSubcommand(subcommand =>
            subcommand.setName('panel')
                .setDescription('Create a ticket panel')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Panel title')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Panel description')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Ticket category')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('setup')
                .setDescription('Setup the ticket system')
                .addChannelOption(option =>
                    option.setName('transcript_channel')
                        .setDescription('Channel for ticket transcripts')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('autoclose')
                .setDescription('Configure auto-close settings')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable/disable auto-close')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('hours')
                        .setDescription('Hours before auto-close')
                        .setMinValue(1)
                        .setMaxValue(168)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('stats')
                .setDescription('View ticket statistics'))
        .addSubcommand(subcommand =>
            subcommand.setName('close')
                .setDescription('Close the current ticket'))
        .addSubcommand(subcommand =>
            subcommand.setName('reopen')
                .setDescription('Reopen the current ticket'))
        .addSubcommand(subcommand =>
            subcommand.setName('delete')
                .setDescription('Delete the current ticket'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        const ticketsModule = bot.getModule('tickets');
        
        if (!ticketsModule) {
            return interaction.reply({ content: 'Tickets module is not loaded.', ephemeral: true });
        }

        if (!ticketsModule.enabled) {
            return interaction.reply({ content: 'Ticket system is disabled.', ephemeral: true });
        }

        try {
            switch (subcommand) {
                case 'panel':
                    await this.handlePanel(interaction, ticketsModule);
                    break;
                case 'setup':
                    await this.handleSetup(interaction, ticketsModule);
                    break;
                case 'autoclose':
                    await this.handleAutoClose(interaction, ticketsModule);
                    break;
                case 'stats':
                    await this.handleStats(interaction, ticketsModule);
                    break;
                case 'close':
                    await this.handleClose(interaction, ticketsModule);
                    break;
                case 'reopen':
                    await this.handleReopen(interaction, ticketsModule);
                    break;
                case 'delete':
                    await this.handleDelete(interaction, ticketsModule);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            bot.logger.error('Error in tickets command:', error);
            await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
    },

    async handlePanel(interaction, ticketsModule) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const category = interaction.options.getString('category');

        await ticketsModule.createPanel(interaction, title, description, category);
    },

    async handleSetup(interaction, ticketsModule) {
        const transcriptChannel = interaction.options.getChannel('transcript_channel');

        await ticketsModule.setTranscriptChannel(transcriptChannel.id);

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('Ticket System Setup')
            .setDescription('Ticket system has been configured successfully!')
            .addFields(
                { name: 'Transcript Channel', value: transcriptChannel.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleAutoClose(interaction, ticketsModule) {
        const enabled = interaction.options.getBoolean('enabled');
        const hours = interaction.options.getInteger('hours') || 24;

        await ticketsModule.setAutoClose(enabled, hours);

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('Auto-Close Settings Updated')
            .setDescription('Ticket auto-close settings have been updated.')
            .addFields(
                { name: 'Auto-Close', value: enabled ? 'Enabled' : 'Disabled', inline: true },
                { name: 'Hours', value: hours.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleStats(interaction, ticketsModule) {
        try {
            const totalTickets = await ticketsModule.database.query(
                'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?',
                [interaction.guild.id]
            );

            const openTickets = await ticketsModule.database.query(
                'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = "open"',
                [interaction.guild.id]
            );

            const closedTickets = await ticketsModule.database.query(
                'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = "closed"',
                [interaction.guild.id]
            );

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('Ticket Statistics')
                .addFields(
                    { name: 'Total Tickets', value: totalTickets[0].count.toString(), inline: true },
                    { name: 'Open Tickets', value: openTickets[0].count.toString(), inline: true },
                    { name: 'Closed Tickets', value: closedTickets[0].count.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({ content: 'An error occurred while fetching statistics.', ephemeral: true });
        }
    },

    async handleClose(interaction, ticketsModule) {
        const ticket = await ticketsModule.database.getTicket(interaction.channel.id);
        if (!ticket) {
            return interaction.reply({ content: 'This is not a valid ticket channel.', ephemeral: true });
        }

        if (ticket.status !== 'open') {
            return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
        }

        // Generate transcript
        const transcript = await ticketsModule.generateTranscript(interaction.channel);
        
        // Update ticket status
        await ticketsModule.database.closeTicket(interaction.channel.id, transcript);

        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setTitle('🔒 Ticket Closed')
            .setDescription('This ticket has been closed.')
            .addFields(
                { name: 'Closed By', value: interaction.user.toString(), inline: true },
                { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleReopen(interaction, ticketsModule) {
        const ticket = await ticketsModule.database.getTicket(interaction.channel.id);
        if (!ticket) {
            return interaction.reply({ content: 'This is not a valid ticket channel.', ephemeral: true });
        }

        if (ticket.status !== 'closed') {
            return interaction.reply({ content: 'This ticket is not closed.', ephemeral: true });
        }

        // Update ticket status
        await ticketsModule.database.execute(
            'UPDATE tickets SET status = "open", closed_at = NULL WHERE channel_id = ?',
            [interaction.channel.id]
        );

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('🔓 Ticket Reopened')
            .setDescription('This ticket has been reopened.')
            .addFields(
                { name: 'Reopened By', value: interaction.user.toString(), inline: true },
                { name: 'Reopened At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleDelete(interaction, ticketsModule) {
        const ticket = await ticketsModule.database.getTicket(interaction.channel.id);
        if (!ticket) {
            return interaction.reply({ content: 'This is not a valid ticket channel.', ephemeral: true });
        }

        // Delete the channel
        await interaction.channel.delete();
    }
};
