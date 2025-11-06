const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

class PollsModule {
    constructor() {
        this.name = 'polls';
        this.enabled = false;
        this.defaultDuration = 24;
        this.allowMultiple = false;
        this.requireRole = null;
        this.activePolls = new Map();
    }

    init(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.database = bot.database;
        this.logger = bot.logger;
        
        this.loadConfig();
        this.setupEventHandlers();
        this.setupPollCleanup();
    }

    loadConfig() {
        const pollsConfig = this.config.get('modules.polls');
        if (pollsConfig) {
            this.enabled = pollsConfig.enabled || false;
            this.defaultDuration = pollsConfig.defaultDuration || 24;
            this.allowMultiple = pollsConfig.allowMultiple || false;
            this.requireRole = pollsConfig.requireRole;
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupEventHandlers() {
        this.bot.client.on('interactionCreate', this.handleInteraction.bind(this));
    }

    setupPollCleanup() {
        // Check for expired polls every minute
        setInterval(async () => {
            await this.checkExpiredPolls();
        }, 60000);
    }

    async handleInteraction(interaction) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        try {
            if (interaction.customId.startsWith('poll_')) {
                await this.handlePollInteraction(interaction);
            }
        } catch (error) {
            this.logger.error('Error handling poll interaction:', error);
        }
    }

    async handlePollInteraction(interaction) {
        const action = interaction.customId.split('_')[1];
        const pollId = interaction.customId.split('_')[2];

        if (action === 'vote') {
            await this.handleVote(interaction, pollId);
        } else if (action === 'results') {
            await this.handleResults(interaction, pollId);
        } else if (action === 'end') {
            await this.handleEndPoll(interaction, pollId);
        }
    }

    async handleVote(interaction, pollId) {
        try {
            const poll = await this.database.getPoll(pollId);
            if (!poll) {
                return interaction.reply({ 
                    content: 'Poll not found.', 
                    ephemeral: true 
                });
            }

            // Check if poll is expired
            if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
                return interaction.reply({ 
                    content: 'This poll has expired.', 
                    ephemeral: true 
                });
            }

            // Check role requirement
            if (this.requireRole && !interaction.member.roles.cache.has(this.requireRole)) {
                return interaction.reply({ 
                    content: 'You do not have the required role to vote.', 
                    ephemeral: true 
                });
            }

            const votes = JSON.parse(poll.votes);
            const userId = interaction.user.id;

            // Check if user already voted
            if (!this.allowMultiple && votes[userId]) {
                return interaction.reply({ 
                    content: 'You have already voted in this poll.', 
                    ephemeral: true 
                });
            }

            // Get selected option
            let selectedOption;
            if (interaction.isButton()) {
                selectedOption = interaction.customId.split('_')[3];
            } else if (interaction.isStringSelectMenu()) {
                selectedOption = interaction.values[0];
            }

            // Update votes
            votes[userId] = selectedOption;
            await this.database.updatePollVotes(pollId, votes);

            await interaction.reply({ 
                content: 'Your vote has been recorded!', 
                ephemeral: true 
            });

            this.logger.info(`User ${interaction.user.tag} voted in poll ${pollId}`);
        } catch (error) {
            this.logger.error('Error handling vote:', error);
            await interaction.reply({ 
                content: 'An error occurred while recording your vote.', 
                ephemeral: true 
            });
        }
    }

    async handleResults(interaction, pollId) {
        try {
            const poll = await this.database.getPoll(pollId);
            if (!poll) {
                return interaction.reply({ 
                    content: 'Poll not found.', 
                    ephemeral: true 
                });
            }

            const votes = JSON.parse(poll.votes);
            const options = JSON.parse(poll.options);
            
            // Count votes
            const voteCounts = {};
            options.forEach(option => {
                voteCounts[option] = 0;
            });

            Object.values(votes).forEach(vote => {
                if (voteCounts.hasOwnProperty(vote)) {
                    voteCounts[vote]++;
                }
            });

            // Create results embed
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('📊 Poll Results')
                .setDescription(poll.question)
                .setTimestamp();

            const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);
            
            options.forEach(option => {
                const count = voteCounts[option] || 0;
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

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            this.logger.error('Error showing results:', error);
            await interaction.reply({ 
                content: 'An error occurred while showing results.', 
                ephemeral: true 
            });
        }
    }

    async handleEndPoll(interaction, pollId) {
        try {
            const poll = await this.database.getPoll(pollId);
            if (!poll) {
                return interaction.reply({ 
                    content: 'Poll not found.', 
                    ephemeral: true 
                });
            }

            // Check permissions
            if (!interaction.member.permissions.has('ManageMessages')) {
                return interaction.reply({ 
                    content: 'You do not have permission to end this poll.', 
                    ephemeral: true 
                });
            }

            // End the poll
            await this.endPoll(pollId);

            await interaction.reply({ 
                content: 'Poll has been ended.', 
                ephemeral: true 
            });

            this.logger.info(`Poll ${pollId} ended by ${interaction.user.tag}`);
        } catch (error) {
            this.logger.error('Error ending poll:', error);
            await interaction.reply({ 
                content: 'An error occurred while ending the poll.', 
                ephemeral: true 
            });
        }
    }

    async createPoll(interaction, question, options, duration = null) {
        try {
            const pollId = Date.now().toString();
            const expiresAt = duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : null;

            // Create poll in database
            await this.database.createPoll(
                interaction.guild.id,
                interaction.channel.id,
                pollId,
                question,
                options,
                expiresAt
            );

            // Create poll embed
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('📊 Poll')
                .setDescription(question)
                .setFooter({ text: `Poll ID: ${pollId}` })
                .setTimestamp();

            if (expiresAt) {
                embed.addFields({
                    name: 'Expires',
                    value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
                    inline: true
                });
            }

            // Create components
            const components = [];

            if (options.length <= 5) {
                // Use buttons for 5 or fewer options
                const row = new ActionRowBuilder();
                options.forEach((option, index) => {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`poll_vote_${pollId}_${option}`)
                            .setLabel(option)
                            .setStyle(ButtonStyle.Secondary)
                    );
                });
                components.push(row);
            } else {
                // Use select menu for more than 5 options
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`poll_vote_${pollId}`)
                    .setPlaceholder('Select an option')
                    .addOptions(options.map(option => ({
                        label: option,
                        value: option
                    })));

                const row = new ActionRowBuilder().addComponents(selectMenu);
                components.push(row);
            }

