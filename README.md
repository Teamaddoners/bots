# Discord Bot - Professional, Modular, and Scalable

A comprehensive Discord bot built with Node.js and Discord.js v14+ featuring a web-based configuration editor, modular architecture, and extensive feature set.

## 🚀 Features

### Core Features
- **Modular Architecture**: Easy to extend with new modules and commands
- **Web Configuration Editor**: User-friendly web interface for bot configuration
- **Hot Reload**: Configuration changes apply instantly without bot restart
- **Multi-Server Support**: Independent configuration for each server
- **Permission System**: Role-based permissions for all features

### Modules

#### 🔨 Moderation
- Kick, ban, mute, unmute commands
- Message clearing with filters
- Warning system with database storage
- Auto-moderation (spam, caps, links, profanity)
- Configurable cooldowns and permissions

#### 🏆 Leveling System
- Message and voice XP tracking
- Level cards with custom designs
- Role rewards for level milestones
- XP boosters and multipliers
- Leaderboards and statistics

#### 👋 Welcomer System
- Custom welcome/leave messages
- Welcome cards with user avatars
- Auto-role assignment
- Configurable message variables
- Channel-specific settings

#### 🎫 Ticket System
- Multiple ticket panels
- Automatic ticket creation
- Transcript saving
- Auto-close functionality
- Role-based access control

#### 📊 Polls
- Interactive polls with buttons/select menus
- Timed polls with automatic closure
- Multiple vote options
- Results tracking and display
- Role-based voting restrictions

#### 🎵 Music Player
- YouTube integration
- Queue management
- Volume control
- DJ role system
- Playlist support
- Voice channel management

#### 📱 Social Media Notifications
- YouTube channel monitoring
- Twitter account tracking
- Twitch stream notifications
- Reddit subreddit monitoring
- Webhook integration

#### 👑 Premium Features
- Custom bot status
- Branding removal
- Starboard system
- Temporary voice channels
- Sticky messages
- Verification system
- Suggestion system
- Birthday tracking
- Emoji management

## 📋 Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager
- Discord Bot Token
- FFmpeg (for music features)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the bot**
   - Copy `env.example` to `.env` and fill in the values
   - Optional: Copy `config.yml.example` to `config.yml` (the web editor will write it)
   - Optional security: set `WEB_ADMIN_TOKEN` to protect the editor API

4. **Start the bot**
   ```bash
   npm run full
   ```

5. **Access the web editor**
   - Open your browser and go to `http://localhost:3000`
   - Configure your bot settings through the web interface

## ⚙️ Configuration

### Bot Settings
```yaml
bot:
  token: "YOUR_BOT_TOKEN"
  prefix: "!"
  ownerId: "YOUR_USER_ID"
  status: "online"
  activity:
    type: "WATCHING"
    name: "Managing servers"
```

### Module Configuration
Each module can be enabled/disabled and configured independently:

```yaml
modules:
  moderation:
    enabled: true
    autoMod:
      enabled: true
      spamProtection: true
      capsFilter: true
      linkFilter: false
      profanityFilter: false
  
  leveling:
    enabled: true
    messageXP: 15
    voiceXP: 10
    levelUpMessage: true
    levelUpChannel: null
    roleRewards: []
    xpBoosters: []
```

## 🌐 Web Editor

The web-based configuration editor provides:

- **Side Navigation**: Organized by module type
- **Live Preview**: See changes before applying
- **Hot Reload**: Instant configuration updates
- **Validation**: Prevent configuration errors
- **Export/Import**: Backup and restore settings
- **Theme Support**: Dark/light mode toggle

### Accessing the Web Editor

1. Start everything: `npm run full`
2. Open `http://localhost:3000` in your browser
4. Configure your bot settings

## 📁 Project Structure

```
discord-bot/
├── src/
│   ├── commands/           # Slash commands
│   ├── events/            # Discord events
│   ├── modules/           # Feature modules
│   ├── utils/             # Utility functions
│   ├── web_editor/         # Web configuration editor
│   └── index.js           # Main bot file
├── config.yml             # Bot configuration
├── package.json           # Dependencies
└── README.md             # This file
```

