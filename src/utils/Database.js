const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '..', '..', 'data', 'bot.db');
    }

    async init() {
        try {
            // Ensure data directory exists
            await fs.ensureDir(path.dirname(this.dbPath));
            
            this.db = new Database(this.dbPath);
            this.createTables();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    createTables() {
        // Users table for leveling system
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 0,
                total_xp INTEGER DEFAULT 0,
                voice_time INTEGER DEFAULT 0,
                messages INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tickets table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                status TEXT DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME,
                transcript TEXT
            )
        `);

        // Polls table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS polls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                question TEXT NOT NULL,
                options TEXT NOT NULL,
                votes TEXT DEFAULT '{}',
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Social media notifications
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS social_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                platform TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                webhook_url TEXT,
                last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
                enabled BOOLEAN DEFAULT 1
            )
        `);

        // Premium features
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS premium_guilds (
                guild_id TEXT PRIMARY KEY,
                features TEXT DEFAULT '{}',
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Reaction roles
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS reaction_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                emoji TEXT NOT NULL,
                role_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Auto roles
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS auto_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                role_id TEXT NOT NULL,
                type TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Birthday tracking
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS birthdays (
                user_id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                birthday DATE NOT NULL,
                timezone TEXT DEFAULT 'UTC',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Suggestions
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                suggestion TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                votes_up INTEGER DEFAULT 0,
                votes_down INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Starboard
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS starboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                original_message_id TEXT NOT NULL,
                starboard_message_id TEXT NOT NULL,
                stars INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    // User/Leveling methods
    getUser(guildId, userId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?');
        return stmt.get(userId, guildId);
    }

    updateUserXP(guildId, userId, xp) {
        const user = this.getUser(guildId, userId);
        if (!user) {
            const insertStmt = this.db.prepare(`
                INSERT INTO users (id, guild_id, xp, level, total_xp) 
                VALUES (?, ?, ?, 0, ?)
            `);
            insertStmt.run(userId, guildId, xp, xp);
        } else {
            const newXP = user.xp + xp;
            const newLevel = Math.floor(newXP / 1000);
            const updateStmt = this.db.prepare(`
                UPDATE users 
                SET xp = ?, level = ?, total_xp = total_xp + ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ? AND guild_id = ?
            `);
            updateStmt.run(newXP, newLevel, xp, userId, guildId);
        }
    }

    getLeaderboard(guildId, limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM users 
            WHERE guild_id = ? 
            ORDER BY total_xp DESC 
            LIMIT ?
        `);
        return stmt.all(guildId, limit);
    }

    // Ticket methods
    createTicket(guildId, channelId, userId) {
        const stmt = this.db.prepare(`
            INSERT INTO tickets (guild_id, channel_id, user_id) 
            VALUES (?, ?, ?)
        `);
        return stmt.run(guildId, channelId, userId);
    }

    getTicket(channelId) {
        const stmt = this.db.prepare('SELECT * FROM tickets WHERE channel_id = ?');
        return stmt.get(channelId);
    }

    closeTicket(channelId, transcript) {
        const stmt = this.db.prepare(`
            UPDATE tickets 
            SET status = 'closed', closed_at = CURRENT_TIMESTAMP, transcript = ? 
            WHERE channel_id = ?
        `);
        return stmt.run(transcript, channelId);
    }

    // Poll methods
    createPoll(guildId, channelId, messageId, question, options, expiresAt) {
        const stmt = this.db.prepare(`
            INSERT INTO polls (guild_id, channel_id, message_id, question, options, expires_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(guildId, channelId, messageId, question, JSON.stringify(options), expiresAt);
    }

    getPoll(messageId) {
        const stmt = this.db.prepare('SELECT * FROM polls WHERE message_id = ?');
        return stmt.get(messageId);
    }

    updatePollVotes(messageId, votes) {
        const stmt = this.db.prepare('UPDATE polls SET votes = ? WHERE message_id = ?');
        return stmt.run(JSON.stringify(votes), messageId);
    }

    // Generic query method
    query(sql, params = []) {
        return this.db.prepare(sql).all(params);
    }

    // Generic execute method
    execute(sql, params = []) {
        return this.db.prepare(sql).run(params);
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;
