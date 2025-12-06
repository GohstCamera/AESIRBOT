const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Définition des rôles et des couleurs pour l'affichage (synchronisé avec CrewRole ENUM)
const CREW_ROLES = {
    CAPTAIN: 'Capitaine 👑',
    OFFICER: 'Officier ⭐',
    MEMBER: 'Membre ⚓',
};

// --- LOGIQUE DE NOTIFICATION RÉELLE ---
async function getPendingInvitationsCount(userId) {
    // Utilise le modèle CrewInvite et l'enum PENDING
    const count = await prisma.crewInvite.count({ 
        where: { 
            recipientId: userId, 
            status: 'PENDING' 
        } 
    });
    return count;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crew')
        .setDescription('Ouvre le menu principal pour les clans.'), 

    async execute(interaction) {
        console.log(`\n[DEBUG-CREW] =============================================`);
        console.log(`[DEBUG-CREW] Commande /crew lancée par ${interaction.user.tag} (ID: ${interaction.user.id})`);
        await interaction.deferReply({ ephemeral: true }); 

        try {
            // 1. Récupération des données utilisateur, du crew et des membres
            const userWithCrew = await prisma.user.findUnique({
                where: { id: interaction.user.id },
                select: { 
                    crewId: true, 
                    crewRole: true, 
                    crew: {
                        // Utilisation de 'select' pour lister tous les champs scalaires (diamants, power...) 
                        // ET les relations (users). C'est la bonne pratique pour les requêtes imbriquées.
                        select: {
                            // CHAMPS SCALAIRES DU CREW
                            id: true,
                            name: true,
                            description: true,
                            emoji: true,
                            ownerId: true, // Clé étrangère
                            diamants: true,
                            storeStock: true,
                            power: true,
                            bois: true,
                            pierre: true,
                            nourriture: true,

                            // CHAMPS DE RELATION
                            users: { 
                                select: { id: true, username: true, crewRole: true } 
                            },
                        }
                    }
                }
            });

            // Gérer le cas où l'utilisateur n'est pas trouvé (pour éviter les crashs)
            const user = userWithCrew || { crewId: null, crewRole: null, crew: null }; 
            
            // CAS 1 : L'utilisateur est DÉJÀ dans un clan
            if (user && user.crewId && user.crew) {
                console.log(`[DEBUG-CREW] Utilisateur trouvé dans le clan ID: ${user.crewId}. Affichage du menu membre.`);

                const crew = user.crew;
                // Assure la conversion en String pour la clé du rôle
                const userRoleKey = user.crewRole ? user.crewRole.toString() : 'MEMBER'; 
                const userRoleDisplay = CREW_ROLES[userRoleKey] || CREW_ROLES.MEMBER;

                // --- Construction de la liste des membres ---
                let memberList = [];
                const discordClient = interaction.client;

                crew.users.forEach(member => {
                    const memberRoleKey = member.crewRole ? member.crewRole.toString() : 'MEMBER';
                    const memberRoleDisplay = CREW_ROLES[memberRoleKey] || CREW_ROLES.MEMBER;
                    // Tente de récupérer le tag Discord à partir du cache client
                    const memberTag = discordClient.users.cache.get(member.id)?.tag || member.username || `ID:${member.id}`;
                    memberList.push(`- **${memberTag}** (${memberRoleDisplay})`);
                });
                
                const memberListString = memberList.join('\n');
                // -------------------------------------------

                const embed = new EmbedBuilder()
                    .setTitle(`${crew.emoji || '⚓'} ${crew.name} - Tableau de Bord`) 
                    .setDescription(crew.description || 'Pas de description définie pour ce clan.')
                    .addFields(
                        { name: `\u200B`, value: `\u200B`, inline: false }, 
                        { name: '👤 Votre Rôle', value: `> ${userRoleDisplay}`, inline: true },
                        // Utilisation de ?.toLocaleString() || 0 pour gérer les valeurs nulles ou indéfinies
                        { name: '💪 Puissance Totale', value: `> ${crew.power?.toLocaleString() || 0} 💪`, inline: true }, 
                        { name: '🧑‍🤝‍🧑 Membres', value: `> ${crew.users.length} (Max: 10)`, inline: true },
                        { name: `\u200B`, value: `\u200B`, inline: false }, 
                        // AJOUT des Diamants du Clan
                        { name: '💎 Diamants du Clan', value: `> ${crew.diamants?.toLocaleString() || 0} 💎`, inline: true },
                        { name: `\u200B`, value: `\u200B`, inline: true },
                        { name: `\u200B`, value: `\u200B`, inline: true },
                        { name: `Ressources du Clan`, 
                          value: `🪵 Bois: ${crew.bois?.toLocaleString() || 0} | 🧱 Pierre: ${crew.pierre?.toLocaleString() || 0} | 🍖 Nourriture: ${crew.nourriture?.toLocaleString() || 0}`, 
                          inline: false },
                        { name: `Liste des Membres`, value: memberListString.substring(0, 1024), inline: false },
                    )
                    .setColor('DarkGreen')
                    .setTimestamp();
                
                // Boutons pour le menu de gestion du clan
                const statsButton = new ButtonBuilder()
                    .setCustomId('crew_stats')
                    .setLabel('Statistiques Détaillées')
                    .setStyle(ButtonStyle.Primary);
                
                const donButton = new ButtonBuilder()
                    .setCustomId('crew_don_menu')
                    .setLabel('Faire un Don')
                    .setStyle(ButtonStyle.Secondary);
                    
                const shopButton = new ButtonBuilder()
                    .setCustomId('crew_shop_menu') // Custom ID pour la boutique
                    .setLabel('Boutique du Clan 🛍️')
                    .setStyle(ButtonStyle.Success);
                
                const inviteButton = new ButtonBuilder()
                    .setCustomId('crew_invite_menu')
                    .setLabel('Inviter des Membres')
                    .setStyle(ButtonStyle.Secondary);
                
                // Bouton Administrateur (uniquement pour le Capitaine)
                const adminButton = new ButtonBuilder()
                    .setCustomId('crew_admin_menu')
                    .setLabel('Administration')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(userRoleKey !== 'CAPTAIN'); 

                const row1 = new ActionRowBuilder().addComponents(statsButton, donButton, shopButton);
                const row2 = new ActionRowBuilder().addComponents(inviteButton, adminButton);


                await interaction.editReply({ embeds: [embed], components: [row1, row2], ephemeral: true });
                console.log(`[DEBUG-CREW] Affichage du menu de GESTION du clan terminé.`);

            } 
            // CAS 2 : L'utilisateur n'est PAS dans un clan (Menu Créer/Rejoindre)
            else {
                console.log(`[DEBUG-CREW] Utilisateur sans clan. Affichage du menu standard.`);
                
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

                const createButton = new ButtonBuilder()
                    .setCustomId('crew_create_menu')
                    .setLabel('Créer mon Clan')
                    .setStyle(ButtonStyle.Success);

                const joinButton = new ButtonBuilder()
                    .setCustomId('crew_join_menu')
                    .setLabel('Rejoindre un Clan')
                    .setStyle(ButtonStyle.Primary);

                // Bouton de notification
                const notificationButton = new ButtonBuilder()
                    .setCustomId('crew_notifications')
                    .setLabel(notificationLabel)
                    .setStyle(pendingInvites > 0 ? ButtonStyle.Danger : ButtonStyle.Secondary) 
                    .setDisabled(pendingInvites === 0);

                const row = new ActionRowBuilder().addComponents(createButton, joinButton, notificationButton); 

                await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
                console.log('[DEBUG-CREW] Affichage du menu CREATION/REJOINDRE terminé.');
            }
            

        } catch (error) {
            console.error('❌ ERREUR-CRITIQUE] Échec de l\'exécution de /crew:', error.stack);
            
            await interaction.editReply({ 
                content: '❌ Une erreur est survenue lors du chargement du menu clan. Réessaie.', 
                ephemeral: true 
            }).catch(err => {
                console.error('❌ ÉCHEC DE L\'EDITREPLY D\'ERREUR pour /crew:', err);
            });
        }
        console.log(`[DEBUG-CREW] Fin de l'exécution pour /crew.`);
        console.log(`[DEBUG-CREW] =============================================`);
    },
};