## 🔧 Adding New Modules

### 1. Create Module File
Create a new file in `src/modules/`:

```javascript
class MyModule {
    constructor() {
        this.name = 'myModule';
        this.enabled = false;
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
        const config = this.config.get('modules.myModule');
        if (config) {
            this.enabled = config.enabled || false;
        }
    }

    onConfigUpdate(config) {
        this.config = config;
        this.loadConfig();
    }

    setupEventHandlers() {
        // Add event listeners here
    }
}

module.exports = MyModule;
```

### 2. Add Configuration
Add your module to `config.yml`:

```yaml
modules:
  myModule:
    enabled: true
    # Add your configuration options here
```

### 3. Register Module
The module will be automatically loaded by the bot's module system.

## 🎨 Creating Commands

### Slash Commands
Create a new file in `src/commands/`:

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mycommand')
        .setDescription('My command description')
        .addStringOption(option =>
            option.setName('input')
                .setDescription('Input description')
                .setRequired(true)),

    async execute(interaction, bot) {
        const input = interaction.options.getString('input');
        
        await interaction.reply(`You entered: ${input}`);
    }
};
```

## 🗄️ Database

The bot uses SQLite for data storage with the following tables:

- `users` - User leveling data
- `tickets` - Ticket system data
- `polls` - Poll data and votes
- `warnings` - User warnings
- `social_notifications` - Social media settings
- `premium_guilds` - Premium feature data
- `starboard` - Starboard messages
- `sticky_messages` - Sticky message data
- `suggestions` - User suggestions
- `birthdays` - Birthday tracking

## 🔐 Permissions

The bot uses Discord's permission system:

- **Administrator**: Full access to all commands
- **Moderator Roles**: Access to moderation commands
- **DJ Roles**: Access to music commands
- **Custom Roles**: Module-specific permissions

## 🚀 Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start src/index.js --name discord-bot
pm2 startup
pm2 save
```

### Using Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

### Environment Variables
```bash
BOT_TOKEN=your_bot_token
BOT_OWNER_ID=your_user_id
BOT_PREFIX=!
WEB_PORT=3000
WEB_HOST=localhost
WEB_ADMIN_TOKEN= # optional security token
DATABASE_PATH=./data/bot.db
```

## 🐛 Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check bot token in configuration
   - Verify bot has necessary permissions
   - Check console for error messages

2. **Web editor not loading**
   - Ensure port 3000 is available
   - Check firewall settings
   - Verify all dependencies are installed

3. **Music not playing**
   - Install FFmpeg
   - Check voice channel permissions
   - Verify YouTube URL format

4. **Database errors**
   - Check file permissions
   - Ensure SQLite is properly installed
   - Verify database file location

### Logs
Check the `logs/` directory for detailed error logs:
- `error.log` - Error messages
- `combined.log` - All log messages

## 📝 API Reference

### ConfigManager
```javascript
// Get configuration value
const value = bot.config.get('modules.leveling.messageXP');

// Set configuration value
bot.config.set('modules.leveling.messageXP', 20);

// Save configuration
bot.config.save();
```

### Database
```javascript
// Execute SQL query
await bot.database.execute('INSERT INTO users (id, guild_id) VALUES (?, ?)', [userId, guildId]);

// Query database
const users = await bot.database.query('SELECT * FROM users WHERE guild_id = ?', [guildId]);
```

### Logger
```javascript
// Log messages
bot.logger.info('Information message');
bot.logger.warn('Warning message');
bot.logger.error('Error message');
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- Create an issue on GitHub
- Join our Discord server
- Check the documentation
- Review existing issues

## 🔄 Updates

The bot supports hot reloading for configuration changes. Module updates require a restart:

```bash
npm run restart
```

## 📊 Performance

- **Memory Usage**: ~50-100MB depending on server count
- **CPU Usage**: Minimal when idle
- **Database**: SQLite for fast local storage
- **Scalability**: Supports hundreds of servers

## 🔒 Security

- All user input is sanitized
- SQL injection protection
- Rate limiting on commands
- Permission-based access control
- Secure configuration storage

---

**Built with ❤️ using Node.js and Discord.js**
