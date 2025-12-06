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
        .setName('kick')
        .setDescription('Expulse un membre (se retrouve dans le casier)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre à expulser')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison de l\'expulsion')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

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

            const memberToKick = interaction.options.getMember('member');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            // Gérer les cas d'erreur avant toute action
            if (!memberToKick) {
                return interaction.editReply({
                    content: '❌ Ce membre n\'est pas sur le serveur.',
                    ephemeral: true
                });
            }
            if (memberToKick.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ Vous ne pouvez pas vous expulser vous-même.',
                    ephemeral: true
                });
            }
            if (memberToKick.id === interaction.client.user.id) {
                return interaction.editReply({
                    content: '❌ Je ne peux pas m\'expulser moi-même.',
                    ephemeral: true
                });
            }
            if (!memberToKick.kickable) {
                return interaction.editReply({
                    content: '❌ Je ne peux pas expulser ce membre. Il a probablement un rôle plus élevé ou égal au mien.',
                    ephemeral: true
                });
            }
            
            // Envoi d'un MP avant l'expulsion
            try {
                const embedDM = new EmbedBuilder()
                    .setTitle('👢 Expulsion')
                    .setDescription(
                        `Vous avez été **expulsé** du serveur **${interaction.guild.name}**.\n` +
                        `**Raison :** ${reason}`
                    )
                    .setColor('#ff7f50'); // Orange corail

                await memberToKick.send({ embeds: [embedDM] });
            } catch (error) {
                console.log(`❌ Impossible d'envoyer un message privé à ${memberToKick.user.tag}: ${error.message}`);
            }
            
            // Expulsion du membre et ajout au casier
            await memberToKick.kick(`${reason} (Expulsé par ${interaction.user.tag})`);
            await addToCasier({
                guildId: interaction.guild.id,
                userId: memberToKick.id,
                type: 'kick',
                reason,
                modId: interaction.user.id
            });

            // Création de l'embed de réponse pour l'interaction
            const interactionEmbed = new EmbedBuilder()
                .setTitle('👢 Expulsion')
                .setDescription(
                    `L'utilisateur ${memberToKick} a été expulsé du serveur.\n` +
                    `**Raison :** ${reason}`
                )
                .setColor('#ff7f50');

            await interaction.editReply({ embeds: [interactionEmbed] });

            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FFA500') // Orange
                    .setTitle('👢 Expulsion d\'un membre')
                    .setDescription(`
                        **Membre expulsé :** ${memberToKick.user.tag} (${memberToKick.id})
                        **Par :** ${interaction.user.tag} (${interaction.user.id})
                        **Raison :** ${reason}
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID : ${memberToKick.id}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /kick :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue lors de l'expulsion. Veuillez vérifier les permissions ou réessayer plus tard.`,
                ephemeral: true
            });
        }
    }
};