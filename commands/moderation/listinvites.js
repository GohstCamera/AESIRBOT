const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listinvites')
        .setDescription('Affiche toutes les invitations de clan en attente sur le serveur.'),

    async execute(interaction) {
        const requiredRoleId = '1002927692489969724';
        const member = interaction.member;
        const hasRole = member.roles.cache.has(requiredRoleId);
        const hasAdminPermission = member.permissions.has(PermissionFlagsBits.ManageGuild);
        const isOwner = interaction.user.id === process.env.OWNER_ID;

        if (!hasRole && !hasAdminPermission && !isOwner) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Jointure SQL pour récupérer les noms des utilisateurs et du clan
            const query = `
                SELECT
                    ci.id, ci.createdAt,
                    u_inv.username AS inviterName,
                    u_rec.username AS recipientName,
                    c.name AS crewName
                FROM CrewInvite ci
                LEFT JOIN User u_inv ON ci.inviterId = u_inv.id
                LEFT JOIN User u_rec ON ci.recipientId = u_rec.id
                LEFT JOIN Crew c ON ci.crewId = c.id
                WHERE ci.status = 'PENDING'
                ORDER BY ci.createdAt DESC
            `;

            const [pendingInvites] = await db.execute(query);

            if (pendingInvites.length === 0) {
                return interaction.editReply({ content: '✅ Aucune invitation de clan n\'est actuellement en attente.' });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📬 Invitations de clan en attente (${pendingInvites.length})`)
                .setColor('#3498db')
                .setTimestamp();

            let description = '';
            for (const invite of pendingInvites) {
                const inviterName = invite.inviterName || 'Inconnu';
                const recipientName = invite.recipientName || 'Inconnu';
                const crewName = invite.crewName || 'Clan supprimé';
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