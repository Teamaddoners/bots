const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio');

class SocialModule {
    constructor() {
        this.name = 'social';
        this.enabled = false;
        this.platforms = {
            youtube: {
                enabled: false,
                channel: null,
                webhook: null,
                lastCheck: null
            },
            twitter: {
                enabled: false,
                accounts: [],
                lastCheck: null
            },
            twitch: {
                enabled: false,
                streamers: [],
                lastCheck: null
            },
            reddit: {
                enabled: false,
                subreddits: [],
                lastCheck: null
            }
        };
        this.checkInterval = 5 * 60 * 1000; // 5 minutes
        this.intervalId = null;
    }

    init(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.database = bot.database;
        this.logger = bot.logger;
        
        this.loadConfig();
        this.setupEventHandlers();
        this.startMonitoring();
    }

    loadConfig() {
        const socialConfig = this.config.get('modules.social');
        if (socialConfig) {
            this.enabled = socialConfig.enabled || false;
            this.platforms.youtube = {
                enabled: socialConfig.youtube?.enabled || false,
                channel: socialConfig.youtube?.channel,
                webhook: socialConfig.youtube?.webhook,
                lastCheck: null
            };
            this.platforms.twitter = {
                enabled: socialConfig.twitter?.enabled || false,
                accounts: socialConfig.twitter?.accounts || [],
                lastCheck: null
            };
            this.platforms.twitch = {
                enabled: socialConfig.twitch?.enabled || false,
                streamers: socialConfig.twitch?.streamers || [],
                lastCheck: null
            };
            this.platforms.reddit = {
                enabled: socialConfig.reddit?.enabled || false,
                subreddits: socialConfig.reddit?.subreddits || [],
                lastCheck: null
            };
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupEventHandlers() {
        // No specific event handlers needed for social media monitoring
    }

    startMonitoring() {
        if (!this.enabled) return;

        this.intervalId = setInterval(async () => {
            await this.checkAllPlatforms();
        }, this.checkInterval);

        this.logger.info('Social media monitoring started');
    }

    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async checkAllPlatforms() {
        try {
            if (this.platforms.youtube.enabled) {
                await this.checkYouTube();
            }
            if (this.platforms.twitter.enabled) {
                await this.checkTwitter();
            }
            if (this.platforms.twitch.enabled) {
                await this.checkTwitch();
            }
            if (this.platforms.reddit.enabled) {
                await this.checkReddit();
            }
        } catch (error) {
            this.logger.error('Error checking social media platforms:', error);
        }
    }

    async checkYouTube() {
        try {
            const channelId = this.platforms.youtube.channel;
            if (!channelId) return;

            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            const parser = new Parser();
            const feed = await parser.parseURL(rssUrl);

            const latestVideo = feed.items[0];
            if (!latestVideo) return;

            const videoId = latestVideo.id.split(':')[2];
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            // Check if we've already posted this video
            const lastPosted = await this.database.query(
                'SELECT * FROM social_notifications WHERE platform = "youtube" AND guild_id = ? ORDER BY last_check DESC LIMIT 1',
                [this.bot.client.guilds.cache.first()?.id]
            );

            if (lastPosted.length > 0 && lastPosted[0].last_check >= latestVideo.pubDate) {
                return;
            }

            // Post the video
            await this.postYouTubeVideo(latestVideo, videoUrl);
        } catch (error) {
            this.logger.error('Error checking YouTube:', error);
        }
    }

    async postYouTubeVideo(video, videoUrl) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('📺 New YouTube Video!')
                .setDescription(`**${video.title}**`)
                .setURL(videoUrl)
                .setThumbnail(video.media?.thumbnail?.url || '')
                .addFields(
                    { name: 'Channel', value: video.author, inline: true },
                    { name: 'Published', value: `<t:${Math.floor(new Date(video.pubDate).getTime() / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

            // Post to configured channels
            await this.postToChannels(embed, 'youtube');
        } catch (error) {
            this.logger.error('Error posting YouTube video:', error);
        }
    }

    async checkTwitter() {
        try {
            // Twitter API integration would go here
            // This is a simplified example
            this.logger.info('Twitter monitoring not implemented yet');
        } catch (error) {
            this.logger.error('Error checking Twitter:', error);
        }
    }

    async checkTwitch() {
        try {
            const streamers = this.platforms.twitch.streamers;
            if (streamers.length === 0) return;

            for (const streamer of streamers) {
                const isLive = await this.checkTwitchStream(streamer);
                if (isLive) {
                    await this.postTwitchStream(streamer, isLive);
                }
            }
        } catch (error) {
            this.logger.error('Error checking Twitch:', error);
        }
    }

    async checkTwitchStream(streamer) {
        try {
            // Twitch API integration would go here
            // This is a simplified example
            return null;
        } catch (error) {
            this.logger.error('Error checking Twitch stream:', error);
            return null;
        }
    }

    async postTwitchStream(streamer, streamData) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#9146ff')
                .setTitle('🔴 Live on Twitch!')
                .setDescription(`**${streamer}** is now live!`)
                .setURL(`https://www.twitch.tv/${streamer}`)
                .addFields(
                    { name: 'Game', value: streamData.game || 'Unknown', inline: true },
                    { name: 'Viewers', value: streamData.viewers?.toString() || 'Unknown', inline: true }
                )
                .setTimestamp();

            await this.postToChannels(embed, 'twitch');
        } catch (error) {
            this.logger.error('Error posting Twitch stream:', error);
        }
    }

    async checkReddit() {
        try {
            const subreddits = this.platforms.reddit.subreddits;
            if (subreddits.length === 0) return;

            for (const subreddit of subreddits) {
                const posts = await this.getRedditPosts(subreddit);
                if (posts.length > 0) {
                    await this.postRedditPosts(subreddit, posts);
                }
            }
        } catch (error) {
            this.logger.error('Error checking Reddit:', error);
        }
    }

    async getRedditPosts(subreddit) {
        try {
            const response = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json?limit=5`);
            const posts = response.data.data.children.map(child => child.data);
            return posts;
        } catch (error) {
            this.logger.error('Error getting Reddit posts:', error);
            return [];
        }
    }

    async postRedditPosts(subreddit, posts) {
        try {
            for (const post of posts) {
                const embed = new EmbedBuilder()
                    .setColor('#ff4500')
                    .setTitle('📱 New Reddit Post!')
                    .setDescription(`**${post.title}**`)
                    .setURL(`https://reddit.com${post.permalink}`)
                    .addFields(
                        { name: 'Subreddit', value: `r/${subreddit}`, inline: true },
                        { name: 'Author', value: `u/${post.author}`, inline: true },
                        { name: 'Score', value: post.score.toString(), inline: true }
                    )
                    .setTimestamp();

                await this.postToChannels(embed, 'reddit');
            }
        } catch (error) {
            this.logger.error('Error posting Reddit posts:', error);
        }
    }

    async postToChannels(embed, platform) {
        try {
            const notifications = await this.database.query(
                'SELECT * FROM social_notifications WHERE platform = ? AND enabled = 1',
                [platform]
            );

            for (const notification of notifications) {
                const channel = this.bot.client.channels.cache.get(notification.channel_id);
                if (channel) {
                    await channel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            this.logger.error('Error posting to channels:', error);
        }
    }

    async addNotification(guildId, platform, channelId, webhookUrl = null) {
        try {
            await this.database.execute(
                'INSERT OR REPLACE INTO social_notifications (guild_id, platform, channel_id, webhook_url, enabled) VALUES (?, ?, ?, ?, 1)',
                [guildId, platform, channelId, webhookUrl]
            );

            this.logger.info(`Added ${platform} notification for guild ${guildId}`);
        } catch (error) {
            this.logger.error('Error adding notification:', error);
        }
    }

    async removeNotification(guildId, platform) {
        try {
            await this.database.execute(
                'DELETE FROM social_notifications WHERE guild_id = ? AND platform = ?',
                [guildId, platform]
            );

            this.logger.info(`Removed ${platform} notification for guild ${guildId}`);
        } catch (error) {
            this.logger.error('Error removing notification:', error);
        }
    }

    async getNotifications(guildId) {
        try {
            return await this.database.query(
                'SELECT * FROM social_notifications WHERE guild_id = ?',
                [guildId]
            );
        } catch (error) {
            this.logger.error('Error getting notifications:', error);
            return [];
        }
    }

    async setYouTubeChannel(channelId) {
        this.platforms.youtube.channel = channelId;
        this.config.set('modules.social.youtube.channel', channelId);
    }

    async setYouTubeWebhook(webhookUrl) {
        this.platforms.youtube.webhook = webhookUrl;
        this.config.set('modules.social.youtube.webhook', webhookUrl);
    }

    async addTwitterAccount(account) {
        this.platforms.twitter.accounts.push(account);
        this.config.set('modules.social.twitter.accounts', this.platforms.twitter.accounts);
    }

    async removeTwitterAccount(account) {
        this.platforms.twitter.accounts = this.platforms.twitter.accounts.filter(acc => acc !== account);
        this.config.set('modules.social.twitter.accounts', this.platforms.twitter.accounts);
    }

    async addTwitchStreamer(streamer) {
        this.platforms.twitch.streamers.push(streamer);
        this.config.set('modules.social.twitch.streamers', this.platforms.twitch.streamers);
    }

    async removeTwitchStreamer(streamer) {
        this.platforms.twitch.streamers = this.platforms.twitch.streamers.filter(str => str !== streamer);
        this.config.set('modules.social.twitch.streamers', this.platforms.twitch.streamers);
    }

    async addRedditSubreddit(subreddit) {
        this.platforms.reddit.subreddits.push(subreddit);
        this.config.set('modules.social.reddit.subreddits', this.platforms.reddit.subreddits);
    }

    async removeRedditSubreddit(subreddit) {
        this.platforms.reddit.subreddits = this.platforms.reddit.subreddits.filter(sub => sub !== subreddit);
        this.config.set('modules.social.reddit.subreddits', this.platforms.reddit.subreddits);
    }
}

module.exports = SocialModule;
