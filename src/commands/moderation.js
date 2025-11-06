const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderation')
        .setDescription('Moderation commands')
        .addSubcommand(subcommand =>
            subcommand.setName('kick')
                .setDescription('Kick a member from the server')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to kick')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the kick')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('ban')
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
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('mute')
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
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('unmute')
                .setDescription('Unmute a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to unmute')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('clear')
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
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('warn')
                .setDescription('Warn a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to warn')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the warning')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('warnings')
                .setDescription('View warnings for a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to check warnings for')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        const moderationModule = bot.getModule('moderation');
        
        if (!moderationModule) {
            return interaction.reply({ content: 'Moderation module is not loaded.', ephemeral: true });
        }

        // Delegate to the moderation module
        const command = moderationModule.commands.find(cmd => 
            cmd.data.name === subcommand || 
            (cmd.data.options && cmd.data.options.some(opt => opt.name === subcommand))
        );

        if (command) {
            await command.execute(interaction);
        } else {
            await interaction.reply({ content: 'Command not found.', ephemeral: true });
        }
    }
};
