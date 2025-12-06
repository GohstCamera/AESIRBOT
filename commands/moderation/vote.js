const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Voir quand vous pouvez voter à nouveau et obtenir des récompenses'),

    async execute(interaction) {
        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setTitle('🗳️ Vote et gagne des récompenses!')
            .setDescription('Vote pour le serveur et gagne **100** 🪙 par vote!')
            .addFields(
                { 
                    name: '🌐 Disboard', 
                    value: '[Clique ici pour voter](https://disboard.org/server/1002926708086800394)', 
                    inline: true 
                },
                { 
                    name: '🎮 Top-Serveurs', 
                    value: '[Clique ici pour voter](https://top-serveurs.net/discord/vote/1002926708086800394)', 
                    inline: true 
                }
            )
            .setColor('#00ff00')
            .setFooter({ text: 'Tu peux voter toutes les 12 heures sur chaque site!' });

        await interaction.editReply({ embeds: [embed] });
    },
};