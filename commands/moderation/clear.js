const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const hasPermission = require('../../utils/hasPermission');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre de messages dans ce salon')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Le nombre de messages à supprimer (max 100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)),
    
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
            const amount = interaction.options.getInteger('amount');
            
            // On gère les réponses différées ici, car la suppression peut prendre du temps
            await interaction.deferReply({ ephemeral: true }); // deferReply utilise encore l'ancienne syntaxe pour le moment

            const messages = await interaction.channel.bulkDelete(amount, true);
            const deletedCount = messages.size;

            // Log de l'exécution pour l'utilisateur
            const userEmbed = new EmbedBuilder()
                .setTitle('🧹 Messages supprimés')
                .setDescription(`J'ai supprimé **${deletedCount}** messages dans ce salon.`)
                .setColor('#ffa500');

            await interaction.editReply({ embeds: [userEmbed] });

            // Envoi de l'embed de log dans le salon LOG MODO
            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FF7F50') // Orange corail pour le clear
                    .setTitle('🧹 Suppression de messages')
                    .setDescription(`
                        **Salon :** <#${interaction.channel.id}>
                        **Nombre de messages :** ${deletedCount}
                        **Modérateur :** ${interaction.user.tag} (${interaction.user.id})
                    `)
                    .setTimestamp()
                    .setFooter({
                        text: `ID : ${interaction.user.id}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });
                    
                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error(error);
            let errorMessage = '❌ Une erreur est survenue lors de la suppression des messages.';
            
            // Gérer l'erreur spécifique si les messages sont trop vieux
            if (error.code === 50034) {
                errorMessage = '❌ Impossible de supprimer des messages datant de plus de 14 jours.';
            }

            // On utilise editReply ou reply selon si l'interaction a déjà été différée
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, flags: [ 1 << 6 ] });
            }
        }
    },
};