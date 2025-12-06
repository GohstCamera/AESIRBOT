const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Définition des prix de vente des ressources (par unité)
const SELL_PRICES = {
    bois: 2,
    pierre: 3,
    nourriture: 1,
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vendre')
        .setDescription('Vend les ressources du clan contre de l\'argent.')
        .addStringOption(option =>
            option.setName('ressource')
                .setDescription('Le type de ressource à vendre.')
                .setRequired(true)
                .addChoices(
                    { name: 'Bois', value: 'bois' },
                    { name: 'Pierre', value: 'pierre' },
                    { name: 'Nourriture', value: 'nourriture' }
                ))
        .addIntegerOption(option =>
            option.setName('quantite')
                .setDescription('La quantité de ressources à vendre. "Tout" si non spécifié.')
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const resourceToSell = interaction.options.getString('ressource');
        let quantityToSell = interaction.options.getInteger('quantite');

        try {
            // 1. On récupère les informations de l'utilisateur et de son clan
            const user = await prisma.user.findUnique({
                where: { id: interaction.user.id },
                include: { crew: true }
            });

            if (!user || !user.crew) {
                return interaction.editReply({ content: '❌ Tu dois être dans un clan pour vendre des ressources.' });
            }

            // 2. On vérifie si la ressource demandée existe dans les données du clan
            const currentQuantity = user.crew[resourceToSell];
            if (currentQuantity === undefined) {
                return interaction.editReply({ content: '❌ Cette ressource n\'existe pas.' });
            }

            // 3. On détermine la quantité à vendre
            if (quantityToSell === null || quantityToSell > currentQuantity) {
                quantityToSell = currentQuantity;
            }

            if (quantityToSell <= 0) {
                return interaction.editReply({ content: `❌ Ton clan n'a pas de ${resourceToSell} à vendre.` });
            }

            // 4. On calcule le gain total
            const price = SELL_PRICES[resourceToSell];
            const totalGain = quantityToSell * price;

            // 5. On met à jour la base de données (déduction des ressources du clan et ajout de l'argent au joueur)
            const updateCrewData = {};
            updateCrewData[resourceToSell] = { decrement: quantityToSell };

            await prisma.$transaction([
                // Déduction des ressources du clan
                prisma.crew.update({
                    where: { id: user.crew.id },
                    data: updateCrewData,
                }),
                // Ajout de l'argent au solde de l'utilisateur
                prisma.user.update({
                    where: { id: interaction.user.id },
                    data: { balance: { increment: totalGain } }
                })
            ]);

            // 6. On envoie la réponse
            const embed = new EmbedBuilder()
                .setTitle('💰 Ressources vendues !')
                .setDescription(`Tu as vendu **${quantityToSell}** ${resourceToSell} et ton clan a gagné **${totalGain}€** !`)
                .setColor('#F1C40F')
                .addFields(
                    { name: 'Nouveau Solde', value: `**${(user.balance + totalGain).toLocaleString()}€**` }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(`❌ Erreur lors de l'exécution de la commande /crew vendre :`, error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la vente des ressources. Merci de réessayer plus tard.' });
        }
    }
};