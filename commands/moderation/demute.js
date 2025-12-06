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
        .setName('demute')
        .setDescription('Retire le mute d\'un membre (se retrouve dans le casier)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre à démute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du démute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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

            const member = interaction.options.getMember('member');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            if (!member) {
                return interaction.editReply({
                    content: '❌ Ce membre n\'est pas sur le serveur.',
                    ephemeral: true
                });
            }

            if (!member.isCommunicationDisabled()) {
                return interaction.editReply({
                    content: '❌ Ce membre n\'est pas mute.',
                    ephemeral: true
                });
            }

            // Retirer le timeout
            await member.timeout(null, reason);

            // Envoie un MP pour le démute
            try {
                const embedDM = new EmbedBuilder()
                    .setTitle('🔊 Démute')
                    .setDescription(
                        `Votre mute sur le serveur **${interaction.guild.name}** a été retiré.\n` +
                        `**Raison :** ${reason}`
                    )
                    .setColor('#00ff00');
                await member.send({ embeds: [embedDM] });
            } catch {
                console.log(`❌ Impossible d'envoyer un message privé à ${member.user.tag}.`);
            }

            // Ajouter au casier
            await addToCasier({
                guildId: interaction.guild.id,
                userId: member.id,
                type: 'unmute',
                reason,
                modId: interaction.user.id
            });

            // Création de l'embed de réponse
            const interactionEmbed = new EmbedBuilder()
                .setTitle('🔊 Démute')
                .setDescription(`L'utilisateur ${member} a été démute.\n**Raison :** ${reason}`)
                .setColor('#28a745');

            await interaction.editReply({ embeds: [interactionEmbed] });

            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#00ff00') // Vert
                    .setTitle('🔊 Démute d\'un membre')
                    .setDescription(`
                        **Membre démute :** ${member.user.tag} (${member.id})
                        **Par :** ${interaction.user.tag} (${interaction.user.id})
                        **Raison :** ${reason}
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID : ${member.id}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /demute :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue lors du démute : ${error.message}`,
                ephemeral: true
            });
        }
    },
};