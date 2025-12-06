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
        .setName('note')
        .setDescription('Ajoute une note à un utilisateur (se retrouve dans le casier)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre concerné par la note')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('note')
                .setDescription('La note à ajouter')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        // IDs des salons de logs
        const LOG_MODO = '1382779351891705866';

        // Vérification des permissions
        if (!hasPermission(interaction, ['ModerateMembers'])) {
            return interaction.reply({
                content: '❌ Tu n’as pas la permission d’ajouter des notes.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const member = interaction.options.getMember('member');
            const note = interaction.options.getString('note');

            if (!member) {
                return interaction.editReply({
                    content: '❌ Ce membre n\'est pas sur le serveur.',
                    ephemeral: true
                });
            }

            // Ajouter au casier
            await addToCasier({
                guildId: interaction.guild.id,
                userId: member.id,
                type: 'note',
                reason: note,
                modId: interaction.user.id
            });

            // Création de l'embed de réponse pour l'interaction
            const interactionEmbed = new EmbedBuilder()
                .setTitle('📝 Note ajoutée')
                .setDescription(
                    `Une note a été ajoutée pour l'utilisateur ${member}.\n` +
                    `**Note :** ${note}`
                )
                .setColor('#4287f5');

            await interaction.editReply({ embeds: [interactionEmbed] });

            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#87CEEB') // Bleu clair pour les notes
                    .setTitle('📝 Ajout d\'une note')
                    .setDescription(`
                        **Membre concerné :** ${member.user.tag} (${member.id})
                        **Modérateur :** ${interaction.user.tag} (${interaction.user.id})
                        **Note :** ${note}
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID : ${member.id}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /note :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue lors de l'ajout de la note : ${error.message}`,
                ephemeral: true
            });
        }
    },
};