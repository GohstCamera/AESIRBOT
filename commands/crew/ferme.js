const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

const COOLDOWN_DURATION = 3600000;

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

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [userRows] = await connection.execute(`
                SELECT u.crewId, u.farmCooldown, c.harvestBonusEndTime
                FROM User u
                LEFT JOIN Crew c ON u.crewId = c.id
                WHERE u.id = ? FOR UPDATE
            `, [interaction.user.id]);

            const user = userRows[0];

            if (!user || !user.crewId) {
                await connection.rollback();
                return interaction.editReply({ content: '❌ Tu dois être dans un clan pour utiliser cette commande !' });
            }

            const now = Date.now();
            if (user.farmCooldown && now < new Date(user.farmCooldown).getTime()) {
                const timeLeft = Math.ceil((new Date(user.farmCooldown).getTime() - now) / 1000);
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                await connection.rollback();
                return interaction.editReply({
                    content: `⏳ Tu dois attendre encore **${minutes} minutes et ${seconds} secondes** avant de pouvoir récolter de nouveau.`
                });
            }

            let gains = {};
            let bonusApplied = false;
            const harvestBonusEndTime = user.harvestBonusEndTime ? new Date(user.harvestBonusEndTime) : null;

            if (harvestBonusEndTime && now < harvestBonusEndTime.getTime()) {
                bonusApplied = true;
            }

            for (const resource of RESOURCES) {
                let baseGain = Math.floor(Math.random() * (resource.max - resource.min + 1)) + resource.min;
                let finalGain = bonusApplied ? Math.round(baseGain * 1.2) : baseGain;
                gains[resource.name] = finalGain;
            }

            await connection.execute(
                'UPDATE User SET farmCooldown = ? WHERE id = ?',
                [new Date(now + COOLDOWN_DURATION), interaction.user.id]
            );

            await connection.execute(
                'UPDATE Crew SET bois = bois + ?, pierre = pierre + ?, nourriture = nourriture + ? WHERE id = ?',
                [gains.bois, gains.pierre, gains.nourriture, user.crewId]
            );

            await connection.commit();

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
            await connection.rollback();
            console.error('❌ Erreur lors de l\'exécution de la commande /crew ferme :', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la récolte.' });
        } finally {
            connection.release();
        }
    }
};