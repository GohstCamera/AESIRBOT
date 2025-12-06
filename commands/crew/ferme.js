const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COOLDOWN_DURATION = 3600000; // 1 heure en millisecondes

// Définition des ressources et de leur gain de base
const RESOURCES = [
    { name: 'bois', emoji: '🌳', min: 20, max: 80 },
    { name: 'pierre', emoji: '🪨', min: 15, max: 60 },
    { name: 'nourriture', emoji: '🍗', min: 25, max: 90 },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ferme')
        .setDescription('Récolte des ressources pour le clan.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const user = await prisma.user.findUnique({
                where: { userId: interaction.user.id },
                include: { crew: true }
            });

            if (!user || !user.crew) {
                return interaction.editReply({ content: '❌ Tu dois être dans un clan pour utiliser cette commande !' });
            }

            const now = Date.now();
            if (user.farmCooldown && now < new Date(user.farmCooldown).getTime()) {
                const timeLeft = Math.ceil((new Date(user.farmCooldown).getTime() - now) / 1000);
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                return interaction.editReply({
                    content: `⏳ Tu dois attendre encore **${minutes} minutes et ${seconds} secondes** avant de pouvoir récolter de nouveau.`
                });
            }

            // Calcul du gain pour chaque ressource
            let gains = {};
            let bonusApplied = false;
            const harvestBonusEndTime = user.crew.harvestBonusEndTime;

            // Vérifie le bonus de récolte
            if (harvestBonusEndTime && now < new Date(harvestBonusEndTime).getTime()) {
                bonusApplied = true;
            }

            for (const resource of RESOURCES) {
                let baseGain = Math.floor(Math.random() * (resource.max - resource.min + 1)) + resource.min;
                let finalGain = baseGain;
                if (bonusApplied) {
                    finalGain = Math.round(baseGain * 1.2); // Multiplicateur de 20%
                }
                gains[resource.name] = finalGain;
            }

            // Mise à jour de la base de données
            const newCooldown = new Date(now + COOLDOWN_DURATION);
            const updateData = {
                farmCooldown: newCooldown,
            };
            const updateCrewData = {
                bois: { increment: gains.bois },
                pierre: { increment: gains.pierre },
                nourriture: { increment: gains.nourriture },
            };

            await prisma.$transaction([
                prisma.crew.update({
                    where: { id: user.crew.id },
                    data: updateCrewData,
                }),
                prisma.user.update({
                    where: { userId: interaction.user.id },
                    data: updateData,
                })
            ]);

            // Construction de la réponse
            let description = `Tu as récolté :\n`;
            for (const resource of RESOURCES) {
                description += `${resource.emoji} **${gains[resource.name]}** ${resource.name}\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🌾 Récolte Réussie !')
                .setDescription(description)
                .setColor('#2ecc71')
                .setTimestamp();
            
            if (bonusApplied) {
                embed.addFields({
                    name: 'Bonus de Récolte Actif',
                    value: `Ton clan a bénéficié d'un bonus de **20%** sur cette récolte !`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Erreur lors de l\'exécution de la commande /crew ferme :', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la récolte. Merci de réessayer plus tard.' });
        }
    }
};