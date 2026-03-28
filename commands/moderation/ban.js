const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField,
    ChannelType
} = require('discord.js');
const { addToCasier } = require('../../utils/casier');
const hasPermission = require('../../utils/hasPermission');

const CONTACT_UNBAN = 'support@aesir-event.fr';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un membre (se retrouve dans le casier)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre à bannir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du ban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),

    async execute(interaction) {
        const logChannelId = '1382779351891705866';

        if (!hasPermission(interaction, ['BanMembers'])) {
            return interaction.reply({
                content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.',
                ephemeral: true
            });
        }

        // deferReply est important pour les actions qui peuvent prendre du temps
        await interaction.deferReply({ ephemeral: true });

        try {
            const memberToBan = interaction.options.getMember('member');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            if (!memberToBan) {
                return interaction.editReply({ content: '❌ Ce membre n\'est pas sur le serveur.' });
            }

            if (memberToBan.id === interaction.user.id) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas vous bannir vous-même.' });
            }

            if (!memberToBan.bannable) {
                return interaction.editReply({ content: '❌ Je ne peux pas bannir ce membre. Il a probablement des permissions plus élevées que moi.' });
            }

            try {
                const embedDM = new EmbedBuilder()
                    .setTitle('🔨 Bannissement')
                    .setDescription(
                        `Vous avez été **banni** du serveur **${interaction.guild.name}**.\n` +
                        `**Raison :** ${reason}\n\n` +
                        `Pour faire une demande de débannissement, envoyez un email à ${CONTACT_UNBAN}.`
                    )
                    .setColor('#ff0000');

                await memberToBan.send({ embeds: [embedDM] });
            } catch (error) {
                console.log(`❌ Impossible d'envoyer un message privé à ${memberToBan.user.tag}.`);
            }

            // Ban le membre
            await memberToBan.ban({ reason: `${reason} (Banni par ${interaction.user.tag})` });

            // Ajoute au casier via la nouvelle fonction SQL
            await addToCasier({
                guildId: interaction.guild.id,
                userId: memberToBan.id,
                type: 'ban',
                reason: reason,
                modId: interaction.user.id
            });

            const embed = new EmbedBuilder()
                .setTitle('🔨 Bannissement')
                .setDescription(`L'utilisateur ${memberToBan} a été banni.\n**Raison :** ${reason}`)
                .setColor('#ff0000');

            // Répondre publiquement (ou en éphémère si vous préférez)
            await interaction.editReply({ embeds: [embed], ephemeral: false });

            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🔨 Bannissement d\'un membre')
                    .setDescription(`
                        **Membre banni :** ${memberToBan.user.tag} (${memberToBan.id})
                        **Par :** ${interaction.user.tag} (${interaction.user.id})
                        **Raison :** ${reason}
                    `)
                    .setTimestamp()
                    .setFooter({ text: `ID : ${memberToBan.id}` });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de la commande ban:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Une erreur est survenue lors du bannissement.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Une erreur est survenue lors du bannissement.', ephemeral: true });
            }
        }
    }
};