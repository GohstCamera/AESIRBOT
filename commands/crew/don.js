const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

const CONVERSION_RATES = {
    argent: 10,
    bois: 5,
    pierre: 8,
    nourriture: 4,
};

const RESOURCE_EMOJIS = {
    argent: '€',
    bois: '🪵',
    pierre: '🧱',
    nourriture: '🍖',
};

const INVENTORY_MAP = {
    bois: 'bois',
    pierre: 'pierre',
    nourriture: 'nourriture',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('don')
        .setDescription('Fais un don (argent ou ressources) pour augmenter la puissance de ton clan.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Le type de don à faire.')
                .setRequired(true)
                .addChoices(
                    { name: 'Argent', value: 'argent' },
                    { name: 'Bois', value: 'bois' },
                    { name: 'Pierre', value: 'pierre' },
                    { name: 'Nourriture', value: 'nourriture' }
                ))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le montant/quantité du don.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const donType = interaction.options.getString('type');
        const montant = interaction.options.getInteger('montant');
        const resourceEmoji = RESOURCE_EMOJIS[donType];

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [userRows] = await connection.execute(`
                SELECT u.*, c.name AS crewName, c.power AS crewPower
                FROM User u
                LEFT JOIN Crew c ON u.crewId = c.id
                WHERE u.id = ? FOR UPDATE
            `, [interaction.user.id]);

            const user = userRows[0];

            if (!user || !user.crewId) {
                await connection.rollback();
                return interaction.editReply({ content: '❌ Tu dois être dans un clan pour faire un don.' });
            }

            const conversionRate = CONVERSION_RATES[donType];
            const powerGain = Math.floor(montant / conversionRate);

            if (powerGain < 1) {
                await connection.rollback();
                return interaction.editReply({ content: `❌ Le montant est trop faible pour gagner de la puissance. Il faut au moins **${conversionRate} ${donType}** pour gagner 1 point.` });
            }

            let isBoostActive = false;
            let currentMaxDonation = user.maxDonation;

            if (donType === 'argent') {
                if (user.donationBoostExpiresAt && user.donationBoostExpiresAt > new Date()) {
                    currentMaxDonation += user.donationBoostValue;
                    isBoostActive = true;
                }

                const today = new Date().toDateString();
                const lastDonationDay = user.lastDonationDate ? new Date(user.lastDonationDate).toDateString() : null;
                let dailyDonationCount = user.dailyDonationCount;

                if (lastDonationDay !== today) {
                    dailyDonationCount = 0;
                }
                
                const donationRemaining = currentMaxDonation - dailyDonationCount;

                if (donationRemaining <= 0) {
                    await connection.rollback();
                    return interaction.editReply({
                        content: `❌ Tu as atteint ta limite de don quotidienne (**${currentMaxDonation.toLocaleString()}€**). Réessaie demain.`,
                    });
                }

                if (montant > donationRemaining) {
                    await connection.rollback();
                    return interaction.editReply({
                        content: `❌ Tu ne peux donner que **${donationRemaining.toLocaleString()}€** de plus aujourd'hui (Limite: ${currentMaxDonation.toLocaleString()}€).`
                    });
                }
                
                if (user.balance < montant) {
                    await connection.rollback();
                    return interaction.editReply({ content: `❌ Tu n'as pas assez d'argent. Il te manque **${(montant - user.balance).toLocaleString()}€**.` });
                }
                
                await connection.execute(
                    'UPDATE User SET balance = balance - ?, dailyDonationCount = ?, lastDonationDate = NOW() WHERE id = ?',
                    [montant, dailyDonationCount + montant, user.id]
                );
                
            } else {
                let userJobs = {};
                try {
                    userJobs = typeof user.jobsItems === 'string' ? JSON.parse(user.jobsItems || '{}') : (user.jobsItems || {});
                } catch (e) {
                    userJobs = {};
                }

                const inventoryKey = INVENTORY_MAP[donType];
                const userResourceStock = userJobs[inventoryKey] || 0;

                if (userResourceStock < montant) {
                    await connection.rollback();
                    return interaction.editReply({
                        content: `❌ Tu n'as pas assez de **${donType}** dans ton inventaire. Il te manque **${(montant - userResourceStock).toLocaleString()} ${resourceEmoji}**.` 
                    });
                }

                userJobs[inventoryKey] = userResourceStock - montant;
                await connection.execute('UPDATE User SET jobsItems = ? WHERE id = ?', [JSON.stringify(userJobs), user.id]);
            }

            await connection.execute(
                `UPDATE Crew SET power = power + ?, \`${donType}\` = \`${donType}\` + ? WHERE id = ?`,
                [powerGain, montant, user.crewId]
            );

            await connection.execute(
                'INSERT INTO Transaction (senderId, recipientId, amount, type, crewId) VALUES (?, ?, ?, ?, ?)',
                [user.id, user.crewId, montant, 'CREW_DONATION', user.crewId]
            );

            await connection.commit();

            const embed = new EmbedBuilder()
                .setTitle(`🤝 Don de ${donType} réussi pour ${user.crewName}`)
                .setDescription(`Tu as donné **${montant.toLocaleString()} ${resourceEmoji}** de ${donType} au clan !`)
                .addFields(
                    { name: '💪 Puissance Gagnée', value: `+**${powerGain.toLocaleString()}** 💪`, inline: true },
                    { name: `${donType.charAt(0).toUpperCase() + donType.slice(1)} ajouté au stock`, value: `+**${montant.toLocaleString()} ${resourceEmoji}**`, inline: true },
                    { name: 'Total Puissance du Clan (Avant Don)', value: `${(user.crewPower).toLocaleString()} 💪`, inline: false }
                )
                .setColor(donType === 'argent' ? '#2ecc71' : '#e67e22')
                .setTimestamp();
            
            if (donType === 'argent') {
                const newDailyCount = (user.lastDonationDate && new Date(user.lastDonationDate).toDateString() === new Date().toDateString() ? user.dailyDonationCount : 0) + montant;
                const remaining = currentMaxDonation - newDailyCount;

                if (isBoostActive) embed.setFooter({ text: '🚀 Bonus de don actif !' });
                embed.addFields({
                    name: `Limite de Don (Aujourd'hui)`, 
                    value: `**${newDailyCount.toLocaleString()}€** donnés sur **${currentMaxDonation.toLocaleString()}€** (${remaining > 0 ? `${remaining.toLocaleString()}€ restants` : 'Limite atteinte'})`,
                    inline: false 
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await connection.rollback();
            console.error('❌ Erreur critique lors du don de clan :', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande de don.' });
        } finally {
            connection.release();
        }
    }
};