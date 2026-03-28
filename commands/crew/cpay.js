const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

const CONFIG = {
    CLAN_SHARE_PERCENT: 0.70,
    USER_SHARE_PERCENT: 0.30,
    DIAMONDS_PER_100_EURO: 20, 
    DIAMONDS_PER_100_RESOURCE: 30,
    NOTORIETY_PER_DIAMOND: 2, 
    COST_PER_RESOURCE_UNIT: 1,
};

function shouldResetDailyCount(lastDate) {
    if (!lastDate) return true;
    const today = new Date();
    const last = new Date(lastDate);
    return today.toDateString() !== last.toDateString();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cpay')
        .setDescription('Faire un don d\'argent ou de ressources pour générer des Diamants et de la Notoriété.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('argent')
                .setDescription('Faire un don de monnaie (€). Génère des Diamants (Clan/Perso) et de la Notoriété.')
                .addIntegerOption(option =>
                    option.setName('montant')
                        .setDescription('Le montant en € à donner (Min. 100€).')
                        .setRequired(true)
                        .setMinValue(100)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ressource')
                .setDescription('Acheter une ressource pour le clan. Génère des Diamants (Clan/Perso) et de la Notoriété.')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Le type de ressource à donner.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Bois 🪵', value: 'bois' },
                            { name: 'Pierre 🧱', value: 'pierre' },
                            { name: 'Nourriture 🍖', value: 'nourriture' },
                        )
                )
                .addIntegerOption(option =>
                    option.setName('quantite')
                        .setDescription('La quantité de ressource à donner (Min. 100 unités).')
                        .setRequired(true)
                        .setMinValue(100)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [userRows] = await connection.execute(`
                SELECT u.*, c.name AS crewName, c.diamants AS crewDiamants, c.bois, c.pierre, c.nourriture
                FROM User u
                LEFT JOIN Crew c ON u.crewId = c.id
                WHERE u.id = ? FOR UPDATE
            `, [userId]);

            const user = userRows[0];

            if (!user || !user.crewId) {
                await connection.rollback();
                return interaction.editReply({
                    content: '❌ Vous devez faire partie d\'un clan pour faire un don !',
                });
            }

            let finalUserUpdate = {};
            let finalCrewUpdate = {};
            let embedDescription = '';
            let totalDiamondsGenerated = 0;
            let transactionAmount = 0;

            let currentDonationCount = user.dailyDonationCount || 0;
            const donationLimit = user.maxDonation || 10;

            if (shouldResetDailyCount(user.lastDonationDate)) {
                currentDonationCount = 0;
            }

            if (currentDonationCount >= donationLimit) {
                await connection.rollback();
                return interaction.editReply({
                    content: `⏳ Vous avez atteint la limite de **${donationLimit} dons** pour aujourd'hui. Réessayez demain !`,
                });
            }

            const newDonationCount = currentDonationCount + 1;

            if (subcommand === 'argent') {
                const amount = interaction.options.getInteger('montant');
                transactionAmount = amount;
                
                if (user.balance < amount) {
                    await connection.rollback();
                    return interaction.editReply({ content: `❌ Vous n'avez pas assez d'argent. Votre solde actuel est de ${user.balance.toLocaleString()}€.` });
                }

                const ratio = Math.floor(amount / 100);
                totalDiamondsGenerated = ratio * CONFIG.DIAMONDS_PER_100_EURO;

                const generatedClanDiamants = Math.round(totalDiamondsGenerated * CONFIG.CLAN_SHARE_PERCENT);
                const generatedUserDiamants = totalDiamondsGenerated - generatedClanDiamants;
                const generatedNotoriety = totalDiamondsGenerated * CONFIG.NOTORIETY_PER_DIAMOND;

                finalUserUpdate = {
                    balance: user.balance - amount,
                    diamants: user.diamants + generatedUserDiamants,
                    notoriety: user.notoriety + generatedNotoriety,
                    dailyDonationCount: newDonationCount,
                    lastDonationDate: new Date(),
                };

                finalCrewUpdate = { diamants: user.crewDiamants + generatedClanDiamants };

                embedDescription = `Vous avez donné **${amount.toLocaleString()}€** à votre clan, **${user.crewName}** !`
                                 + `\n\n**Récompenses de la transaction (Total ${totalDiamondsGenerated} 💎):**`
                                 + `\n+ **${generatedClanDiamants.toLocaleString()} 💎** pour le Clan (70%).`
                                 + `\n+ **${generatedUserDiamants.toLocaleString()} 💎** pour vous (30%).`
                                 + `\n+ **${generatedNotoriety.toLocaleString()} Notoriété** pour vous.`;

            } else if (subcommand === 'ressource') {
                const type = interaction.options.getString('type');
                const quantity = interaction.options.getInteger('quantite');
                const totalCost = quantity * CONFIG.COST_PER_RESOURCE_UNIT; 
                transactionAmount = totalCost;
                
                if (user.balance < totalCost) {
                    await connection.rollback();
                    return interaction.editReply({ content: `❌ Pour acheter ${quantity.toLocaleString()} de ${type} et les donner, vous avez besoin de ${totalCost.toLocaleString()}€. Votre solde actuel est de ${user.balance.toLocaleString()}€.` });
                }

                const ratio = Math.floor(quantity / 100);
                totalDiamondsGenerated = ratio * CONFIG.DIAMONDS_PER_100_RESOURCE;

                const generatedClanDiamants = Math.round(totalDiamondsGenerated * CONFIG.CLAN_SHARE_PERCENT);
                const generatedUserDiamants = totalDiamondsGenerated - generatedClanDiamants;
                const generatedNotoriety = totalDiamondsGenerated * CONFIG.NOTORIETY_PER_DIAMOND;

                finalUserUpdate = {
                    balance: user.balance - totalCost,
                    diamants: user.diamants + generatedUserDiamants,
                    notoriety: user.notoriety + generatedNotoriety,
                    dailyDonationCount: newDonationCount,
                    lastDonationDate: new Date(),
                };

                finalCrewUpdate = {
                    diamants: user.crewDiamants + generatedClanDiamants,
                    [type]: user[type] + quantity
                };

                embedDescription = `Vous avez acheté et donné **${quantity.toLocaleString()} ${type}** à votre clan, **${user.crewName}** (Coût: ${totalCost.toLocaleString()}€) !`
                                 + `\n\n**Récompenses de la transaction (Total ${totalDiamondsGenerated} 💎):**`
                                 + `\n+ **${generatedClanDiamants.toLocaleString()} 💎** pour le Clan (70%).`
                                 + `\n+ **${generatedUserDiamants.toLocaleString()} 💎** pour vous (30%).`
                                 + `\n+ **${generatedNotoriety.toLocaleString()} Notoriété** pour vous.`;
            }

            await connection.execute(
                'UPDATE User SET balance = ?, diamants = ?, notoriety = ?, dailyDonationCount = ?, lastDonationDate = ? WHERE id = ?',
                [finalUserUpdate.balance, finalUserUpdate.diamants, finalUserUpdate.notoriety, finalUserUpdate.dailyDonationCount, finalUserUpdate.lastDonationDate, userId]
            );

            const crewUpdateFields = Object.keys(finalCrewUpdate).map(key => `\`${key}\` = ?`).join(', ');
            const crewUpdateValues = Object.values(finalCrewUpdate);
            await connection.execute(`UPDATE Crew SET ${crewUpdateFields} WHERE id = ?`, [...crewUpdateValues, user.crewId]);

            await connection.execute(
                'INSERT INTO Transaction (senderId, recipientId, amount, type, crewId) VALUES (?, ?, ?, ?, ?)',
                [userId, userId, transactionAmount, 'CREW_DONATION', user.crewId]
            );

            await connection.commit();

            const finalEmbed = new EmbedBuilder()
                .setTitle('Don au Clan Réussi ! 🎉')
                .setDescription(embedDescription)
                .setColor('Green')
                .setFooter({
                    text: `Dons restants aujourd'hui: ${donationLimit - newDonationCount} | Solde: ${finalUserUpdate.balance.toLocaleString()}€ | Diamants: ${finalUserUpdate.diamants.toLocaleString()} 💎 | Notoriété: ${finalUserUpdate.notoriety.toLocaleString()} ✨`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [finalEmbed] });

        } catch (error) {
            await connection.rollback();
            console.error('❌ ERREUR-CPAY] Échec de l\'exécution de /cpay:', error);
            await interaction.editReply({ content: 'Une erreur inattendue est survenue.' });
        } finally {
            connection.release();
        }
    },
};