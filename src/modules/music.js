const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');

class MusicModule {
    constructor() {
        this.name = 'music';
        this.enabled = false;
        this.defaultVolume = 50;
        this.djRole = null;
        this.maxQueue = 100;
        this.defaultPlaylist = null;
        this.queues = new Map();
        this.players = new Map();
        this.connections = new Map();
    }

    init(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.database = bot.database;
        this.logger = bot.logger;
        
        this.loadConfig();
        this.setupEventHandlers();
    }

    loadConfig() {
        const musicConfig = this.config.get('modules.music');
        if (musicConfig) {
            this.enabled = musicConfig.enabled || false;
            this.defaultVolume = musicConfig.defaultVolume || 50;
            this.djRole = musicConfig.djRole;
            this.maxQueue = musicConfig.maxQueue || 100;
            this.defaultPlaylist = musicConfig.defaultPlaylist;
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupEventHandlers() {
        this.bot.client.on('voiceStateUpdate', this.handleVoiceStateUpdate.bind(this));
    }

    async handleVoiceStateUpdate(oldState, newState) {
        if (!this.enabled) return;

        // Check if bot was disconnected
        if (oldState.member.id === this.bot.client.user.id && newState.channelId === null) {
            const guildId = oldState.guild.id;
            await this.cleanup(guildId);
        }

        // Check if everyone left the voice channel
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            const channel = oldState.channel;
            if (channel.members.size === 1 && channel.members.has(this.bot.client.user.id)) {
                await this.cleanup(oldState.guild.id);
            }
        }
    }

    async joinVoiceChannel(member) {
        try {
            const connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                guildId: member.guild.id,
                adapterCreator: member.guild.voiceAdapterCreator
            });

            this.connections.set(member.guild.id, connection);

            // Create audio player
            const player = createAudioPlayer();
            this.players.set(member.guild.id, player);

            connection.subscribe(player);

            // Handle player events
            player.on(AudioPlayerStatus.Idle, () => {
                this.handlePlayerIdle(member.guild.id);
            });

            player.on('error', (error) => {
                this.logger.error('Audio player error:', error);
            });

            return connection;
        } catch (error) {
            this.logger.error('Error joining voice channel:', error);
            throw error;
        }
    }

    async play(guildId, song) {
        try {
            const player = this.players.get(guildId);
            if (!player) {
                throw new Error('No audio player found');
            }

            const resource = createAudioResource(ytdl(song.url, {
                filter: 'audioonly',
                highWaterMark: 1 << 25
            }), {
                inlineVolume: true
            });

            resource.volume.setVolume(this.defaultVolume / 100);
            player.play(resource);

            return true;
        } catch (error) {
            this.logger.error('Error playing song:', error);
            throw error;
        }
    }

    async addToQueue(guildId, song) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, []);
        }

        const queue = this.queues.get(guildId);
        
        if (queue.length >= this.maxQueue) {
            throw new Error('Queue is full');
        }

        queue.push(song);
        this.queues.set(guildId, queue);

        return queue.length;
    }

    async getQueue(guildId) {
        return this.queues.get(guildId) || [];
    }

    async skip(guildId) {
        const player = this.players.get(guildId);
        if (!player) return false;

        player.stop();
        return true;
    }

    async pause(guildId) {
        const player = this.players.get(guildId);
        if (!player) return false;

        player.pause();
        return true;
    }

    async resume(guildId) {
        const player = this.players.get(guildId);
        if (!player) return false;

        player.unpause();
        return true;
    }

    async stop(guildId) {
        const player = this.players.get(guildId);
        if (!player) return false;

        player.stop();
        this.queues.set(guildId, []);
        return true;
    }

    async setVolume(guildId, volume) {
        const player = this.players.get(guildId);
        if (!player) return false;

        // Note: Volume control would need to be implemented in the audio resource
        // This is a simplified version
        return true;
    }

    async shuffle(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue || queue.length <= 1) return false;

        // Fisher-Yates shuffle algorithm
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }

        this.queues.set(guildId, queue);
        return true;
    }

    async handlePlayerIdle(guildId) {
        try {
            const queue = this.queues.get(guildId);
            if (!queue || queue.length === 0) {
                await this.cleanup(guildId);
                return;
            }

            const nextSong = queue.shift();
            this.queues.set(guildId, queue);

            await this.play(guildId, nextSong);

            // Notify channel about next song
            await this.notifyNextSong(guildId, nextSong);
        } catch (error) {
            this.logger.error('Error handling player idle:', error);
        }
    }

    async notifyNextSong(guildId, song) {
        try {
            const guild = this.bot.client.guilds.cache.get(guildId);
            if (!guild) return;

            // Find the channel where the music command was used
            // This is a simplified approach - in a real implementation, you'd store the channel
            const channel = guild.channels.cache.find(ch => ch.type === 0); // Text channel
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('🎵 Now Playing')
                .setDescription(`**${song.title}**`)
                .addFields(
                    { name: 'Duration', value: song.duration || 'Unknown', inline: true },
                    { name: 'Requested by', value: song.requestedBy || 'Unknown', inline: true }
                )
                .setThumbnail(song.thumbnail)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            this.logger.error('Error notifying next song:', error);
        }
    }

    async searchYouTube(query) {
        try {
            const results = await ytsr(query, { limit: 10 });
            return results.items
                .filter(item => item.type === 'video')
                .map(item => ({
                    title: item.title,
                    url: item.url,
                    duration: item.duration,
                    thumbnail: item.thumbnail,
                    author: item.author.name
                }));
        } catch (error) {
            this.logger.error('Error searching YouTube:', error);
            return [];
        }
    }

    async getSongInfo(url) {
        try {
            const info = await ytdl.getInfo(url);
            return {
                title: info.videoDetails.title,
                url: url,
                duration: info.videoDetails.lengthSeconds,
                thumbnail: info.videoDetails.thumbnails[0]?.url,
                author: info.videoDetails.author.name
            };
        } catch (error) {
            this.logger.error('Error getting song info:', error);
            return null;
        }
    }

    async cleanup(guildId) {
        try {
            const connection = this.connections.get(guildId);
            if (connection) {
                connection.destroy();
                this.connections.delete(guildId);
            }

            const player = this.players.get(guildId);
            if (player) {
                player.stop();
                this.players.delete(guildId);
            }

            this.queues.delete(guildId);
        } catch (error) {
            this.logger.error('Error cleaning up music:', error);
        }
    }

    async hasPermission(member) {
        if (!this.djRole) return true;
        return member.roles.cache.has(this.djRole) || member.permissions.has('Administrator');
    }

    async createQueueEmbed(guildId) {
        try {
            const queue = await this.getQueue(guildId);
            
            if (queue.length === 0) {
                return new EmbedBuilder()
                    .setColor('#5865f2')
                    .setTitle('🎵 Music Queue')
                    .setDescription('The queue is empty.')
                    .setTimestamp();
            }

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('🎵 Music Queue')
                .setTimestamp();

            const queueList = queue.slice(0, 10).map((song, index) => {
                return `${index + 1}. **${song.title}** - ${song.duration || 'Unknown'}`;
            }).join('\n');

            embed.setDescription(queueList);

            if (queue.length > 10) {
                embed.setFooter({ text: `And ${queue.length - 10} more songs...` });
            }

            return embed;
        } catch (error) {
            this.logger.error('Error creating queue embed:', error);
            return new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('Error')
                .setDescription('Failed to create queue embed.')
                .setTimestamp();
        }
    }

    async createControlButtons(guildId) {
        const queue = await this.getQueue(guildId);
        const hasQueue = queue.length > 0;

        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_play')
                    .setLabel('Play')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('▶️'),
                new ButtonBuilder()
                    .setCustomId('music_pause')
                    .setLabel('Pause')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏸️'),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏭️')
                    .setDisabled(!hasQueue),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setLabel('Stop')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⏹️'),
                new ButtonBuilder()
                    .setCustomId('music_queue')
                    .setLabel('Queue')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋')
            );
    }
}

module.exports = MusicModule;
