const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { addToCasier, getCasier } = require('../../utils/casier');
const hasPermission = require('../../utils/hasPermission');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertit un membre (se retrouve dans le casier)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre à avertir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison de l\'avertissement')
                .setRequired(false)),

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
            await interaction.deferReply(); // Réponse immédiate

            const memberToWarn = interaction.options.getMember('member');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            // Vérifications en amont
            if (!memberToWarn) {
                return interaction.editReply({
                    content: '❌ Ce membre n\'est pas sur le serveur.',
                    ephemeral: true
                });
            }
            if (memberToWarn.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ Vous ne pouvez pas vous avertir vous-même.',
                    ephemeral: true
                });
            }

            // Envoie un MP au membre averti
            try {
                const embedDM = new EmbedBuilder()
                    .setTitle('⚠️ Avertissement')
                    .setDescription(
                        `Vous avez reçu un **avertissement** sur le serveur **${interaction.guild.name}**.\n` +
                        `**Raison :** ${reason}`
                    )
                    .setColor('#ffd700');
                await memberToWarn.send({ embeds: [embedDM] });
            } catch {
                console.log(`❌ Impossible d'envoyer un message privé à ${memberToWarn.user.tag}.`);
            }

            // Ajout au casier
            await addToCasier({
                guildId: interaction.guild.id,
                userId: memberToWarn.id,
                type: 'warn',
                reason,
                modId: interaction.user.id
            });

            // Vérification du nombre d'avertissements pour l'embed de réponse
            const infractions = await getCasier(interaction.guild.id, memberToWarn.id);
            const warnCount = infractions.filter(inf => inf.type === 'warn').length;

            const interactionEmbed = new EmbedBuilder()
                .setTitle('⚠️ Avertissement')
                .setDescription(
                    `L'utilisateur ${memberToWarn} a reçu un avertissement.\n` +
                    `**Raison :** ${reason}\n` +
                    `**Total d'avertissements :** ${warnCount}`
                )
                .setColor(warnCount >= 3 ? '#ff0000' : warnCount === 2 ? '#ffa500' : '#ffd700');

            await interaction.editReply({ embeds: [interactionEmbed] });
            
            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FFD700') // Jaune
                    .setTitle('⚠️ Avertissement d\'un membre')
                    .setDescription(`
                        **Membre averti :** ${memberToWarn.user.tag} (${memberToWarn.id})
                        **Par :** ${interaction.user.tag} (${interaction.user.id})
                        **Raison :** ${reason}
                        **Total d'avertissements :** ${warnCount}
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID : ${memberToWarn.id}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

            // Message supplémentaire si 3+ avertissements
            if (warnCount >= 3) {
                try {
                    const embedDM = new EmbedBuilder()
                        .setTitle('⚠️ Avertissements multiples')
                        .setDescription(
                            `Vous avez atteint **${warnCount} avertissements** sur le serveur **${interaction.guild.name}**.\n` +
                            'Le prochain avertissement pourra entraîner un kick ou un ban.'
                        )
                        .setColor('#ff0000');
                    await memberToWarn.send({ embeds: [embedDM] });
                } catch {
                    console.log(`❌ Impossible d'envoyer le deuxième message privé à ${memberToWarn.user.tag}.`);
                }
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /warn :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue lors de l'avertissement : ${error.message}`,
                ephemeral: true
            });
        }
    }
};