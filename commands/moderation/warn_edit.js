const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { getCasier, saveCasier } = require('../../utils/casier');
const hasPermission = require('../../utils/hasPermission');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn-edit')
        .setDescription('Modifie la raison d’un avertissement dans le casier')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre concerné')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('index')
                .setDescription('Numéro de l’avertissement à modifier (voir /casier)')
                .setRequired(true)
                .setMinValue(1)) // L'index commence à 1 pour l'utilisateur
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Nouvelle raison')
                .setRequired(true)),
        
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
            await interaction.deferReply(); // Réponse différée

            const member = interaction.options.getMember('member');
            const index = interaction.options.getInteger('index') - 1; // On ajuste pour l'index du tableau
            const newReason = interaction.options.getString('reason');

            if (!member) {
                return interaction.editReply({
                    content: '❌ Ce membre n\'est pas sur le serveur.',
                    ephemeral: true
                });
            }

            const infractions = await getCasier(interaction.guild.id, member.id);
            const warns = infractions.filter(inf => inf.type === 'warn');

            if (index < 0 || index >= warns.length) {
                return interaction.editReply({
                    content: '❌ Index invalide. Utilise la commande `/casier` pour voir les avertissements disponibles.',
                    ephemeral: true
                });
            }

            // Trouver l'avertissement d'origine dans la liste complète
            const originalWarn = warns[index];
            const originalIndex = infractions.findIndex(inf => 
                inf.type === 'warn' && 
                inf.date === originalWarn.date && 
                inf.reason === originalWarn.reason && 
                inf.modId === originalWarn.modId
            );

            // Mettre à jour la raison
            if (originalIndex !== -1) {
                infractions[originalIndex].reason = newReason;
            }

            await saveCasier(interaction.guild.id, member.id, infractions);

            // Création de l'embed de réponse pour l'interaction
            const interactionEmbed = new EmbedBuilder()
                .setTitle('✏️ Avertissement modifié')
                .setDescription(`L’avertissement **#${index + 1}** de ${member} a été mis à jour.\n**Nouvelle raison :** ${newReason}`)
                .setColor('#ffa500'); // Orange pour l'action de modification

            await interaction.editReply({ embeds: [interactionEmbed] });

            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FFD700') // Jaune pour l'édition
                    .setTitle('✏️ Édition d\'un avertissement')
                    .setDescription(`
                        **Membre concerné :** ${member.user.tag} (${member.id})
                        **Modérateur :** ${interaction.user.tag} (${interaction.user.id})
                        **Avertissement modifié :** #${index + 1}
                        **Nouvelle raison :** ${newReason}
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID de l'avertissement : #${index + 1}`
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /warn-edit :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue lors de la modification de l'avertissement : ${error.message}`,
                ephemeral: true
            });
        }
    }
};