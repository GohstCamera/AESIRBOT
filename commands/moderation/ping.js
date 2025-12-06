const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const hasPermission = require('../../utils/hasPermission');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Affiche la latence du bot'),

    async execute(interaction) {
        // IDs des salons de logs
        const LOG_BOT_ALL = '1002927821154418738';
        
        // La commande /ping ne nécessite pas de permission spéciale.
        // On retire la vérification pour la rendre accessible à tous les membres.
        
        try {
            const embed = new EmbedBuilder()
                .setTitle('🏓 Pong!')
                .setDescription(`Latence du bot : **${interaction.client.ws.ping}ms**`)
                .setColor('#2f3136')
                .setTimestamp()
                .setFooter({
                    text: `Demandé par ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            await interaction.reply({ embeds: [embed] });

            // Création de l'embed de log pour le salon LOG_BOT_ALL
            const logChannel = interaction.guild.channels.cache.get(LOG_BOT_ALL);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#7289DA') // Bleu Discord
                    .setTitle('🏓 Exécution de commande')
                    .setDescription(`
                        **Commande :** \`/ping\`
                        **Utilisateur :** ${interaction.user.tag} (${interaction.user.id})
                        **Salon :** <#${interaction.channel.id}>
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID de l'interaction : ${interaction.id}`
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /ping :', error);
            await interaction.reply({
                content: `❌ Une erreur est survenue : ${error.message}`,
                ephemeral: true
            });
        }
    },
};