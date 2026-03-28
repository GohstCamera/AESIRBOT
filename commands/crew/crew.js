const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database');

const CREW_ROLES = {
    CAPTAIN: 'Capitaine 👑',
    OFFICER: 'Officier ⭐',
    MEMBER: 'Membre ⚓',
};

async function getPendingInvitationsCount(userId) {
    const [rows] = await db.execute('SELECT COUNT(*) as count FROM CrewInvite WHERE recipientId = ? AND status = \'PENDING\'', [userId]);
    return rows[0].count;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crew')
        .setDescription('Ouvre le menu principal pour les clans.'), 

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const [userRows] = await db.execute('SELECT crewId, crewRole FROM User WHERE id = ?', [interaction.user.id]);
            const user = userRows[0];

            if (user && user.crewId) {
                const [crewRows] = await db.execute('SELECT * FROM Crew WHERE id = ?', [user.crewId]);
                const crew = crewRows[0];

                const [memberRows] = await db.execute('SELECT id, username, crewRole FROM User WHERE crewId = ?', [user.crewId]);

                const userRoleDisplay = CREW_ROLES[user.crewRole] || CREW_ROLES.MEMBER;

                let memberList = [];
                const discordClient = interaction.client;

                memberRows.forEach(member => {
                    const memberRoleDisplay = CREW_ROLES[member.crewRole] || CREW_ROLES.MEMBER;
                    const memberTag = discordClient.users.cache.get(member.id)?.tag || member.username || `ID:${member.id}`;
                    memberList.push(`- **${memberTag}** (${memberRoleDisplay})`);
                });
                
                let memberListString = memberList.join('\n');
                if (memberListString.length > 1024) {
                    memberListString = memberListString.substring(0, 1020) + '\n...';
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${crew.emoji || '⚓'} ${crew.name} - Tableau de Bord`) 
                    .setDescription(crew.description || 'Pas de description définie pour ce clan.')
                    .addFields(
                        { name: `\u200B`, value: `\u200B`, inline: false }, 
                        { name: '👤 Votre Rôle', value: `> ${userRoleDisplay}`, inline: true },
                        { name: '💪 Puissance Totale', value: `> ${crew.power?.toLocaleString() || 0} 💪`, inline: true },
                        { name: '🧑‍🤝‍🧑 Membres', value: `> ${memberRows.length} (Max: 10)`, inline: true },
                        { name: `\u200B`, value: `\u200B`, inline: false }, 
                        { name: '💎 Diamants du Clan', value: `> ${crew.diamants?.toLocaleString() || 0} 💎`, inline: true },
                        { name: `\u200B`, value: `\u200B`, inline: true },
                        { name: `\u200B`, value: `\u200B`, inline: true },
                        { name: `Ressources du Clan`, 
                          value: `🪵 Bois: ${crew.bois?.toLocaleString() || 0} | 🧱 Pierre: ${crew.pierre?.toLocaleString() || 0} | 🍖 Nourriture: ${crew.nourriture?.toLocaleString() || 0}`, 
                          inline: false },
                        { name: `Liste des Membres`, value: memberListString, inline: false },
                    )
                    .setColor('DarkGreen')
                    .setTimestamp();

                const statsButton = new ButtonBuilder().setCustomId('crew_stats').setLabel('Statistiques Détaillées').setStyle(ButtonStyle.Primary);
                const donButton = new ButtonBuilder().setCustomId('crew_don_menu').setLabel('Faire un Don').setStyle(ButtonStyle.Secondary);
                const shopButton = new ButtonBuilder().setCustomId('crew_shop_menu').setLabel('Boutique du Clan 🛍️').setStyle(ButtonStyle.Success);
                const inviteButton = new ButtonBuilder().setCustomId('crew_invite_menu').setLabel('Inviter des Membres').setStyle(ButtonStyle.Secondary);
                const adminButton = new ButtonBuilder().setCustomId('crew_admin_menu').setLabel('Administration').setStyle(ButtonStyle.Danger).setDisabled(user.crewRole !== 'CAPTAIN');

                const row1 = new ActionRowBuilder().addComponents(statsButton, donButton, shopButton);
                const row2 = new ActionRowBuilder().addComponents(inviteButton, adminButton);

                await interaction.editReply({ embeds: [embed], components: [row1, row2] });

            } else {
                const pendingInvites = await getPendingInvitationsCount(interaction.user.id);
                const notificationLabel = `Invitations (${pendingInvites})`;
                
                const embed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ Menu des Clans - Bienvenue') 
                    .setDescription(`
                        Salutations, Aventurier ! Vous n'appartenez à aucun équipage.
                        **Créez votre propre empire** ou **rejoignez une flotte existante** pour dominer les mers.
                    `)
                    .addFields(
                        { name: `\u200B`, value: `\u200B`, inline: false }, 
                        { name: '💰 Coût de Création', value: '1500€', inline: true },
                        { name: '📝 Statut', value: 'Sans Clan', inline: true },
                        { name: `\u200B`, value: `\u200B`, inline: false }
                    )
                    .setFooter({ text: 'Choisissez une option ci-dessous pour continuer.' })
                    .setColor('#3498db');

                const createButton = new ButtonBuilder().setCustomId('crew_create_menu').setLabel('Créer mon Clan').setStyle(ButtonStyle.Success);
                const joinButton = new ButtonBuilder().setCustomId('crew_join_menu').setLabel('Rejoindre un Clan').setStyle(ButtonStyle.Primary);
                const notificationButton = new ButtonBuilder().setCustomId('crew_notifications').setLabel(notificationLabel).setStyle(pendingInvites > 0 ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(pendingInvites === 0);

                const row = new ActionRowBuilder().addComponents(createButton, joinButton, notificationButton); 

                await interaction.editReply({ embeds: [embed], components: [row] });
            }

        } catch (error) {
            console.error('❌ ERREUR-CRITIQUE] Échec de l\'exécution de /crew:', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors du chargement du menu clan.' });
        }
    },
};