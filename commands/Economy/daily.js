const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database'); // Importe la connexion MySQL
const moment = require('moment');

const dailyAmount = 10;
const dailyCooldownMs = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Récupère votre récompense quotidienne'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        const userId = interaction.user.id;

        try {
            // 1. Récupérer les données de l'utilisateur
            const [rows] = await db.execute('SELECT balance, last_daily FROM User WHERE id = ?', [userId]);
            let user = rows[0];

            // Si l'utilisateur n'existe pas, on le crée et on lui donne sa première récompense
            if (!user) {
                await db.execute(
                    'INSERT INTO User (id, username, balance, last_daily) VALUES (?, ?, ?, ?)',
                    [userId, interaction.user.username, dailyAmount, new Date()]
                );
                
                const embed = new EmbedBuilder()
                    .setTitle('🎁 Bienvenue et récompense !')
                    .setDescription(`C'est votre première fois ! Vous avez reçu **${dailyAmount} 🪙** !`)
                    .setColor('#00ff00');
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // --- LOGIQUE DU COOLDOWN ---
            const lastDailyTime = user.last_daily ? moment(user.last_daily) : null;
            const now = moment();
            
            const timeSinceLastDailyMs = lastDailyTime ? now.diff(lastDailyTime) : dailyCooldownMs;
            
            // 2. Vérifier si le délai est écoulé
            if (timeSinceLastDailyMs >= dailyCooldownMs) {
                // Si le délai est écoulé : donner la récompense
                const newBalance = user.balance + dailyAmount;
                
                await db.execute(
                    'UPDATE User SET balance = ?, last_daily = ? WHERE id = ?',
                    [newBalance, new Date(), userId]
                );
                
                const embed = new EmbedBuilder()
                    .setTitle('🎁 Récompense quotidienne !')
                    .setDescription(`Vous avez reçu **${dailyAmount} 🪙** ! Votre solde est maintenant de **${newBalance} 🪙**.`)
                    .setColor('#00ff00');
                
                await interaction.editReply({ embeds: [embed] });

            } else {
                // Si moins de 24h se sont écoulées : afficher le temps restant
                const timeRemainingMs = dailyCooldownMs - timeSinceLastDailyMs;
                const timeRemainingDuration = moment.duration(timeRemainingMs);
                
                const remainingHours = Math.floor(timeRemainingDuration.asHours());
                const remainingMinutes = timeRemainingDuration.minutes();
                
                const embed = new EmbedBuilder()
                    .setTitle('⏳ Récompense non disponible')
                    .setDescription(`Vous devez attendre encore **${remainingHours} heures et ${remainingMinutes} minutes** avant de pouvoir réclamer votre prochaine récompense.`)
                    .setColor('#ff9900');
                
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Erreur lors de la commande /daily :', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
            });
        }
    },
};