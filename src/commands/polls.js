const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create and manage polls')
        .addSubcommand(subcommand =>
            subcommand.setName('create')
                .setDescription('Create a new poll')
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('The poll question')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('options')
                        .setDescription('Poll options separated by | (e.g., Option 1|Option 2|Option 3)')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Duration in hours (optional)')
                        .setMinValue(1)
                        .setMaxValue(168)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('end')
                .setDescription('End a poll')
                .addStringOption(option =>
                    option.setName('poll_id')
                        .setDescription('The poll ID to end')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('results')
                .setDescription('View poll results')
                .addStringOption(option =>
                    option.setName('poll_id')
                        .setDescription('The poll ID to view results for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('settings')
                .setDescription('Configure poll settings')
                .addIntegerOption(option =>
                    option.setName('default_duration')
                        .setDescription('Default duration in hours')
                        .setMinValue(1)
                        .setMaxValue(168)
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('allow_multiple')
                        .setDescription('Allow multiple votes per user')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('require_role')
                        .setDescription('Role required to vote')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        const pollsModule = bot.getModule('polls');
        
        if (!pollsModule) {
            return interaction.reply({ content: 'Polls module is not loaded.', ephemeral: true });
        }

        if (!pollsModule.enabled) {
            return interaction.reply({ content: 'Poll system is disabled.', ephemeral: true });
        }

        try {
            switch (subcommand) {
                case 'create':
                    await this.handleCreate(interaction, pollsModule);
                    break;
                case 'end':
                    await this.handleEnd(interaction, pollsModule);
                    break;
                case 'results':
                    await this.handleResults(interaction, pollsModule);
                    break;
                case 'settings':
                    await this.handleSettings(interaction, pollsModule);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            bot.logger.error('Error in polls command:', error);
            await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
    },

    async handleCreate(interaction, pollsModule) {
        const question = interaction.options.getString('question');
        const optionsString = interaction.options.getString('options');
        const duration = interaction.options.getInteger('duration');

        // Parse options
        const options = optionsString.split('|').map(option => option.trim()).filter(option => option.length > 0);
        
        if (options.length < 2) {
            return interaction.reply({ 
                content: 'You must provide at least 2 options for the poll.', 
                ephemeral: true 
            });
        }

        if (options.length > 25) {
            return interaction.reply({ 
                content: 'You can have at most 25 options for a poll.', 
                ephemeral: true 
            });
        }

        await pollsModule.createPoll(interaction, question, options, duration);
    },

    async handleEnd(interaction, pollsModule) {
        const pollId = interaction.options.getString('poll_id');

        const poll = await pollsModule.database.getPoll(pollId);
        if (!poll) {
            return interaction.reply({ 
                content: 'Poll not found.', 
                ephemeral: true 
            });
        }

        await pollsModule.endPoll(pollId);

        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setTitle('Poll Ended')
            .setDescription(`Poll "${poll.question}" has been ended.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleResults(interaction, pollsModule) {
        const pollId = interaction.options.getString('poll_id');

        const stats = await pollsModule.getPollStats(pollId);
        if (!stats) {
            return interaction.reply({ 
                content: 'Poll not found or no results available.', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('📊 Poll Results')
            .setDescription(stats.question)
            .setTimestamp();

        const totalVotes = stats.totalVotes;
        
        Object.entries(stats.votes).forEach(([option, count]) => {
            const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
            
            embed.addFields({
                name: option,
                value: `${bar} ${count} votes (${percentage}%)`,
                inline: false
            });
        });

        embed.addFields({
            name: 'Total Votes',
            value: totalVotes.toString(),
            inline: true
        });

        if (stats.expiresAt) {
            embed.addFields({
                name: 'Expires',
                value: `<t:${Math.floor(new Date(stats.expiresAt).getTime() / 1000)}:R>`,
                inline: true
            });
        }

        await interaction.reply({ embeds: [embed] });
    },

    async handleSettings(interaction, pollsModule) {
        const defaultDuration = interaction.options.getInteger('default_duration');
        const allowMultiple = interaction.options.getBoolean('allow_multiple');
        const requireRole = interaction.options.getRole('require_role');

        let updated = false;

        if (defaultDuration !== null) {
            await pollsModule.setDefaultDuration(defaultDuration);
            updated = true;
        }

        if (allowMultiple !== null) {
            await pollsModule.setAllowMultiple(allowMultiple);
            updated = true;
        }

        if (requireRole !== null) {
            await pollsModule.setRequireRole(requireRole.id);
            updated = true;
        }

        if (!updated) {
            // Show current settings
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('Poll Settings')
                .addFields(
                    { name: 'Default Duration', value: `${pollsModule.defaultDuration} hours`, inline: true },
                    { name: 'Allow Multiple Votes', value: pollsModule.allowMultiple ? 'Yes' : 'No', inline: true },
                    { name: 'Required Role', value: pollsModule.requireRole ? `<@&${pollsModule.requireRole}>` : 'None', inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('Settings Updated')
                .setDescription('Poll settings have been updated successfully.')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};
