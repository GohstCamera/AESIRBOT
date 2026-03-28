const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../utils/database');
const path = require('path');
const fs = require('fs');

const CARDS_DIRECTORY = path.join(__dirname, '..', '..', 'Carte');
const CARDS_FILE_PATH = path.join(__dirname, 'card_data.json');

let CARD_RATES = [];

try {
    const data = fs.readFileSync(CARDS_FILE_PATH, 'utf8');
    CARD_RATES = JSON.parse(data);
} catch (error) {
    console.error(`❌ Erreur critique lors du chargement de card_data.json :`, error.message);
    CARD_RATES = [
        { name: 'Erreur', stars: 1, color: '#FF0000', powerValue: 1, emoji: '❌', description: 'Erreur de chargement.', skills: 'Aucune', chance: 1.0, image_file: 'erreur.png' }
    ];
}

const COOLDOWN_DURATION = 86400000;

async function initializeCards() {
    try {
        for (const card of CARD_RATES) {
            await db.execute(
                `INSERT INTO Card (name, description, rarity, image_url)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE description = VALUES(description), rarity = VALUES(rarity), image_url = VALUES(image_url)`,
                [card.name, card.description, `${card.stars} étoiles`, card.image_file]
            );
        }
    } catch (error) {
        console.error('❌ Erreur critique lors de l\'initialisation des cartes:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carte')
        .setDescription('Génère une carte pour gagner de la puissance.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        await initializeCards();

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [userRows] = await connection.execute('SELECT * FROM User WHERE id = ? FOR UPDATE', [interaction.user.id]);
            const user = userRows[0];

            if (!user) {
                await connection.rollback();
                return interaction.editReply({ content: '❌ Tu n\'es pas enregistré. Crée un compte pour utiliser cette commande.' });
            }

            if (!user.crewId) {
                await connection.rollback();
                return interaction.editReply({ 
                    content: '🛑 **Condition requise :** Tu dois faire partie d\'un clan (Crew) pour pouvoir générer des cartes de puissance.' 
                });
            }

            const now = Date.now();
            if (user.cardCooldown && now < new Date(user.cardCooldown).getTime()) {
                const timeLeftHours = Math.ceil((new Date(user.cardCooldown).getTime() - now) / 3600000);
                await connection.rollback();
                return interaction.editReply({ content: `⏳ Tu dois attendre encore **${timeLeftHours} heures** pour générer une nouvelle carte.` });
            }

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
            
            const cardPower = cardRate.powerValue;

            const [dbCardRows] = await connection.execute('SELECT id FROM Card WHERE name = ?', [cardRate.name]);
            const dbCard = dbCardRows[0];
            
            await connection.execute(
                'INSERT INTO UserCard (userId, cardId, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
                [user.id, dbCard.id]
            );

            const newUserPower = (user.power || 0) + cardPower;

            await connection.execute(
                'UPDATE User SET power = ?, cardCooldown = ? WHERE id = ?',
                [newUserPower, new Date(now + COOLDOWN_DURATION), user.id]
            );

            await connection.execute(
                'UPDATE Crew SET power = power + ? WHERE id = ?',
                [cardPower, user.crewId]
            );
            
            await connection.commit();
            
            const imageFilePath = path.join(CARDS_DIRECTORY, cardRate.image_file);
            
            if (!fs.existsSync(imageFilePath)) {
                return interaction.editReply({ content: `❌ Erreur: Le fichier image pour **${cardRate.name}** est introuvable.` });
            }

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
                .setImage(`attachment://${cardRate.image_file}`)
                .setFooter({ text: `Prochaine carte dans 24 heures.` })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            await connection.rollback();
            console.error('❌ Erreur lors de l\'exécution de la commande carte :', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la génération de la carte.' });
        } finally {
            connection.release();
        }
    }
};