const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Leveling system commands')
        .addSubcommand(subcommand =>
            subcommand.setName('rank')
                .setDescription('View your or another user\'s rank')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to check (leave empty for yourself)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('leaderboard')
                .setDescription('View the server leaderboard')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Number of users to show (1-20)')
                        .setMinValue(1)
                        .setMaxValue(20)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('card')
                .setDescription('Generate a level card')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to generate a card for')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('addrole')
                .setDescription('Add a role reward for a level')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('The level required')
                        .setMinValue(1)
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to give')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('removerole')
                .setDescription('Remove a role reward')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('boost')
                .setDescription('Add an XP booster')
                .addNumberOption(option =>
                    option.setName('multiplier')
                        .setDescription('XP multiplier (1.5, 2.0, etc.)')
                        .setMinValue(1.1)
                        .setMaxValue(10.0)
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Duration in hours')
                        .setMinValue(1)
                        .setMaxValue(168)
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to apply booster to (optional)')
                        .setRequired(false))),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        const levelingModule = bot.getModule('leveling');
        
        if (!levelingModule) {
            return interaction.reply({ content: 'Leveling module is not loaded.', ephemeral: true });
        }

        if (!levelingModule.enabled) {
            return interaction.reply({ content: 'Leveling system is disabled.', ephemeral: true });
        }

        try {
            switch (subcommand) {
                case 'rank':
                    await this.handleRank(interaction, levelingModule);
                    break;
                case 'leaderboard':
                    await this.handleLeaderboard(interaction, levelingModule);
                    break;
                case 'card':
                    await this.handleCard(interaction, levelingModule);
                    break;
                case 'addrole':
                    await this.handleAddRole(interaction, levelingModule);
                    break;
                case 'removerole':
                    await this.handleRemoveRole(interaction, levelingModule);
                    break;
                case 'boost':
                    await this.handleBoost(interaction, levelingModule);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            bot.logger.error('Error in leveling command:', error);
            await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
    },

    async handleRank(interaction, levelingModule) {
        const user = interaction.options.getUser('user') || interaction.user;
        const stats = await levelingModule.getUserStats(interaction.guild.id, user.id);
        
        if (!stats) {
            return interaction.reply({ content: 'User not found in the leveling system.', ephemeral: true });
        }

        const rank = await levelingModule.getUserRank(interaction.guild.id, user.id);
        const xpInLevel = stats.xp % 1000;
        const xpToNext = 1000 - xpInLevel;

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle(`${user.username}'s Level Stats`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'Level', value: stats.level.toString(), inline: true },
                { name: 'Total XP', value: stats.total_xp.toString(), inline: true },
                { name: 'Rank', value: `#${rank}`, inline: true },
                { name: 'XP in Level', value: `${xpInLevel}/1000`, inline: true },
                { name: 'XP to Next Level', value: xpToNext.toString(), inline: true },
                { name: 'Messages', value: stats.messages?.toString() || '0', inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleLeaderboard(interaction, levelingModule) {
        const limit = interaction.options.getInteger('limit') || 10;
        const leaderboard = await levelingModule.getLeaderboard(interaction.guild.id, limit);
        
        if (leaderboard.length === 0) {
            return interaction.reply({ content: 'No users found in the leaderboard.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 Server Leaderboard')
            .setDescription('Top users by total XP');

        let description = '';
        for (let i = 0; i < leaderboard.length; i++) {
            const user = leaderboard[i];
            const member = interaction.guild.members.cache.get(user.id);
            const username = member ? member.user.username : 'Unknown User';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            
            description += `${medal} **${username}** - Level ${user.level} (${user.total_xp} XP)\n`;
        }

        embed.setDescription(description);
        await interaction.reply({ embeds: [embed] });
    },

    async handleCard(interaction, levelingModule) {
        const user = interaction.options.getUser('user') || interaction.user;
        const stats = await levelingModule.getUserStats(interaction.guild.id, user.id);
        
        if (!stats) {
            return interaction.reply({ content: 'User not found in the leveling system.', ephemeral: true });
        }

        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }

        const levelCard = await levelingModule.generateLevelCard(member, stats.level, stats.total_xp);
        
        if (!levelCard) {
            return interaction.reply({ content: 'Failed to generate level card.', ephemeral: true });
        }

        await interaction.reply({ files: [levelCard] });
    },

    async handleAddRole(interaction, levelingModule) {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
        }

        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');

        await levelingModule.addRoleReward(level, role.id);

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('Role Reward Added')
            .setDescription(`Users will now receive the ${role} role when they reach level ${level}.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleRemoveRole(interaction, levelingModule) {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
        }

        const role = interaction.options.getRole('role');

        await levelingModule.removeRoleReward(role.id);

        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setTitle('Role Reward Removed')
            .setDescription(`The ${role} role reward has been removed.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async handleBoost(interaction, levelingModule) {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
        }

        const multiplier = interaction.options.getNumber('multiplier');
        const duration = interaction.options.getInteger('duration');
        const role = interaction.options.getRole('role');

        const durationMs = duration * 60 * 60 * 1000; // Convert hours to milliseconds
        await levelingModule.addXPBooster(multiplier, durationMs, role?.id);

        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('XP Booster Added')
            .setDescription(`Added ${multiplier}x XP booster for ${duration} hours${role ? ` for ${role} role` : ' for all users'}.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
