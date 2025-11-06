const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

class TicketsModule {
    constructor() {
        this.name = 'tickets';
        this.enabled = false;
        this.panels = [];
        this.transcriptChannel = null;
        this.autoClose = {
            enabled: false,
            time: 24
        };
        this.ticketCounters = new Map();
    }

    init(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.database = bot.database;
        this.logger = bot.logger;
        
        this.loadConfig();
        this.setupEventHandlers();
        this.setupAutoClose();
    }

    loadConfig() {
        const ticketsConfig = this.config.get('modules.tickets');
        if (ticketsConfig) {
            this.enabled = ticketsConfig.enabled || false;
            this.panels = ticketsConfig.panels || [];
            this.transcriptChannel = ticketsConfig.transcriptChannel;
            this.autoClose = ticketsConfig.autoClose || { enabled: false, time: 24 };
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupEventHandlers() {
        this.bot.client.on('interactionCreate', this.handleInteraction.bind(this));
        this.bot.client.on('channelDelete', this.handleChannelDelete.bind(this));
    }

    setupAutoClose() {
        if (this.autoClose.enabled) {
            setInterval(async () => {
                await this.checkAutoClose();
            }, 60000); // Check every minute
        }
    }

    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        try {
            if (interaction.customId.startsWith('ticket_')) {
                await this.handleTicketButton(interaction);
            }
        } catch (error) {
            this.logger.error('Error handling ticket interaction:', error);
        }
    }

    async handleChannelDelete(channel) {
        if (!this.enabled) return;

        try {
            const ticket = await this.database.getTicket(channel.id);
            if (ticket) {
                await this.database.execute(
                    'UPDATE tickets SET status = "deleted" WHERE channel_id = ?',
                    [channel.id]
                );
            }
        } catch (error) {
            this.logger.error('Error handling channel delete:', error);
        }
    }

    async handleTicketButton(interaction) {
        const action = interaction.customId.split('_')[1];

        switch (action) {
            case 'create':
                await this.createTicket(interaction);
                break;
            case 'close':
                await this.closeTicket(interaction);
                break;
            case 'reopen':
                await this.reopenTicket(interaction);
                break;
            case 'delete':
                await this.deleteTicket(interaction);
                break;
        }
    }

    async createTicket(interaction) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            // Check if user already has an open ticket
            const existingTicket = await this.database.query(
                'SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = "open"',
                [guildId, userId]
            );

            if (existingTicket.length > 0) {
                return interaction.reply({ 
                    content: 'You already have an open ticket!', 
                    ephemeral: true 
                });
            }

            // Create ticket channel
            const ticketNumber = await this.getNextTicketNumber(guildId);
            const channelName = `ticket-${ticketNumber}`;
            
            const channel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: interaction.channel.parent,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: this.bot.client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });

            // Create ticket in database
            await this.database.createTicket(guildId, channel.id, userId);

            // Send welcome message
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('🎫 Ticket Created')
                .setDescription(`Hello ${interaction.user}! This is your support ticket.\n\nPlease describe your issue and a staff member will assist you shortly.`)
                .addFields(
                    { name: 'Ticket ID', value: `#${ticketNumber}`, inline: true },
                    { name: 'Created By', value: interaction.user.toString(), inline: true },
                    { name: 'Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('ticket_delete')
                        .setLabel('Delete Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🗑️')
                );

            await channel.send({ 
                content: `${interaction.user}`, 
                embeds: [embed], 
                components: [row] 
            });

            await interaction.reply({ 
                content: `Your ticket has been created: ${channel}`, 
                ephemeral: true 
            });

            this.logger.info(`Ticket created: ${channelName} by ${interaction.user.tag}`);
        } catch (error) {
            this.logger.error('Error creating ticket:', error);
            await interaction.reply({ 
                content: 'An error occurred while creating your ticket.', 
                ephemeral: true 
            });
        }
    }

    async closeTicket(interaction) {
        try {
            const ticket = await this.database.getTicket(interaction.channel.id);
            if (!ticket) {
                return interaction.reply({ 
                    content: 'This is not a valid ticket channel.', 
                    ephemeral: true 
                });
            }

            if (ticket.status !== 'open') {
                return interaction.reply({ 
                    content: 'This ticket is already closed.', 
                    ephemeral: true 
                });
            }

            // Generate transcript
            const transcript = await this.generateTranscript(interaction.channel);
            
            // Update ticket status
            await this.database.closeTicket(interaction.channel.id, transcript);

            // Send closing message
            const embed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('🔒 Ticket Closed')
                .setDescription('This ticket has been closed.')
                .addFields(
                    { name: 'Closed By', value: interaction.user.toString(), inline: true },
                    { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_reopen')
                        .setLabel('Reopen Ticket')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🔓')
                );

            await interaction.reply({ embeds: [embed], components: [row] });

            // Send transcript to transcript channel
            if (this.transcriptChannel) {
                await this.sendTranscript(transcript, ticket);
            }

            this.logger.info(`Ticket closed: ${interaction.channel.name} by ${interaction.user.tag}`);
        } catch (error) {
            this.logger.error('Error closing ticket:', error);
            await interaction.reply({ 
                content: 'An error occurred while closing the ticket.', 
                ephemeral: true 
            });
        }
    }

    async reopenTicket(interaction) {
        try {
            const ticket = await this.database.getTicket(interaction.channel.id);
            if (!ticket) {
                return interaction.reply({ 
                    content: 'This is not a valid ticket channel.', 
                    ephemeral: true 
                });
            }

            if (ticket.status !== 'closed') {
                return interaction.reply({ 
                    content: 'This ticket is not closed.', 
                    ephemeral: true 
                });
            }

            // Update ticket status
            await this.database.execute(
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

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('ticket_delete')
                        .setLabel('Delete Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🗑️')
                );

            await interaction.reply({ embeds: [embed], components: [row] });

            this.logger.info(`Ticket reopened: ${interaction.channel.name} by ${interaction.user.tag}`);
        } catch (error) {
            this.logger.error('Error reopening ticket:', error);
            await interaction.reply({ 
                content: 'An error occurred while reopening the ticket.', 
                ephemeral: true 
            });
        }
    }

    async deleteTicket(interaction) {
        try {
            const ticket = await this.database.getTicket(interaction.channel.id);
            if (!ticket) {
                return interaction.reply({ 
                    content: 'This is not a valid ticket channel.', 
                    ephemeral: true 
                });
            }

            // Delete the channel
            await interaction.channel.delete();

            this.logger.info(`Ticket deleted: ${interaction.channel.name} by ${interaction.user.tag}`);
        } catch (error) {
            this.logger.error('Error deleting ticket:', error);
            await interaction.reply({ 
                content: 'An error occurred while deleting the ticket.', 
                ephemeral: true 
            });
        }
    }

    async createPanel(interaction, title, description, category = null) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: 'Click the button below to create a ticket' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_create')
                        .setLabel('Create Ticket')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎫')
                );

            await interaction.reply({ embeds: [embed], components: [row] });

            // Store panel info
            const panel = {
                id: Date.now().toString(),
                title,
                description,
                category,
                channelId: interaction.channel.id,
                messageId: (await interaction.fetchReply()).id
            };

            this.panels.push(panel);
            this.config.set('modules.tickets.panels', this.panels);

            this.logger.info(`Ticket panel created: ${title} in ${interaction.channel.name}`);
        } catch (error) {
            this.logger.error('Error creating ticket panel:', error);
            await interaction.reply({ 
                content: 'An error occurred while creating the ticket panel.', 
                ephemeral: true 
            });
        }
    }

    async generateTranscript(channel) {
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = messages
                .reverse()
                .map(msg => {
                    const timestamp = new Date(msg.createdTimestamp).toISOString();
                    return `[${timestamp}] ${msg.author.tag}: ${msg.content}`;
                })
                .join('\n');

            return transcript;
        } catch (error) {
            this.logger.error('Error generating transcript:', error);
            return 'Failed to generate transcript';
        }
    }

    async sendTranscript(transcript, ticket) {
        try {
            const channel = this.bot.client.channels.cache.get(this.transcriptChannel);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('Ticket Transcript')
                .addFields(
                    { name: 'Ticket ID', value: `#${ticket.id}`, inline: true },
                    { name: 'User', value: `<@${ticket.user_id}>`, inline: true },
                    { name: 'Status', value: 'Closed', inline: true }
                )
                .setTimestamp();

            await channel.send({ 
                embeds: [embed],
                files: [{
                    attachment: Buffer.from(transcript),
                    name: `ticket-${ticket.id}-transcript.txt`
                }]
            });
        } catch (error) {
            this.logger.error('Error sending transcript:', error);
        }
    }

    async checkAutoClose() {
        try {
            const tickets = await this.database.query(
                'SELECT * FROM tickets WHERE status = "open" AND created_at < datetime("now", "-" || ? || " hours")',
                [this.autoClose.time]
            );

            for (const ticket of tickets) {
                const channel = this.bot.client.channels.cache.get(ticket.channel_id);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ffa502')
                        .setTitle('⚠️ Ticket Auto-Close Warning')
                        .setDescription('This ticket has been inactive and will be automatically closed soon.')
                        .setTimestamp();

                    await channel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            this.logger.error('Error checking auto-close:', error);
        }
    }

    async getNextTicketNumber(guildId) {
        const counter = this.ticketCounters.get(guildId) || 0;
        const nextNumber = counter + 1;
        this.ticketCounters.set(guildId, nextNumber);
        return nextNumber;
    }

    async setTranscriptChannel(channelId) {
        this.transcriptChannel = channelId;
        this.config.set('modules.tickets.transcriptChannel', channelId);
    }

    async setAutoClose(enabled, time) {
        this.autoClose = { enabled, time };
        this.config.set('modules.tickets.autoClose', this.autoClose);
    }
}

module.exports = TicketsModule;
