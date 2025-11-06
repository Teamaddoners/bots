const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client, bot) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        // Set bot activity
        const activityConfig = bot.config.get('bot.activity');
        if (activityConfig) {
            client.user.setActivity(activityConfig.name, { type: activityConfig.type });
        }

        // Register slash commands
        try {
            const commands = [];
            
            // Load commands from modules
            bot.modules.forEach(module => {
                if (module.commands) {
                    module.commands.forEach(command => {
                        commands.push(command.data.toJSON());
                    });
                }
            });

            // Load standalone commands
            bot.commands.forEach(command => {
                commands.push(command.data.toJSON());
            });

            // Register commands globally
            await client.application.commands.set(commands);
            console.log(`Registered ${commands.length} slash commands`);
        } catch (error) {
            console.error('Error registering commands:', error);
        }

        // Initialize modules
        bot.modules.forEach(module => {
            if (module.init) {
                module.init(bot);
            }
        });

        console.log('Bot initialization complete!');
    }
};
