const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

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

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [userRows] = await connection.execute(`
                SELECT u.balance, u.crewId, c.bois, c.pierre, c.nourriture
                FROM User u
                LEFT JOIN Crew c ON u.crewId = c.id
                WHERE u.id = ? FOR UPDATE
            `, [interaction.user.id]);

            const user = userRows[0];

            if (!user || !user.crewId) {
                await connection.rollback();
                return interaction.editReply({ content: '❌ Tu dois être dans un clan pour vendre des ressources.' });
            }

            const currentQuantity = user[resourceToSell];
            if (currentQuantity === undefined) {
                await connection.rollback();
                return interaction.editReply({ content: '❌ Cette ressource n\'existe pas.' });
            }

            if (quantityToSell === null || quantityToSell > currentQuantity) {
                quantityToSell = currentQuantity;
            }

            if (quantityToSell <= 0) {
                await connection.rollback();
                return interaction.editReply({ content: `❌ Ton clan n'a pas de ${resourceToSell} à vendre.` });
            }

            const price = SELL_PRICES[resourceToSell];
            const totalGain = quantityToSell * price;

            await connection.execute(`UPDATE Crew SET \`${resourceToSell}\` = \`${resourceToSell}\` - ? WHERE id = ?`, [quantityToSell, user.crewId]);
            await connection.execute('UPDATE User SET balance = balance + ? WHERE id = ?', [totalGain, interaction.user.id]);

            await connection.commit();

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
            await connection.rollback();
            console.error(error);
            await interaction.editReply({ content: '❌ Erreur.' });
        } finally {
            connection.release();
        }
    }
};