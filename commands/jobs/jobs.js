const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

const JOBS_LIST = [
    { id: 'bucheron', name: 'Bûcheron', cost: { bois: 500, pierre: 100 }, description: 'Récolte du bois pour ton clan.', emoji: '🪓' },
    { id: 'chasseur', name: 'Chasseur', cost: { bois: 100, nourriture: 500 }, description: 'Chasse pour de la nourriture.', emoji: '🏹' },
    { id: 'perceur', name: 'Perceur de Coffre', cost: { bois: 200, pierre: 800 }, description: 'Attaque les réserves des autres clans.', emoji: '🕵️' },
    { id: 'pecheur', name: 'Pêcheur', cost: { bois: 300, nourriture: 100 }, description: 'Pêche pour de la nourriture et de l\'argent.', emoji: '🎣' },
    { id: 'ingenieur', name: 'Ingénieur', cost: { bois: 500, pierre: 500 }, description: 'Construis des améliorations pour ton clan.', emoji: '⚙️' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jobs')
        .setDescription('Gère l\'achat de nouveaux jobs.')
        .addStringOption(option =>
            option.setName('job')
                .setDescription('Le job que tu veux acheter.')
                .setRequired(true)
                .addChoices(
                    ...JOBS_LIST.map(job => ({ name: `${job.name} (${job.emoji})`, value: job.id }))
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [userRows] = await connection.execute(`
                SELECT u.professions, u.crewId, c.bois, c.pierre, c.nourriture
                FROM User u
                LEFT JOIN Crew c ON u.crewId = c.id
                WHERE u.id = ? FOR UPDATE
            `, [interaction.user.id]);

            const user = userRows[0];

            if (!user || !user.crewId) {
                await connection.rollback();
                return interaction.editReply({ content: '❌ Tu dois être dans un clan pour utiliser les jobs.' });
            }

            const jobId = interaction.options.getString('job');
            const jobToBuy = JOBS_LIST.find(job => job.id === jobId);

            if (!jobToBuy) {
                await connection.rollback();
                return interaction.editReply({ content: '❌ Ce job n\'existe pas.' });
            }

            const userJobs = user.professions ? user.professions.split(',').filter(j => j.length > 0) : [];
            if (userJobs.includes(jobId)) {
                await connection.rollback();
                return interaction.editReply({ content: `❌ Tu possèdes déjà le job de ${jobToBuy.name}.` });
            }

            const cost = jobToBuy.cost || {};
            const woodCost = cost.bois || 0;
            const stoneCost = cost.pierre || 0;
            const foodCost = cost.nourriture || 0;

            if (user.bois < woodCost || user.pierre < stoneCost || user.nourriture < foodCost) {
                const missingResources = [];
                if (user.bois < woodCost) missingResources.push(`${woodCost - user.bois} bois`);
                if (user.pierre < stoneCost) missingResources.push(`${stoneCost - user.pierre} pierre`);
                if (user.nourriture < foodCost) missingResources.push(`${foodCost - user.nourriture} nourriture`);

                await connection.rollback();
                return interaction.editReply({
                    content: `❌ Ton clan n'a pas assez de ressources pour acheter le job de ${jobToBuy.name}. Il vous manque : ${missingResources.join(', ')}.`,
                });
            }

            userJobs.push(jobId);
            const updatedJobsString = userJobs.join(',');

            await connection.execute(
                'UPDATE User SET professions = ? WHERE id = ?',
                [updatedJobsString, interaction.user.id]
            );

            await connection.execute(
                'UPDATE Crew SET bois = bois - ?, pierre = pierre - ?, nourriture = nourriture - ? WHERE id = ?',
                [woodCost, stoneCost, foodCost, user.crewId]
            );

            await connection.commit();

            const costString = Object.entries(cost).map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`✅ Job acheté !`)
                .setDescription(`Tu es maintenant un **${jobToBuy.name}** !`)
                .setColor('#2ecc71')
                .addFields(
                    { name: 'Coût', value: costString }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await connection.rollback();
            console.error('❌ Erreur lors de l\'achat de job :', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'achat du job.' });
        } finally {
            connection.release();
        }
    },
};