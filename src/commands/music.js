const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Music player commands')
        .addSubcommand(subcommand =>
            subcommand.setName('play')
                .setDescription('Play a song or add to queue')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Song name or YouTube URL')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('pause')
                .setDescription('Pause the current song'))
        .addSubcommand(subcommand =>
            subcommand.setName('resume')
                .setDescription('Resume the current song'))
        .addSubcommand(subcommand =>
            subcommand.setName('skip')
                .setDescription('Skip the current song'))
        .addSubcommand(subcommand =>
            subcommand.setName('stop')
                .setDescription('Stop the music and clear queue'))
        .addSubcommand(subcommand =>
            subcommand.setName('queue')
                .setDescription('Show the current queue'))
        .addSubcommand(subcommand =>
            subcommand.setName('shuffle')
                .setDescription('Shuffle the queue'))
        .addSubcommand(subcommand =>
            subcommand.setName('volume')
                .setDescription('Set the volume')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Volume level (0-100)')
                        .setMinValue(0)
                        .setMaxValue(100)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('search')
                .setDescription('Search for songs on YouTube')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Search query')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('nowplaying')
                .setDescription('Show currently playing song')),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        const musicModule = bot.getModule('music');
        
        if (!musicModule) {
            return interaction.reply({ content: 'Music module is not loaded.', ephemeral: true });
        }

        if (!musicModule.enabled) {
            return interaction.reply({ content: 'Music system is disabled.', ephemeral: true });
        }

        // Check if user is in a voice channel
        if (!interaction.member.voice.channel) {
            return interaction.reply({ 
                content: 'You need to be in a voice channel to use music commands.', 
                ephemeral: true 
            });
        }

        // Check DJ permissions
        if (!await musicModule.hasPermission(interaction.member)) {
            return interaction.reply({ 
                content: 'You do not have permission to use music commands.', 
                ephemeral: true 
            });
        }

        try {
            switch (subcommand) {
                case 'play':
                    await this.handlePlay(interaction, musicModule);
                    break;
                case 'pause':
                    await this.handlePause(interaction, musicModule);
                    break;
                case 'resume':
                    await this.handleResume(interaction, musicModule);
                    break;
                case 'skip':
                    await this.handleSkip(interaction, musicModule);
                    break;
                case 'stop':
                    await this.handleStop(interaction, musicModule);
                    break;
                case 'queue':
                    await this.handleQueue(interaction, musicModule);
                    break;
                case 'shuffle':
                    await this.handleShuffle(interaction, musicModule);
                    break;
                case 'volume':
                    await this.handleVolume(interaction, musicModule);
                    break;
                case 'search':
                    await this.handleSearch(interaction, musicModule);
                    break;
                case 'nowplaying':
                    await this.handleNowPlaying(interaction, musicModule);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            bot.logger.error('Error in music command:', error);
            await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
    },

    async handlePlay(interaction, musicModule) {
        const query = interaction.options.getString('query');
        
        await interaction.deferReply();

        try {
            // Check if it's a YouTube URL
            let song;
            if (ytdl.validateURL(query)) {
                song = await musicModule.getSongInfo(query);
            } else {
                // Search for the song
                const results = await musicModule.searchYouTube(query);
                if (results.length === 0) {
                    return interaction.editReply({ content: 'No songs found for your query.' });
                }
                song = results[0];
            }

            if (!song) {
                return interaction.editReply({ content: 'Failed to get song information.' });
            }

            // Join voice channel if not already connected
            if (!musicModule.connections.has(interaction.guild.id)) {
                await musicModule.joinVoiceChannel(interaction.member);
            }

            // Add song to queue
            const position = await musicModule.addToQueue(interaction.guild.id, {
                ...song,
                requestedBy: interaction.user.tag
            });

            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('🎵 Added to Queue')
                .setDescription(`**${song.title}**`)
                .addFields(
                    { name: 'Position in Queue', value: position.toString(), inline: true },
                    { name: 'Duration', value: song.duration || 'Unknown', inline: true },
                    { name: 'Requested by', value: interaction.user.toString(), inline: true }
                )
                .setThumbnail(song.thumbnail)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Start playing if this is the first song
            const queue = await musicModule.getQueue(interaction.guild.id);
            if (queue.length === 1) {
                await musicModule.play(interaction.guild.id, song);
            }
        } catch (error) {
            await interaction.editReply({ content: 'An error occurred while playing the song.' });
        }
    },

    async handlePause(interaction, musicModule) {
        const success = await musicModule.pause(interaction.guild.id);
        
        if (success) {
            await interaction.reply({ content: '⏸️ Music paused.' });
        } else {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
        }
    },

    async handleResume(interaction, musicModule) {
        const success = await musicModule.resume(interaction.guild.id);
        
        if (success) {
            await interaction.reply({ content: '▶️ Music resumed.' });
        } else {
            await interaction.reply({ content: 'No music is currently paused.', ephemeral: true });
        }
    },

    async handleSkip(interaction, musicModule) {
        const success = await musicModule.skip(interaction.guild.id);
        
        if (success) {
            await interaction.reply({ content: '⏭️ Skipped to next song.' });
        } else {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
        }
    },

    async handleStop(interaction, musicModule) {
        const success = await musicModule.stop(interaction.guild.id);
        
        if (success) {
            await interaction.reply({ content: '⏹️ Music stopped and queue cleared.' });
        } else {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
        }
    },

    async handleQueue(interaction, musicModule) {
        const embed = await musicModule.createQueueEmbed(interaction.guild.id);
        const buttons = await musicModule.createControlButtons(interaction.guild.id);
        
        await interaction.reply({ embeds: [embed], components: [buttons] });
    },

    async handleShuffle(interaction, musicModule) {
        const success = await musicModule.shuffle(interaction.guild.id);
        
        if (success) {
            await interaction.reply({ content: '🔀 Queue shuffled.' });
        } else {
            await interaction.reply({ content: 'Queue is empty or has only one song.', ephemeral: true });
        }
    },

    async handleVolume(interaction, musicModule) {
        const level = interaction.options.getInteger('level');
        const success = await musicModule.setVolume(interaction.guild.id, level);
        
        if (success) {
            await interaction.reply({ content: `🔊 Volume set to ${level}%.` });
        } else {
            await interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
        }
    },

    async handleSearch(interaction, musicModule) {
        const query = interaction.options.getString('query');
        
        await interaction.deferReply();

        try {
            const results = await musicModule.searchYouTube(query);
            
            if (results.length === 0) {
                return interaction.editReply({ content: 'No songs found for your query.' });
            }

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('🔍 Search Results')
                .setDescription(`Found ${results.length} results for "${query}"`)
                .setTimestamp();

            results.slice(0, 5).forEach((song, index) => {
                embed.addFields({
                    name: `${index + 1}. ${song.title}`,
                    value: `Duration: ${song.duration || 'Unknown'} | Author: ${song.author}`,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({ content: 'An error occurred while searching.' });
        }
    },

    async handleNowPlaying(interaction, musicModule) {
        const queue = await musicModule.getQueue(interaction.guild.id);
        
        if (queue.length === 0) {
            return interaction.reply({ content: 'No music is currently playing.', ephemeral: true });
        }

        const currentSong = queue[0];
        
        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('🎵 Now Playing')
            .setDescription(`**${currentSong.title}**`)
            .addFields(
                { name: 'Duration', value: currentSong.duration || 'Unknown', inline: true },
                { name: 'Requested by', value: currentSong.requestedBy || 'Unknown', inline: true },
                { name: 'Position in Queue', value: '1', inline: true }
            )
            .setThumbnail(currentSong.thumbnail)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
