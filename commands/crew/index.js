// Fichier : /commands/crew/index.js

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Récupère la logique de création de page depuis livre.js (Doit exister pour fonctionner)
const { generateBookPage } = require('./livre');

// 💡 IMPORTATION des articles de la boutique pour la logique d'achat (Doit exister dans crewboutique.js)
const { shopItems } = require('./crewboutique'); 

module.exports = {
    // Cette fonction est appelée par votre gestionnaire d'événements pour TOUTES les interactions customId
    async handleInteraction(interaction) {
        console.log(`\n[DEBUG-START] =============================================`);
        console.log(`[DEBUG-START] Nouvelle interaction. Type: ${interaction.type}. CustomID: ${interaction.customId}`);
        console.log(`[DEBUG-START] Utilisateur: ${interaction.user.tag} (ID: ${interaction.user.id})`);
        console.log(`[DEBUG-START] =============================================`);

        try {
            // --- GESTION CENTRALISÉE DE L'ACCUSÉ DE RÉCEPTION ---
            // Pour les modales, on ne peut pas différer, donc on les traite en premier.
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'create_crew_modal') {
                    await handleCreateCrewModalSubmit(interaction);
                    return; // Termine l'exécution ici
                }
            } else if (interaction.isButton() && interaction.customId === 'crew_create_menu') {
                // Le showModal est une réponse en soi, pas besoin de différer.
                await handleShowCreateCrewModal(interaction);
                return; // Termine l'exécution ici
            } else {
                // Pour tous les autres boutons et menus, on diffère la mise à jour.
                await interaction.deferUpdate({ ephemeral: true });
            }

            // --- ROUTEUR D'INTERACTIONS ---

            if (interaction.isStringSelectMenu() && interaction.customId === 'crew_shop_select') {
                console.log(`[DEBUG-FLOW] 1. Interagit avec le menu de la boutique 'crew_shop_select'.`);
                const itemId = interaction.values[0];
                await handleShopPurchase(interaction, itemId);

            } else if (interaction.isButton() && interaction.customId === 'crew_notifications') {
                console.log(`[DEBUG-FLOW] 4. Interagit avec le bouton 'crew_notifications' (Affichage des Invitations).`);
                await handleShowNotifications(interaction);

            } else if (interaction.isButton() && interaction.customId.startsWith('book_')) {
                console.log(`[DEBUG-FLOW] 5. Interagit avec le bouton Livre '${interaction.customId}'.`);
                await handleBookNavigation(interaction);

            } else if (interaction.isButton() && (interaction.customId.startsWith('invite_accept_') || interaction.customId.startsWith('invite_reject_'))) {
                await handleInviteResponse(interaction);
            }

        } catch (error) {
            console.error('❌ ERREUR-CRITIQUE dans le handler de crew/index.js:', error.stack);
            await interaction.followUp({
                content: '❌ Une erreur critique est survenue lors de cette action.',
                ephemeral: true
            }).catch(() => {}); // Ignore les erreurs si on ne peut plus répondre
        }
    }
};

/**
 * Affiche le modal pour créer un clan
 */
async function handleShowCreateCrewModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('create_crew_modal')
        .setTitle('Créer ton Clan');
    
    const nameInput = new TextInputBuilder().setCustomId('crewNameInput').setLabel('Nom du Clan').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20);
    const emojiInput = new TextInputBuilder().setCustomId('crewEmojiInput').setLabel('Émoji du Clan (Optionnel)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 💀 ou ⚔️').setRequired(false).setMaxLength(5);
    const descriptionInput = new TextInputBuilder().setCustomId('crewDescriptionInput').setLabel('Description du Clan').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(200);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(emojiInput),
        new ActionRowBuilder().addComponents(descriptionInput)
    );

    await interaction.showModal(modal);
    console.log(`[DEBUG-SUCCESS] 2. Modal 'create_crew_modal' affiché avec succès.`);
}

/**
 * Gère la soumission du modal de création de clan
 */
