const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const hasPermission = require('../../utils/hasPermission');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Affiche des informations sur le serveur'),
        // On retire setDefaultMemberPermissions, la commande est accessible à tous.

    async execute(interaction) {
        // IDs des salons de logs
        const LOG_BOT_ALL = '1002927821154418738';

        // La commande /serverinfo ne nécessite pas de permission spéciale.
        // On retire la vérification pour la rendre accessible à tous les membres.
        // if (!isOwner(interaction.user.id) && !interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        //     return interaction.reply({
        //         content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
        //         ephemeral: true
        //     });
        // }

        try {
            const { guild } = interaction;
            
            // On utilise deferReply pour une réponse immédiate
            await interaction.deferReply();

            const verificationLevels = {
                0: 'Aucun',
                1: 'Faible',
                2: 'Moyen',
                3: 'Élevé',
                4: 'Très élevé'
            };

            const embed = new EmbedBuilder()
                .setTitle(`🌐 Infos sur ${guild.name}`)
                .setColor('#2f3136')
                .addFields(
                    { name: 'ID', value: guild.id, inline: true },
                    { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
                    { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                    { name: 'Membres', value: guild.memberCount.toString(), inline: true },
                    { name: 'Salons', value: guild.channels.cache.size.toString(), inline: true },
                    { name: 'Rôles', value: guild.roles.cache.size.toString(), inline: true },
                    { name: 'Niveau de vérification', value: verificationLevels[guild.verificationLevel], inline: true },
                    { name: 'Région', value: guild.preferredLocale, inline: true }
                )
                .setFooter({
                    text: `Demandé par ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            if (guild.iconURL()) {
                embed.setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }));
            }

            if (guild.bannerURL()) {
                embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
            }
            
            await interaction.editReply({ embeds: [embed] });
            
            // Création de l'embed de log pour le salon LOG_BOT_ALL
            const logChannel = interaction.guild.channels.cache.get(LOG_BOT_ALL);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#7289DA') // Bleu Discord
                    .setTitle('🌐 Exécution de commande')
                    .setDescription(`
                        **Commande :** \`/serverinfo\`
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
            console.error('Erreur lors de l\'exécution de la commande /serverinfo :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue : ${error.message}`,
                ephemeral: true
            });
        }
    },
};