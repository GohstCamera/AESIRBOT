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
        .setName('unwarn')
        .setDescription('Supprime un avertissement du casier d’un membre')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre dont tu veux retirer un avertissement')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('index')
                .setDescription('Numéro de l’avertissement à retirer (voir /casier)')
                .setRequired(true)
                .setMinValue(1)), // L'index commence à 1 pour l'utilisateur
        
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

            const targetInfraction = warns[index];
            const updatedInfractions = infractions.filter(inf => inf !== targetInfraction);

            await saveCasier(interaction.guild.id, member.id, updatedInfractions);

            // Création de l'embed de réponse pour l'interaction
            const interactionEmbed = new EmbedBuilder()
                .setTitle('✅ Avertissement retiré')
                .setDescription(`L’avertissement **#${index + 1}** de ${member} a été retiré.\n**Raison retirée :** ${targetInfraction.reason}`)
                .setColor('#2ecc71'); // Vert pour l'action positive

            await interaction.editReply({ embeds: [interactionEmbed] });

            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#00ff00') // Vert
                    .setTitle('✅ Retrait d\'un avertissement')
                    .setDescription(`
                        **Membre concerné :** ${member.user.tag} (${member.id})
                        **Modérateur :** ${interaction.user.tag} (${interaction.user.id})
                        **Raison de l'avertissement :** ${targetInfraction.reason}
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID de l'avertissement : #${index + 1}`
                    });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /unwarn :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue : ${error.message}`,
                ephemeral: true
            });
        }
    }
};