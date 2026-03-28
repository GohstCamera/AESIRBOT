const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField,
    ChannelType
} = require('discord.js');
const { addToCasier } = require('../../utils/casier');
const hasPermission = require('../../utils/hasPermission');

const CONTACT_MUTE = 'support@aesir-event.fr';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Réduit au silence un membre (se retrouve dans le casier)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre à réduire au silence')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du mute')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Durée en minutes (max 28 jours)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(40320)) // 28 jours en minutes
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

    async execute(interaction) {
        const LOG_MODO = '1382779351891705866';

        if (!hasPermission(interaction, ['ModerateMembers'])) {
            return interaction.reply({
                content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const memberToMute = interaction.options.getMember('member');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
            const duration = interaction.options.getInteger('duration');

            if (!memberToMute) {
                return interaction.editReply({ content: '❌ Ce membre n\'est pas sur le serveur.' });
            }

            if (memberToMute.id === interaction.user.id) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas vous mute vous-même.' });
            }

            if (memberToMute.isCommunicationDisabled()) {
                return interaction.editReply({ content: '❌ Ce membre est déjà mute.' });
            }

            if (!memberToMute.moderatable) {
                return interaction.editReply({ content: '❌ Je ne peux pas mute ce membre. Il a probablement des permissions plus élevées que moi.' });
            }

            const durationInMs = duration ? duration * 60 * 1000 : null;
            const durationText = duration ? `${duration} minutes` : 'Permanent';

            try {
                const embedDM = new EmbedBuilder()
                    .setTitle('🔇 Mute')
                    .setDescription(
                        `Vous avez été **réduit au silence** sur le serveur **${interaction.guild.name}**.\n` +
                        `**Raison :** ${reason}\n` +
                        `**Durée :** ${durationText}\n\n` +
                        `Pour toute demande, envoyez un mail à cette adresse : ${CONTACT_MUTE}.`
                    )
                    .setColor('#ff0000');
                await memberToMute.send({ embeds: [embedDM] });
            } catch {
                console.log(`❌ Impossible d'envoyer un message privé à ${memberToMute.user.tag}.`);
            }

            await memberToMute.timeout(durationInMs, reason);

            await addToCasier({
                guildId: interaction.guild.id,
                userId: memberToMute.id,
                type: 'mute',
                reason: `${reason}${duration ? ` (Durée: ${duration} minutes)` : ' (Permanent)'}`,
                modId: interaction.user.id
            });
            
            const interactionEmbed = new EmbedBuilder()
                .setTitle('🔇 Mute')
                .setDescription(
                    `L'utilisateur ${memberToMute} a été réduit au silence.\n` +
                    `**Raison :** ${reason}\n` +
                    `**Durée :** ${durationText}`
                )
                .setColor('#ff0000');

            await interaction.editReply({ embeds: [interactionEmbed], ephemeral: false });

            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🔇 Mute d\'un membre')
                    .setDescription(`
                        **Membre mute :** ${memberToMute.user.tag} (${memberToMute.id})
                        **Par :** ${interaction.user.tag} (${interaction.user.id})
                        **Raison :** ${reason}
                        **Durée :** ${durationText}
                    `)
                    .setTimestamp()
                    .setFooter({ text: `ID : ${memberToMute.id}` });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /mute :', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ Une erreur est survenue lors du mute.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `❌ Une erreur est survenue lors du mute.`, ephemeral: true });
            }
        }
    }
};