const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { addToCasier } = require('../../utils/casier');
const hasPermission = require('../../utils/hasPermission');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Définit le mode lent dans ce salon')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Durée en secondes (0 pour désactiver)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)), // 6 heures

    async execute(interaction) {
        // IDs des salons de logs
        const LOG_MODO = '1382779351891705866';

        // Vérification des permissions
        if (!hasPermission(interaction, ['ModerateMembers'])) {
            return interaction.reply({
                content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            const seconds = interaction.options.getInteger('seconds');

            // Vérification si le slowmode est déjà dans l'état souhaité
            if (interaction.channel.rateLimitPerUser === seconds) {
                return interaction.editReply({
                    content: `❌ Le mode lent est déjà défini sur ${seconds} secondes.`,
                    ephemeral: true
                });
            }

            // Appliquer le mode lent
            await interaction.channel.setRateLimitPerUser(seconds, `Mode lent défini par ${interaction.user.tag}`);

            // Définir les variables pour les messages et le casier
            const actionText = seconds === 0 ? 'désactivé' : `défini sur ${seconds} secondes`;
            const logColor = seconds === 0 ? '#00ff00' : '#ffa500';

            // Ajouter au casier
            await addToCasier({
                guildId: interaction.guild.id,
                userId: interaction.channel.id,
                type: 'slowmode',
                reason: `Mode lent ${actionText}`,
                modId: interaction.user.id
            });

            // Création de l'embed de réponse pour l'interaction
            const interactionEmbed = new EmbedBuilder()
                .setTitle('⏱️ Mode lent')
                .setDescription(`Le mode lent du salon a été ${actionText}.`)
                .setColor(logColor);

            await interaction.editReply({ embeds: [interactionEmbed] });

            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor(logColor)
                    .setTitle('⏱️ Modification du mode lent')
                    .setDescription(`
                        **Salon :** <#${interaction.channel.id}>
                        **Action :** Mode lent ${actionText}
                        **Modérateur :** ${interaction.user.tag} (${interaction.user.id})
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID du salon : ${interaction.channel.id}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /slowmode :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue : ${error.message}`,
                ephemeral: true
            });
        }
    },
};