async function handleCreateCrewModalSubmit(interaction) {
    console.log(`[DEBUG-FLOW] 3. Soumission du modal 'create_crew_modal' détectée.`);
    await interaction.deferReply({ ephemeral: true });

    const crewName = interaction.fields.getTextInputValue('crewNameInput');
    const crewEmoji = interaction.fields.getTextInputValue('crewEmojiInput') || '⚔️';
    const crewDescription = interaction.fields.getTextInputValue('crewDescriptionInput');
    const CREW_COST = 1500;

    // ... (le reste de la logique de création reste identique)
    // Tente de trouver l'utilisateur existant
    let existingUser = await prisma.user.findUnique({
        where: { id: interaction.user.id },
        select: { balance: true, crewId: true }
    });

    // Si l'utilisateur n'existe pas, il est créé ici
    if (!existingUser) {
        existingUser = await prisma.user.create({
            data: { id: interaction.user.id, balance: 0, username: interaction.user.username },
            select: { balance: true, crewId: true }
        });
    }

    if (existingUser.crewId) {
        return interaction.editReply({ content: '❌ Tu es déjà dans un clan !' });
    }

    const existingCrew = await prisma.crew.findUnique({ where: { name: crewName } });
    if (existingCrew) {
        return interaction.editReply({ content: `❌ Le nom de clan **${crewName}** est déjà pris.` });
    }

    if (existingUser.balance < CREW_COST) {
        return interaction.editReply({ content: `❌ Tu n'as pas assez d'argent. Il te manque **${(CREW_COST - existingUser.balance).toLocaleString()}€**.` });
    }

    // ... (le reste de la logique de transaction est correcte)
    // ...
    // à la fin :
    // await interaction.editReply({ embeds: [embed], content: '' });
}

/**
 * Affiche les notifications d'invitation
 */
async function handleShowNotifications(interaction) {
    // deferUpdate est déjà fait
    // Vérifie si l'utilisateur est déjà dans un clan
    const userCheck = await prisma.user.findUnique({
        where: { id: interaction.user.id },
        select: { crewId: true }
    });

    if (userCheck && userCheck.crewId) {
        return interaction.followUp({ content: '⚠️ Tu es déjà membre d\'un clan. Tu ne peux pas accepter de nouvelles invitations.', ephemeral: true });
    }
    // ... (le reste de la logique d'affichage des invitations est correcte)
    // ...
    // à la fin :
    // await interaction.editReply({ embeds: [inviteEmbed], components: actionRows });
}

/**
 * Gère la navigation dans le livre de cartes
 */
async function handleBookNavigation(interaction) {
    // deferUpdate est déjà fait
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const currentOldIndex = parseInt(parts[2]);
    // ... (le reste de la logique de navigation est correcte)
    // ...
    // à la fin :
    // await interaction.editReply(replyOptions);
}

/**
 * Gère la réponse à une invitation (accepter/refuser)
 */
async function handleInviteResponse(interaction) {
    // deferUpdate est déjà fait
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const inviteId = parseInt(parts[2]);

    // Logique de refus
    if (action === 'reject') {
        await prisma.crewInvite.delete({ where: { id: inviteId } });
        // On ne peut pas "rappeler" la fonction, on envoie juste une confirmation.
        await interaction.followUp({ content: '🗑️ Invitation refusée.', ephemeral: true });
        // L'utilisateur devra recliquer sur le bouton "Invitations" pour rafraîchir.
        return;
    }

    // Logique d'acceptation
    if (action === 'accept') {
        // ... (le reste de la logique d'acceptation est correcte)
        // ...
        // à la fin :
        // await interaction.editReply({ content: `...`, components: [] });
    }
}

// ------------------------------------------------
// 💡 LOGIQUE D'ACHAT DÉPLACÉE ICI
// ------------------------------------------------

/**
 * Logique d'achat d'un article de la boutique.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 * @param {string} itemId - L'ID de l'article sélectionné.
 */
