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
        .setName('deban')
        .setDescription('Révoque le bannissement d\'un utilisateur (se retrouve dans le casier)')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('L\'ID de l\'utilisateur à débannir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du débannissement')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

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
            await interaction.deferReply(); // Réponse immédiate pour éviter le timeout

            const userId = interaction.options.getString('userid');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            // Vérifier si l'ID est valide (un nombre)
            if (isNaN(userId)) {
                 return interaction.editReply({
                    content: '❌ L\'ID de l\'utilisateur doit être un nombre valide.',
                    ephemeral: true
                });
            }

            // Vérifier si l'utilisateur est banni
            const bannedUser = await interaction.guild.bans.fetch(userId).catch(() => null);

            if (!bannedUser) {
                return interaction.editReply({
                    content: '❌ Cet utilisateur n\'est pas banni sur ce serveur.',
                    ephemeral: true
                });
            }
            
            // Débannir l'utilisateur
            await interaction.guild.members.unban(userId, `Débanni par ${interaction.user.tag} - ${reason}`);

            // Ajouter au casier (type 'unban')
            await addToCasier({
                guildId: interaction.guild.id,
                userId: userId,
                type: 'unban',
                reason: reason,
                modId: interaction.user.id
            });
            
            // Création de l'embed de réponse pour l'interaction
            const interactionEmbed = new EmbedBuilder()
                .setTitle('🔓 Débannissement')
                .setDescription(`L'utilisateur **${bannedUser.user.tag}** (<@${userId}>) a été débanni.\n**Raison :** ${reason}`)
                .setColor('#28a745'); // Vert pour succès

            await interaction.editReply({ embeds: [interactionEmbed] });

            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#00ff00') // Vert
                    .setTitle('🔓 Débannissement d\'un membre')
                    .setDescription(`
                        **Membre débanni :** ${bannedUser.user.tag} (${userId})
                        **Par :** ${interaction.user.tag} (${interaction.user.id})
                        **Raison :** ${reason}
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID : ${userId}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /deban :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue lors du débannissement : ${error.message}`,
                ephemeral: true
            });
        }
    }
};