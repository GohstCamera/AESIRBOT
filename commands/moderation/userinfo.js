const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const hasPermission = require('../../utils/hasPermission');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Affiche des infos sur un membre')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre dont vous voulez voir les infos')
                .setRequired(false)),
        // Retiré setDefaultMemberPermissions, la commande n'est pas une action de modération

    async execute(interaction) {
        // IDs des salons de logs
        const LOG_BOT_ALL = '1002927821154418738';
        
        // On retire la vérification de permissions, car c'est une commande d'information
        // if (!isOwner(interaction.user.id) && !interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        //     return interaction.reply({
        //         content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
        //         ephemeral: true
        //     });
        // }

        try {
            await interaction.deferReply(); // Réponse immédiate

            const member = interaction.options.getMember('member') || interaction.member;
            const user = member.user;

            const embed = new EmbedBuilder()
                .setTitle(`ℹ️ Infos sur ${user.tag}`)
                .setColor(member.displayColor || '#2f3136')
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setFooter({
                    text: `Demandé par ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            // Infos de base
            embed.addFields(
                { name: 'ID', value: user.id, inline: true },
                { name: 'Nom d\'utilisateur', value: user.username, inline: true },
                { name: 'Tag', value: user.discriminator, inline: true }
            );

            // Dates
            embed.addFields(
                { name: 'Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
                { name: 'A rejoint le', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'N/A', inline: true }
            );

            // Statut
            const statusMap = {
                online: '🟢 En ligne',
                idle: '🌙 Inactif',
                dnd: '⛔ Ne pas déranger',
                offline: '⚫ Hors ligne'
            };
            embed.addFields({
                name: 'Statut',
                value: statusMap[member.presence?.status || 'offline'],
                inline: true
            });

            // Rôles
            const roles = member.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString());

            if (roles.length) {
                embed.addFields({
                    name: `Rôles [${roles.length}]`,
                    value: roles.join(' '),
                    inline: false
                });
            }

            // Permissions clés
            const keyPermissions = [];
            if (member.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('👑 Administrateur');
            if (member.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('🔨 Bannir');
            if (member.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('👢 Expulser');
            if (member.permissions.has(PermissionFlagsBits.ManageMessages)) keyPermissions.push('📝 Gérer messages');

            if (keyPermissions.length) {
                embed.addFields({
                    name: 'Permissions clés',
                    value: keyPermissions.join('\n'),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
            
            // Création de l'embed de log pour le salon LOG_BOT_ALL
            const logChannel = interaction.guild.channels.cache.get(LOG_BOT_ALL);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#7289DA') // Bleu Discord
                    .setTitle('👤 Exécution de commande')
                    .setDescription(`
                        **Commande :** \`/userinfo\`
                        **Utilisateur :** ${interaction.user.tag} (${interaction.user.id})
                        **Cible :** ${member.user.tag} (${member.id})
                        **Salon :** <#${interaction.channel.id}>
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID de l'interaction : ${interaction.id}`
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /userinfo :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue : ${error.message}`,
                ephemeral: true
            });
        }
    },
};