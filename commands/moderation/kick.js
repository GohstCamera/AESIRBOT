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
        const LOG_MODO = '1382779351891705866';
        
        if (!hasPermission(interaction, ['KickMembers'])) {
            return interaction.reply({
                content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const memberToKick = interaction.options.getMember('member');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            if (!memberToKick) {
                return interaction.editReply({ content: '❌ Ce membre n\'est pas sur le serveur.' });
            }
            if (memberToKick.id === interaction.user.id) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas vous expulser vous-même.' });
            }
            if (memberToKick.id === interaction.client.user.id) {
                return interaction.editReply({ content: '❌ Je ne peux pas m\'expulser moi-même.' });
            }
            if (!memberToKick.kickable) {
                return interaction.editReply({ content: '❌ Je ne peux pas expulser ce membre. Il a probablement un rôle plus élevé ou égal au mien.' });
            }
            
            try {
                const embedDM = new EmbedBuilder()
                    .setTitle('👢 Expulsion')
                    .setDescription(
                        `Vous avez été **expulsé** du serveur **${interaction.guild.name}**.\n` +
                        `**Raison :** ${reason}`
                    )
                    .setColor('#ff7f50');

                await memberToKick.send({ embeds: [embedDM] });
            } catch (error) {
                console.log(`❌ Impossible d'envoyer un message privé à ${memberToKick.user.tag}: ${error.message}`);
            }
            
            await memberToKick.kick(`${reason} (Expulsé par ${interaction.user.tag})`);

            await addToCasier({
                guildId: interaction.guild.id,
                userId: memberToKick.id,
                type: 'kick',
                reason,
                modId: interaction.user.id
            });

            const interactionEmbed = new EmbedBuilder()
                .setTitle('👢 Expulsion')
                .setDescription(`L'utilisateur ${memberToKick} a été expulsé du serveur.\n**Raison :** ${reason}`)
                .setColor('#ff7f50');

            await interaction.editReply({ embeds: [interactionEmbed], ephemeral: false });

            const logChannel = interaction.guild.channels.cache.get(LOG_MODO);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('👢 Expulsion d\'un membre')
                    .setDescription(`
                        **Membre expulsé :** ${memberToKick.user.tag} (${memberToKick.id})
                        **Par :** ${interaction.user.tag} (${interaction.user.id})
                        **Raison :** ${reason}
                    `)
                    .setTimestamp()
                    .setFooter({ text: `ID : ${memberToKick.id}` });

                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande /kick :', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ Une erreur est survenue lors de l'expulsion.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `❌ Une erreur est survenue lors de l'expulsion.`, ephemeral: true });
            }
        }
    }
};