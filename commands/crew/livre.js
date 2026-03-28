const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const db = require('../../utils/database');
const path = require('path');
const fs = require('fs');

const CARDS_DIRECTORY = path.join(__dirname, '..', '..', 'Carte');
const CARDS_FILE_PATH = path.join(__dirname, 'card_data.json'); 
let CARD_DATA = [];

try {
    const data = fs.readFileSync(CARDS_FILE_PATH, 'utf8');
    CARD_DATA = JSON.parse(data);
} catch (error) {
    console.error(`❌ Erreur critique lors du chargement de card_data.json pour le livre:`, error.message);
}

async function generateBookPage(userId, pageIndex) {
    const [allDbCards] = await db.execute('SELECT * FROM Card ORDER BY name ASC');
    
    const allCardsDetailed = allDbCards.map(dbCard => {
        const jsonDetail = CARD_DATA.find(jsonCard => jsonCard.name === dbCard.name);
        return {
            ...dbCard,
            powerValue: jsonDetail ? jsonDetail.powerValue : '?',
            skills: jsonDetail ? jsonDetail.skills : 'Inconnu',
            emoji: jsonDetail ? jsonDetail.emoji : '❓',
            color: jsonDetail ? jsonDetail.color : '#aaaaaa',
            image_file: jsonDetail ? jsonDetail.image_file : 'erreur.png'
        };
    });

    const [userCards] = await db.execute('SELECT cardId, quantity FROM UserCard WHERE userId = ?', [userId]);
    const ownedCardsMap = new Map(userCards.map(uc => [uc.cardId, uc.quantity]));

    const totalCards = allCardsDetailed.length;
    const totalPages = totalCards || 1;
    const currentPageIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));

    const currentCard = allCardsDetailed[currentPageIndex];

    let embed;
    let attachment;

    if (!currentCard) {
        embed = new EmbedBuilder()
            .setTitle('📕 Votre Livre de Cartes')
            .setDescription(`Page **${currentPageIndex + 1}** sur **${totalPages}**\nCe livre est vide ! Aucune carte disponible.`)
            .setColor('#aaaaaa');
    } else {
        const quantity = ownedCardsMap.get(currentCard.id);
        const isOwned = quantity !== undefined;
        const rarityStars = currentCard.rarity ? currentCard.rarity.split(' ')[0] : '?';

        let descriptionContent = "";
        if (isOwned) {
            const cardImageFilePath = path.join(CARDS_DIRECTORY, currentCard.image_file);
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
                descriptionContent = `
                    Possédée : **x${quantity}** exemplaires
                    **${currentCard.emoji} ${currentCard.name} ${currentCard.emoji}**
                    **Rareté :** ${rarityStars} étoiles
                    **Puissance :** ${currentCard.powerValue.toLocaleString()} ⚔️
                    **Compétence :** *${currentCard.skills}*
                    **Description :** *${currentCard.description}*
                    *(❌ Image non trouvée)*
                `;
            }
        } else {
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

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const { embed, attachment, totalPages } = await generateBookPage(userId, 0);
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`book_prev_0`).setLabel('⬅️ Précédent').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`book_next_0`).setLabel('Suivant ➡️').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1),
    );
        
    const replyOptions = { embeds: [embed], components: [row] };
    if (attachment) replyOptions.files = [attachment];
    await interaction.editReply(replyOptions);
}

module.exports = {
    data: new SlashCommandBuilder().setName('livre').setDescription('Affiche votre collection de cartes.'),
    execute,
    generateBookPage,
};