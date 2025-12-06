const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Envoie !kodai <@mention>')
    .addUserOption(option =>
      option.setName('utilisateur')
        .setDescription('Mentionne un utilisateur')
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('utilisateur');

    // Envoie le message dans le même salon que la commande
    await interaction.channel.send(`!kodai <@${user.id}>`);

    // Répond à l'interaction (optionnel)
    await interaction.reply({ content: `Commande envoyée pour ${user.username}`, ephemeral: true });
  }
};
