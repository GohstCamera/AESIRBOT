// Importez le client Prisma
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
// const db = require('../../database/db'); // <-- NON UTILISÉ AVEC PRISMA
const moment = require('moment'); // Assurez-vous d'avoir installé moment : npm install moment

const dailyAmount = 10;
const dailyCooldownHours = 24; 
const dailyCooldownMs = dailyCooldownHours * 60 * 60 * 1000; // 24 heures en millisecondes

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Récupère votre récompense quotidienne'),

    async execute(interaction) {
        // --- GESTION DE L'INTERACTION : DEFERREMENT ---
        // Accuse réception immédiatement pour éviter l'erreur "Unknown interaction" (10062)
        // car les requêtes DB peuvent prendre plus de 3 secondes.
        await interaction.deferReply({ ephemeral: false});

        const userId = interaction.user.id;

        try {
            // 1. Récupérer les données de l'utilisateur (ou null s'il n'existe pas)
            // findUnique cherche un utilisateur par sa clé primaire (id)
            let user = await prisma.user.findUnique({
                where: { id: userId },
                select: { balance: true, last_daily: true } // Ne sélectionner que les champs nécessaires
            });

            // Si l'utilisateur n'existe pas, on le crée et on lui donne sa première récompense
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        id: userId,
                        balance: dailyAmount,
                        last_daily: new Date(), // Utiliser l'objet Date natif de JS pour Prisma
                    },
                });
                
                const embed = new EmbedBuilder()
                    .setTitle('🎁 Bienvenue et récompense !')
                    .setDescription(`C'est votre première fois ! Vous avez reçu **${dailyAmount} 🪙** !`)
                    .setColor('#00ff00');
                
                // *** CHANGEMENT : Utiliser editReply() après deferReply() ***
                return interaction.editReply({ embeds: [embed] });
            }
            
            // --- LOGIQUE DU COOLDOWN ---
            
            const lastDailyTime = user.last_daily ? moment(user.last_daily) : null;
            const now = moment();
            
            // Calcul du temps écoulé depuis la dernière récompense en millisecondes
            const timeSinceLastDailyMs = lastDailyTime ? now.diff(lastDailyTime) : dailyCooldownMs;
            
            // 2. Vérifier si le délai est écoulé
            if (timeSinceLastDailyMs >= dailyCooldownMs) {
                // Si le délai est écoulé : donner la récompense
                
                const newBalance = user.balance + dailyAmount;
                
                // *** PRISMA : UPDATE ***
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        balance: newBalance,
                        last_daily: new Date(), // Mettre à jour la date
                    }
                });
                
                const embed = new EmbedBuilder()
                    .setTitle('🎁 Récompense quotidienne !')
                    .setDescription(`Vous avez reçu **${dailyAmount} 🪙** ! Votre solde est maintenant de **${newBalance} 🪙**.`)
                    .setColor('#00ff00');
                
                // *** CHANGEMENT : Utiliser editReply() ***
                await interaction.editReply({ embeds: [embed] });

            } else {
                // Si moins de 24h se sont écoulées : afficher le temps restant
                
                // Calculer le temps restant
                const timeRemainingMs = dailyCooldownMs - timeSinceLastDailyMs;
                const timeRemainingDuration = moment.duration(timeRemainingMs);
                
                // Utiliser asHours pour obtenir les heures totales, et minutes() pour le reste
                const remainingHours = Math.floor(timeRemainingDuration.asHours()); 
                const remainingMinutes = timeRemainingDuration.minutes();
                
                const embed = new EmbedBuilder()
                    .setTitle('⏳ Récompense non disponible')
                    .setDescription(`Vous devez attendre encore **${remainingHours} heures et ${remainingMinutes} minutes** avant de pouvoir réclamer votre prochaine récompense.`)
                    .setColor('#ff9900');
                
                // *** CHANGEMENT : Utiliser editReply() ***
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Erreur lors de la commande /daily :', error);
            
            // Si une erreur survient (y compris une erreur DB), on utilise editReply()
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
            });
        } finally {
            // Fermeture optionnelle du client Prisma si vous le démarrez/arrêtez à chaque commande.
            // Il est souvent préférable de laisser le client ouvert (au début du bot) pour la performance.
            // await prisma.$disconnect(); 
        }
    },
};