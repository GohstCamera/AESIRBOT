const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { getCasier, updateWarn } = require('../../utils/casier');
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
        const LOG_MODO = '1382779351891705866';
        
        if (!hasPermission(interaction, ['ModerateMembers'])) {
            return interaction.reply({
                content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const member = interaction.options.getMember('member');
            const index = interaction.options.getInteger('index') - 1; // On ajuste pour l'index du tableau
            const newReason = interaction.options.getString('reason');

            if (!member) {
                return interaction.editReply({ content: '❌ Ce membre n\'est pas sur le serveur.' });
            }

            const infractions = await getCasier(interaction.guild.id, member.id);
            const warns = infractions.filter(inf => inf.type.toUpperCase() === 'WARN');

            if (index < 0 || index >= warns.length) {
                return interaction.editReply({ content: '❌ Index invalide. Utilise la commande `/casier` pour voir les avertissements disponibles.' });
            }

            const targetInfraction = warns[index];

            // Utilise la nouvelle fonction updateWarn avec l'ID de la transaction
            await updateWarn(targetInfraction.id, newReason);

            const interactionEmbed = new EmbedBuilder()
                .setTitle('✏️ Avertissement modifié')
                .setDescription(`L’avertissement **#${index + 1}** de ${member} a été mis à jour.\n**Nouvelle raison :** ${newReason}`)
                .setColor('#ffa500');

            await interaction.editReply({ embeds: [interactionEmbed], ephemeral: false });

            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('✏️ Édition d\'un avertissement')
                    .setDescription(`
                        **Membre concerné :** ${member.user.tag} (${member.id})
                        **Modérateur :** ${interaction.user.tag} (${interaction.user.id})
                        **Avertissement modifié :** #${index + 1}
                        **Nouvelle raison :** ${newReason}
                    `)
                    .setTimestamp()
                    .setFooter({ text: `ID de l'avertissement : #${index + 1}` });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /warn-edit :', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ Une erreur est survenue lors de la modification de l'avertissement.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `❌ Une erreur est survenue lors de la modification de l'avertissement.`, ephemeral: true });
            }
        }
    }
};