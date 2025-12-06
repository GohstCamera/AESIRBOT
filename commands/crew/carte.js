const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');

// --- Configuration des Chemins Locaux ---
const CARDS_DIRECTORY = path.join(__dirname, '..', '..', 'Carte');
// Le fichier de données est dans le dossier de la commande (commands/crew/card_data.json)
const CARDS_FILE_PATH = path.join(__dirname, 'card_data.json'); 

let CARD_RATES = [];

try {
    const data = fs.readFileSync(CARDS_FILE_PATH, 'utf8');
    CARD_RATES = JSON.parse(data);
    console.log(`✅ ${CARD_RATES.length} cartes chargées depuis card_data.json.`);
} catch (error) {
    console.error(`❌ Erreur critique lors du chargement de card_data.json :`, error.message);
    // Fournir une carte de secours en cas d'erreur de chargement
    CARD_RATES = [
        { name: 'Erreur', stars: 1, color: '#FF0000', powerValue: 1, emoji: '❌', description: 'Erreur de chargement.', skills: 'Aucune', chance: 1.0, image_file: 'erreur.png' }
    ];
}
// -----------------------------------------------------

const COOLDOWN_DURATION = 86400000; // 24 heures en millisecondes

/**
 * Initialise/met à jour la table Card dans la DB avec les données du JSON.
 */
async function initializeCards() {
    try {
        for (const card of CARD_RATES) {
            // Dans la DB, nous stockons le nom du fichier image
            await prisma.card.upsert({
                where: { name: card.name },
                update: {
                    description: card.description, 
                    rarity: `${card.stars} étoiles`, 
                    image_url: card.image_file, 
                }, 
                create: {
                    name: card.name,
                    description: card.description, 
                    rarity: `${card.stars} étoiles`, 
                    image_url: card.image_file,
                }
            });
        }
    } catch (error) {
        console.error('❌ Erreur critique lors de l\'initialisation/vérification des cartes:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carte')
        .setDescription('Génère une carte pour gagner de la puissance.'),

    async execute(interaction) {
        // La réponse éphémère est préférable pour les commandes privées
        await interaction.deferReply({ ephemeral: false }); 

        await initializeCards();

        try {
            // 1. Récupération de l'utilisateur et du crew
            const user = await prisma.user.findUnique({
                where: { id: interaction.user.id },
                include: { crew: true }
            });

            if (!user) {
                return interaction.editReply({ content: '❌ Tu n\'es pas enregistré. Crée un compte pour utiliser cette commande.' });
            }

            // 🛑 NOUVELLE CONDITION : Vérifie si l'utilisateur est dans un crew
            if (!user.crew) {
                return interaction.editReply({ 
                    content: '🛑 **Condition requise :** Tu dois faire partie d\'un clan (Crew) pour pouvoir générer des cartes de puissance.' 
                });
            }
            // -------------------------------------------------------------
            
            // 2. Cooldown
            const now = Date.now();
            if (user.cardCooldown && now < user.cardCooldown.getTime()) {
                const timeLeftHours = Math.ceil((user.cardCooldown.getTime() - now) / 3600000);
                return interaction.editReply({ content: `⏳ Tu dois attendre encore **${timeLeftHours} heures** pour générer une nouvelle carte.` });
            }

            // 3. Tirage aléatoire et Puissance
            let random = Math.random();
            let cumulativeChance = 0;
            let cardRate = CARD_RATES[0];
            for (const rate of CARD_RATES) {
                cumulativeChance += rate.chance;
                if (random < cumulativeChance) {
                    cardRate = rate;
                    break;
                }
            }
            
            // Puissance FIXE : Utilisation du champ 'powerValue'
            const cardPower = cardRate.powerValue; 

            // 4. Mises à jour DB
            const dbCard = await prisma.card.findUnique({ where: { name: cardRate.name } });
            
            // Logique d'ajout/incrément de la carte à l'utilisateur
            await prisma.userCard.upsert({
                where: { userId_cardId: { userId: user.id, cardId: dbCard.id } },
                update: { quantity: { increment: 1 } },
                create: { userId: user.id, cardId: dbCard.id, quantity: 1 }
            });

            const previousUserPower = user.power || 0;
            const newUserPower = previousUserPower + cardPower;
            const powerDifference = newUserPower - previousUserPower;

            const updateData = {
                power: newUserPower,
                cardCooldown: new Date(now + COOLDOWN_DURATION)
            };

            const updates = [prisma.user.update({ where: { id: user.id }, data: updateData })];
            // Si l'utilisateur est dans un clan, mettez à jour la puissance du clan
            // (user.crew est garanti d'être présent à ce stade)
            updates.push(prisma.crew.update({
                where: { id: user.crew.id },
                data: { power: { increment: powerDifference } }
            }));
            
            await prisma.$transaction(updates);
            
            // --- 5. ENVOI DE L'EMBED (avec fichier local) ---
            
            const imageFilePath = path.join(CARDS_DIRECTORY, cardRate.image_file);
            
            if (!fs.existsSync(imageFilePath)) {
                console.error(`❌ Fichier d'image manquant: ${imageFilePath}`);
                // NOTE: J'ai corrigé la réponse ici pour la rendre éphémère si l'erreur vient du serveur
                return interaction.editReply({ content: `❌ Erreur: Le fichier image pour **${cardRate.name}** est introuvable sur le serveur.`, ephemeral: true });
            }

            // Création de l'attachement à partir du fichier local
            const attachment = new AttachmentBuilder(imageFilePath, { name: cardRate.image_file });

            const embed = new EmbedBuilder()
                .setTitle(`🎉 ${cardRate.emoji} Nouvelle carte : ${cardRate.name}`)
                .setDescription(`
                    Un nouvel atout **${cardRate.stars} étoiles** rejoint ton clan !
                    
                    **Puissance ajoutée :** **${cardPower.toLocaleString()}** ⚔️
                    
                    Ton total de puissance individuelle passe à **${newUserPower.toLocaleString()}** !
                `)
                .setColor(cardRate.color)
                .addFields(
                    { name: 'Rareté', value: `${cardRate.stars} étoiles`, inline: true },
                    { name: 'Compétence', value: `**${cardRate.skills}**`, inline: true }, 
                    { name: 'Puissance de la Carte', value: `**${cardPower.toLocaleString()}**`, inline: true }, 
                    { name: 'Description', value: `*${cardRate.description}*`, inline: false }
                )
                .setImage(`attachment://${cardRate.image_file}`) // Lie l'image à l'attachement
                .setFooter({ text: `Prochaine carte dans 24 heures.` })
                .setTimestamp();
            
            // On envoie l'embed ET l'attachement (le fichier local)
            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('❌ Erreur lors de l\'exécution de la commande carte :', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la génération de la carte. Merci de réessayer plus tard.' });
        }
    }
};