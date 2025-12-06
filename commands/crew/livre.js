// Fichier : commands/crew/livre.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');

// --- Configuration des Chemins Locaux ---
const CARDS_DIRECTORY = path.join(__dirname, '..', '..', 'Carte'); // N'oubliez pas de vérifier la casse ('Carte' ou 'carte')
const CARDS_FILE_PATH = path.join(__dirname, 'card_data.json'); 
let CARD_DATA = []; // Contient toutes les infos du JSON (y compris image_file, color, emoji)

try {
    const data = fs.readFileSync(CARDS_FILE_PATH, 'utf8');
    CARD_DATA = JSON.parse(data);
} catch (error) {
    console.error(`❌ Erreur critique lors du chargement de card_data.json pour le livre:`, error.message);
}
// ----------------------------------------------------------------

/**
 * Génère l'Embed et les boutons pour une page spécifique du livre de cartes.
 * Chaque page affichera UNE SEULE carte avec tous ses détails et son image.
 * @param {string} userId L'ID de l'utilisateur.
 * @param {number} pageIndex L'index de la page à afficher (commence à 0).
 * @returns {Promise<{embed: EmbedBuilder, attachment?: AttachmentBuilder, totalPages: number}>}
 */
async function generateBookPage(userId, pageIndex) {
    
    // 1. Récupérer toutes les cartes existantes (pour le total et l'ordre)
    const allDbCards = await prisma.card.findMany({
        orderBy: { name: 'asc' } // Trié par nom pour un affichage stable
    });
    
    // 2. Fusionner les données de la DB avec les détails du JSON
    // Cela nous donne toutes les infos nécessaires pour chaque carte
    const allCardsDetailed = allDbCards.map(dbCard => {
        const jsonDetail = CARD_DATA.find(jsonCard => jsonCard.name === dbCard.name);
        return {
            ...dbCard,
            powerValue: jsonDetail ? jsonDetail.powerValue : '?',
            skills: jsonDetail ? jsonDetail.skills : 'Inconnu',
            emoji: jsonDetail ? jsonDetail.emoji : '❓',
            color: jsonDetail ? jsonDetail.color : '#aaaaaa',
            image_file: jsonDetail ? jsonDetail.image_file : 'erreur.png' // Assure que l'image_file est disponible
        };
    });

    // 3. Récupérer les cartes possédées par l'utilisateur
    const userCards = await prisma.userCard.findMany({
        where: { userId: userId },
        select: { cardId: true, quantity: true }
    });
    const ownedCardsMap = new Map(userCards.map(uc => [uc.cardId, uc.quantity]));

    // Déterminer la pagination (1 carte par page)
    const totalCards = allCardsDetailed.length;
    const totalPages = totalCards || 1; // S'il n'y a pas de carte, 1 page vide
    
    // Si la page demandée est hors limites, ajuster
    const currentPageIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));

    const currentCard = allCardsDetailed[currentPageIndex]; // La carte à afficher sur cette page

    let embed;
    let attachment;

    if (!currentCard) {
        // Aucune carte disponible
        embed = new EmbedBuilder()
            .setTitle('📕 Votre Livre de Cartes')
            .setDescription(`
                Page **${currentPageIndex + 1}** sur **${totalPages}**
                Ce livre est vide ! Aucune carte disponible.
            `)
            .setColor('#aaaaaa');
    } else {
        const quantity = ownedCardsMap.get(currentCard.id);
        const isOwned = quantity !== undefined;
        
        const rarityStars = currentCard.rarity.split(' ')[0]; 

        let descriptionContent = "";
        let cardImageFilePath = "";

        if (isOwned) {
            // Carte Obtenue : Affiche tous les détails et l'image
            cardImageFilePath = path.join(CARDS_DIRECTORY, currentCard.image_file);
            if (fs.existsSync(cardImageFilePath)) {
                attachment = new AttachmentBuilder(cardImageFilePath, { name: currentCard.image_file });
                descriptionContent = `
                    Possédée : **x${quantity}** exemplaires
                    
                    **${currentCard.emoji} ${currentCard.name} ${currentCard.emoji}**
                    **Rareté :** ${rarityStars} étoiles
                    **Puissance :** ${currentCard.powerValue.toLocaleString()} ⚔️
                    **Compétence :** *${currentCard.skills}*
                    **Description :** *${currentCard.description}*
                `;
            } else {
                // Fichier image manquant sur le serveur, affiche sans image
                descriptionContent = `
                    Possédée : **x${quantity}** exemplaires
                    
                    **${currentCard.emoji} ${currentCard.name} ${currentCard.emoji}**
                    **Rareté :** ${rarityStars} étoiles
                    **Puissance :** ${currentCard.powerValue.toLocaleString()} ⚔️
                    **Compétence :** *${currentCard.skills}*
                    **Description :** *${currentCard.description}*
                    
                    *(❌ Image non trouvée sur le serveur)*
                `;
            }
        } else {
            // Carte Non Obtenue : Affiche un cadre vide
            descriptionContent = `
                Cette carte est encore inconnue de votre collection.
                
                \`[ ${rarityStars} ] ${currentCard.name}\`
                Découvrez-la pour révéler ses secrets !
            `;
        }

        embed = new EmbedBuilder()
            .setTitle('📕 Votre Livre de Cartes')
            .setDescription(`Page **${currentPageIndex + 1}** sur **${totalPages}**\n\n${descriptionContent}`)
            .setColor(currentCard.color);
        
        if (attachment) {
            embed.setImage(`attachment://${currentCard.image_file}`);
        }
    }
    
    return { embed, attachment, totalPages: totalPages };
}

// Fonction d'exécution principale de la commande slash
async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const pageIndex = 0; // Toujours commencer à la page 0
    
    // Obtenir la première page
    const { embed, attachment, totalPages } = await generateBookPage(userId, pageIndex);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`book_prev_${pageIndex}`) 
                .setLabel('⬅️ Précédent')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true), // Toujours désactivé sur la première page
            new ButtonBuilder()
                .setCustomId(`book_next_${pageIndex}`) // CustomId avec l'index de page actuel
                .setLabel('Suivant ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(totalPages <= 1), // Désactivé si une seule page
        );
        
    const replyOptions = { embeds: [embed], components: [row] };
    if (attachment) {
        replyOptions.files = [attachment];
    }

    await interaction.editReply(replyOptions);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('livre')
        .setDescription('Affiche votre collection de cartes et les cartes manquantes.'),
    execute,
    generateBookPage, // Exporté pour être utilisé par le gestionnaire d'interactions (index.js)
};