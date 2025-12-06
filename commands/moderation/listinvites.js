const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listinvites')
        .setDescription('Affiche toutes les invitations de clan en attente sur le serveur.'),
        // La permission est maintenant vérifiée dans le code pour plus de flexibilité

    async execute(interaction) {
        const requiredRoleId = '1002927692489969724';
        const member = interaction.member;
        const hasRole = member.roles.cache.has(requiredRoleId);
        const hasAdminPermission = member.permissions.has(PermissionFlagsBits.ManageGuild);
        const isOwner = interaction.user.id === process.env.OWNER_ID;

        // --- Vérification des permissions ---
        if (!hasRole && !hasAdminPermission && !isOwner) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const pendingInvites = await prisma.crewInvite.findMany({
                where: {
                    status: 'PENDING'
                },
                include: {
                    inviter: {
                        select: { id: true, username: true }
                    },
                    recipient: {
                        select: { id: true, username: true }
                    },
                    crew: {
                        select: { name: true, emoji: true }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            if (pendingInvites.length === 0) {
                return interaction.editReply({ content: '✅ Aucune invitation de clan n\'est actuellement en attente.' });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📬 Invitations de clan en attente (${pendingInvites.length})`)
                .setColor('#3498db')
                .setTimestamp();

            let description = '';
            for (const invite of pendingInvites) {
                const inviterName = invite.inviter?.username || 'Inconnu';
                const recipientName = invite.recipient?.username || 'Inconnu';
                const crewName = invite.crew?.name || 'Clan supprimé';
                description += `**De :** ${inviterName} | **À :** ${recipientName} | **Clan :** ${crewName}\n`;
            }

            embed.setDescription(description);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de la récupération des invitations :', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la récupération de la liste des invitations.' });
        }
    },
};