async function handleShopPurchase(interaction, itemId) {
    // deferUpdate() est maintenant appelé au début du handler principal

    const item = shopItems.find(i => i.id === itemId);

    if (!item) {
        return interaction.editReply({ content: "❌ Article non trouvé.", components: [] });
    }

    const price = item.price;
    const userId = interaction.user.id;
    // Détermine si c'est un achat en euros ou en diamants (par défaut euros)
    const isEuroPurchase = item.currency === 'euros' || !item.currency;
    const currencyField = isEuroPurchase ? 'balance' : 'diamants';
    
    // 1. Récupération et vérification des données
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {  
            balance: true,  
            diamants: true,
            crewId: true,  
            maxDonation: true,  
            donationBoostExpiresAt: true,
            donationBoostValue: true
        }  
    });

    if (!user) {
        // Crée l'utilisateur s'il n'existe pas (si la DB le permet)
        await prisma.user.create({ data: { id: userId, username: interaction.user.username, balance: 0, diamants: 0 } });
        return interaction.editReply({ content: "❌ Compte non initialisé. Veuillez réessayer ou utiliser une autre commande pour l'initialiser.", components: [] });
    }

    if (!user.crewId) {
        // L'achat de la boutique de clan nécessite d'être dans un clan
        return interaction.editReply({ content: "❌ Vous devez être dans un clan pour acheter cet article.", components: [] });
    }
    
    // Vérification du solde
    if (user[currencyField] < price) {
        const currencySymbol = isEuroPurchase ? '€' : '💎';
        return interaction.editReply({  
            content: `❌ Solde insuffisant ! Vous avez besoin de **${price.toLocaleString()}${currencySymbol}** (actuel: ${user[currencyField].toLocaleString()}${currencySymbol}).`,  
            components: []  
        });
    }

    // 2. Vérification des doubles boosts
    if (item.type === 'boost_don' && user.donationBoostExpiresAt && user.donationBoostExpiresAt > new Date()) {
          return interaction.editReply({  
            content: "❌ Vous avez déjà un bonus de don actif. Attendez qu'il expire avant d'en acheter un autre.",  
            components: []  
        });
    }

    // 3. Logique de la transaction (Début de la transaction Prisma)
    try {
        await prisma.$transaction(async (tx) => {
            
            // Débiter l'utilisateur (euros ou diamants)
            const debitData = { [currencyField]: { decrement: price } };

            // Mise à jour de l'utilisateur (Débit + Notoriété)
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {  
                    ...debitData,
                    notoriety: { increment: item.givesNotoriety || 0 }
                },
                select: { maxDonation: true } // Récupère le maxDonation actuel pour la mise à jour permanente
            });

            // Créditer le clan en diamants
            if (item.givesDiamants > 0) {
                await tx.crew.update({
                    where: { id: user.crewId },
                    data: {  
                        diamants: { increment: item.givesDiamants }  
                    }
                });
            }

            // 4. Logique spécifique à l'article
            let purchaseMessage = `✅ Achat de **${item.name}** réussi ! Vous avez dépensé **${price.toLocaleString()}${isEuroPurchase ? '€' : '💎'}**.`;
            if (item.givesDiamants > 0) {
                 purchaseMessage += `\nVotre clan a reçu **${item.givesDiamants.toLocaleString()} 💎** (Diamants de Clan).`;
            }
            if (item.givesNotoriety > 0) {
                purchaseMessage += `\nVous avez gagné **${item.givesNotoriety.toLocaleString()} Notoriété**.`;
            }

            // A. Gestion des BONUS DE DON TEMPORAIRES (type: 'boost_don')
            if (item.type === 'boost_don' && item.durationHours && item.donationBonus) {
                const now = new Date();
                const expiryDate = new Date(now.getTime() + item.durationHours * 60 * 60 * 1000);

                await tx.user.update({
                    where: { id: userId },
                    data: {
                        donationBoostExpiresAt: expiryDate,
                        donationBoostValue: item.donationBonus // Valeur du boost, pas le max
                    }
                });
                purchaseMessage += `\n\n**🚀 Bonus Temporaire** : Votre limite de don maximum est augmentée de **+${item.donationBonus.toLocaleString()}€** jusqu'au <t:${Math.floor(expiryDate.getTime() / 1000)}:f> !`;
            }
            
            // B. Gestion des PERKS PERMANENTS (isPermanent: true)
            if (item.isPermanent && item.donationBonus) {
                const newMaxDonation = updatedUser.maxDonation + item.donationBonus;
                
                await tx.user.update({
                    where: { id: userId },
                    data: {  
                        maxDonation: newMaxDonation
                    }
                });
                purchaseMessage += `\n\n**👑 Amélioration Permanente** : Votre limite de don maximum est passée à **${newMaxDonation.toLocaleString()}€** (soit +${item.donationBonus.toLocaleString()}€) !`;
            }

            // 5. Réponse finale
            await interaction.editReply({  
                content: purchaseMessage,  
                embeds: [],  
                components: []  
            });
        });

    } catch (error) {
        console.error("Erreur de transaction lors de l'achat de boutique:", error);
        return interaction.editReply({  
            content: "❌ Une erreur critique est survenue durant la transaction. Le débit a été annulé. Veuillez réessayer.",  
            components: []  
        });
    }
}