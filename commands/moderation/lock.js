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
        .setName('lock')
        .setDescription('Verrouille ou déverrouille le salon')
        .addBooleanOption(option =>
            option.setName('state')
                .setDescription('true = verrouiller, false = déverrouiller')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        // IDs des salons de logs
        const LOG_MODO = '1382779351891705866';

        // Vérification des permissions
        if (!hasPermission(interaction, ['ModerateMembers'])) {
            return interaction.reply({
                content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
                flags: [ 1 << 6 ]
            });
        }

        try {
            await interaction.deferReply();

            const shouldLock = interaction.options.getBoolean('state');
            const channel = interaction.channel;
            const everyoneRole = interaction.guild.roles.everyone;
            
            const currentPermissions = channel.permissionsFor(everyoneRole);
            const isCurrentlyLocked = !currentPermissions.has(PermissionFlagsBits.SendMessages);

            if (shouldLock && isCurrentlyLocked) {
                return interaction.editReply({
                    content: '❌ Le salon est déjà verrouillé.',
                    // ephemeral est géré par deferReply
                });
            }
            if (!shouldLock && !isCurrentlyLocked) {
                 return interaction.editReply({
                    content: '❌ Le salon est déjà déverrouillé.',
                    // ephemeral est géré par deferReply
                });
            }

            // Mettre à jour les permissions du salon
            await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: !shouldLock
            });

            const actionType = shouldLock ? 'lock' : 'unlock';
            const reason = `Salon ${shouldLock ? 'verrouillé' : 'déverrouillé'} par modération`;

            // Ajouter au casier
            await addToCasier({
                guildId: interaction.guild.id,
                userId: channel.id,
                type: actionType,
                reason,
                modId: interaction.user.id
            });
            
            // Création de l'embed de réponse pour l'interaction
            const interactionEmbed = new EmbedBuilder()
                .setTitle(shouldLock ? '🔒 Salon verrouillé' : '🔓 Salon déverrouillé')
                .setDescription(shouldLock
                    ? `Le salon <#${channel.id}> a été **verrouillé**.\nSeul le staff peut envoyer des messages.`
                    : `Le salon <#${channel.id}> a été **déverrouillé**.\nTout le monde peut envoyer des messages.`
                )
                .setColor(shouldLock ? '#ff0000' : '#00ff00');

            await interaction.editReply({ embeds: [interactionEmbed] });
            
            // Création de l'embed de log pour le salon de modération
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor(shouldLock ? '#FF7F50' : '#00ff00')
                    .setTitle(shouldLock ? '🔒 Verrouillage de salon' : '🔓 Déverrouillage de salon')
                    .setDescription(`
                        **Salon :** <#${channel.id}>
                        **Action :** ${shouldLock ? 'Verrouillé' : 'Déverrouillé'}
                        **Modérateur :** ${interaction.user.tag} (${interaction.user.id})
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID : ${channel.id}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /lock :', error);
            await interaction.editReply({
                content: `❌ Une erreur est survenue : ${error.message}`,
                // ephemeral est géré par deferReply
            });
        }
    }
};