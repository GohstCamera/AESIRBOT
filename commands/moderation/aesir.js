const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aesir')
    .setDescription('Découvre ce qu’est AESIR et comment fonctionne le Discord'),

  async execute(interaction) {
    const logChannelId = '1002927821154418738';
    const logChannel = interaction.client.channels.cache.get(logChannelId);

    const aesirEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('<a:pokemon_pizza:1170429849857446021>  Qu\'est-ce que AESIR ?')
      .setDescription(`\u200B\n**AESIR** est une association événementielle Clermontoise organisant des animations en ligne et en physique, ainsi qu'à l'avenir, des tournois esport !`)
      .addFields(
        {
          name: '\u200B\n<a:Squirtle_Hype:1071815271825801327>Qu\'est-ce que je peux faire sur le Discord ?',
          value: `\u200B\nC'est simple !\n\nPlus tu es actif sur le Discord (à l'écrit ou en vocal), plus tu gagnes de l'expérience et de l'argent fictif lié au serveur !

Une boutique est disponible où tu peux acheter toute sorte de choses, dont des cartes cadeau sur tes sites / jeux favoris <a:rave_cat:1071812785190735962>
Oui, oui, tu peux farm tes skins LOL ou Valo, voire même t'acheter un nouveau casque sur Amazon en étant actif chez nous !`

        },
        {
          name: '\u200B\n📎 Plus d’infos',
          value: '[Clique ici pour en savoir plus](https://discord.com/channels/1002926708086800394/1081624395828703252)'
        }
      )
      .setFooter({ text: 'AESIRBOT v2.0 • Codé avec ⚡ par Pierre' })
      .setTimestamp();

    // Réponse éphémère à l’utilisateur
    await interaction.reply({
      embeds: [aesirEmbed],
      ephemeral: true
    });

    // Log stylisé dans le salon dédié
    if (logChannel && logChannel.type === ChannelType.GuildText) {
      const logEmbed = new EmbedBuilder()
        .setColor(0x2b2d31) // Couleur plus sombre pour le log
        .setTitle('🧠 Exécution d\'une commande')
        .setDescription(`
            **${interaction.user.username}** vient d'exécuter la commande slash \`/aesir\`
            
            **Salon :** #${interaction.channel.name} (<#${interaction.channel.id}>)
        `)
        .setTimestamp()
        .setFooter({
          text: `AESIR • ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL()
        });

      await logChannel.send({ embeds: [logEmbed] });
    }
  }
};