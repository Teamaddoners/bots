const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, bot) {
        if (interaction.isChatInputCommand()) {
            const command = bot.getCommand(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction, bot);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                
                const errorMessage = {
                    content: 'There was an error while executing this command!',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        } else if (interaction.isButton()) {
            // Handle button interactions
            const module = bot.modules.get('tickets');
            if (module && module.handleInteraction) {
                await module.handleInteraction(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            // Handle select menu interactions
            const module = bot.modules.get('polls');
            if (module && module.handleInteraction) {
                await module.handleInteraction(interaction);
            }
        }
    }
};
