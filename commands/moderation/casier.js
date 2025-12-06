const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { getCasier } = require('../../utils/casier');

// On retire l'importation de isOwner, et on garde hasPermission pour les autres utilisateurs
const hasPermission = require('../../utils/hasPermission'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casier')
        .setDescription('Voir toutes les infractions d\'un membre')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre dont vous voulez voir le casier')
                .setRequired(true)),

    async execute(interaction) {
        // IDs des salons de logs
        const LOG_MODO = '1382779351891705866';

        // L'unique vérification de permission dont on a besoin ici
        // La logique pour le propriétaire est maintenant dans index.js
        if (!hasPermission(interaction, [PermissionFlagsBits.KickMembers])) {
            return interaction.reply({
                content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('member');
            const userTag = user.tag;

            const infractions = await getCasier(interaction.guild.id, user.id);

            let embed;
            if (!infractions || infractions.length === 0) {
                embed = new EmbedBuilder()
                    .setTitle('✅ Casier Judiciaire')
                    .setDescription(`Le casier de **${userTag}** est vide.`)
                    .setColor('#2ecc71');
            } else {
                const infractionsList = infractions.map((infraction, index) => {
                    const date = new Date(infraction.date).toLocaleDateString('fr-FR');
                    return `**${index + 1}.** \`${infraction.type.toUpperCase()}\` le ${date}\n` +
                        `> **Raison :** ${infraction.reason || 'Non spécifiée'}\n` +
                        `> **Modérateur :** <@${infraction.modId}>\n`;
                }).join('\n');

                embed = new EmbedBuilder()
                    .setTitle(`📋 Casier de ${userTag}`)
                    .setDescription(`Nombre d'infractions : **${infractions.length}**\n\n${infractionsList}`)
                    .setColor('#e67e22');
            }

            await interaction.editReply({
                embeds: [embed],
            });

            // Log stylisé dans le salon LOG MODO
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#7289da')
                    .setTitle('🔍 Consultation de casier')
                    .setDescription(`
                        **Membre concerné :** ${user.tag} (${user.id})
                        **Consulté par :** ${interaction.user.tag} (${interaction.user.id})
                        **Nombre d'infractions :** ${infractions.length}
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID : ${user.id}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue lors de la consultation : ${error.message}`,
            });
        }
    },
};