            // Add control buttons
            const controlRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll_results_${pollId}`)
                        .setLabel('Results')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setCustomId(`poll_end_${pollId}`)
                        .setLabel('End Poll')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            components.push(controlRow);

            const message = await interaction.reply({ 
                embeds: [embed], 
                components: components,
                fetchReply: true
            });

            // Store poll info
            this.activePolls.set(pollId, {
                messageId: message.id,
                channelId: interaction.channel.id,
                expiresAt
            });

            this.logger.info(`Poll created: ${question} in ${interaction.channel.name}`);
        } catch (error) {
            this.logger.error('Error creating poll:', error);
            await interaction.reply({ 
                content: 'An error occurred while creating the poll.', 
                ephemeral: true 
            });
        }
    }

    async endPoll(pollId) {
        try {
            const poll = await this.database.getPoll(pollId);
            if (!poll) return;

            // Update poll status
            await this.database.execute(
                'UPDATE polls SET expires_at = CURRENT_TIMESTAMP WHERE message_id = ?',
                [pollId]
            );

            // Remove from active polls
            this.activePolls.delete(pollId);

            // Update the poll message
            const channel = this.bot.client.channels.cache.get(poll.channel_id);
            if (channel) {
                try {
                    const message = await channel.messages.fetch(poll.message_id);
                    const embed = message.embeds[0];
                    embed.setColor('#ff4757');
                    embed.setTitle('🔒 Poll Ended');
                    embed.setFooter({ text: `Poll ID: ${pollId} - Ended` });

                    await message.edit({ 
                        embeds: [embed], 
                        components: [] 
                    });
                } catch (error) {
                    this.logger.error('Error updating poll message:', error);
                }
            }

            this.logger.info(`Poll ${pollId} ended`);
        } catch (error) {
            this.logger.error('Error ending poll:', error);
        }
    }

    async checkExpiredPolls() {
        try {
            const now = new Date();
            const expiredPolls = [];

            for (const [pollId, pollInfo] of this.activePolls) {
                if (pollInfo.expiresAt && pollInfo.expiresAt < now) {
                    expiredPolls.push(pollId);
                }
            }

            for (const pollId of expiredPolls) {
                await this.endPoll(pollId);
            }
        } catch (error) {
            this.logger.error('Error checking expired polls:', error);
        }
    }

    async getPollStats(pollId) {
        try {
            const poll = await this.database.getPoll(pollId);
            if (!poll) return null;

            const votes = JSON.parse(poll.votes);
            const options = JSON.parse(poll.options);
            
            const voteCounts = {};
            options.forEach(option => {
                voteCounts[option] = 0;
            });

            Object.values(votes).forEach(vote => {
                if (voteCounts.hasOwnProperty(vote)) {
                    voteCounts[vote]++;
                }
            });

            return {
                question: poll.question,
                options: options,
                votes: voteCounts,
                totalVotes: Object.values(voteCounts).reduce((sum, count) => sum + count, 0),
                createdAt: poll.created_at,
                expiresAt: poll.expires_at
            };
        } catch (error) {
            this.logger.error('Error getting poll stats:', error);
            return null;
        }
    }

    async setDefaultDuration(hours) {
        this.defaultDuration = hours;
        this.config.set('modules.polls.defaultDuration', hours);
    }

    async setAllowMultiple(allow) {
        this.allowMultiple = allow;
        this.config.set('modules.polls.allowMultiple', allow);
    }

    async setRequireRole(roleId) {
        this.requireRole = roleId;
        this.config.set('modules.polls.requireRole', roleId);
    }
}

module.exports = PollsModule;
