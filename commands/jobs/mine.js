const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

const PICKAXE_BONUS = { basique: 1, fer: 1.5, diamant: 2.0 };
const WAGON_CAPACITY = { petit: 100, moyen: 200, grand: 500 };
const BASE_RATES = { pierre: 20, metal: 10, charbon: 5, or: 1 };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('Partir miner pour récolter des ressources.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [userRows] = await connection.execute('SELECT * FROM User WHERE id = ? FOR UPDATE', [interaction.user.id]);
            const user = userRows[0];

            if (!user || !user.crewId) {
                await connection.rollback();
                return interaction.editReply({ content: '❌ Tu dois être dans un clan pour miner.' });
            }

            const now = Date.now();
            const COOLDOWN_DURATION = 3600000;
            if (user.mineCooldown && now < new Date(user.mineCooldown).getTime()) {
                const timeLeft = Math.ceil((new Date(user.mineCooldown).getTime() - now) / 60000);
                await connection.rollback();
                return interaction.editReply({ content: `⏳ Attends encore **${timeLeft} minutes**.` });
            }

            const pickaxe = user.pickaxe || 'basique';
            const wagon = user.wagon || 'petit';
            const pickaxeBonus = PICKAXE_BONUS[pickaxe] || 1;
            const wagonCapacity = WAGON_CAPACITY[wagon] || 100;

            if (pickaxe === 'basique') {
                await connection.rollback();
                return interaction.editReply({ content: `❌ Tu n'as pas de pioche.` });
            }

            let gains = {};
            let totalGains = 0;

            for (const resource in BASE_RATES) {
                if (pickaxe === 'fer' && (resource === 'charbon' || resource === 'or')) continue;
                if (pickaxe === 'diamant' || (pickaxe === 'fer' && resource === 'metal') || resource === 'pierre') {
                    const gain = Math.floor(BASE_RATES[resource] * pickaxeBonus);
                    gains[resource] = gain;
                    totalGains += gain;
                }
            }

            if (totalGains > wagonCapacity) {
                const ratio = wagonCapacity / totalGains;
                for (const resource in gains) {
                    gains[resource] = Math.floor(gains[resource] * ratio);
                }
                totalGains = wagonCapacity;
            }

            let gainFields = [];
            for (const resource in gains) {
                if (gains[resource] > 0) {
                    gainFields.push({ name: resource.charAt(0).toUpperCase() + resource.slice(1), value: `+${gains[resource]}`, inline: true });
                }
            }

            await connection.execute('UPDATE User SET mineCooldown = ? WHERE id = ?', [new Date(now + COOLDOWN_DURATION), user.id]);

            const updateQueries = Object.keys(gains).map(res => `\`${res}\` = \`${res}\` + ?`).join(', ');
            if (updateQueries) {
                await connection.execute(`UPDATE Crew SET ${updateQueries} WHERE id = ?`, [...Object.values(gains), user.crewId]);
            }

            await connection.commit();

            const embed = new EmbedBuilder()
                .setTitle('⛏️ Minage terminé !')
                .setDescription(`Wagon rempli à ${Math.round((totalGains / wagonCapacity) * 100)}%.`)
                .setColor('#7f8c8d')
                .addFields(gainFields)
                .setFooter({ text: `Pioche: ${pickaxe} | Wagon: ${wagon}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await connection.rollback();
            console.error(error);
            await interaction.editReply({ content: '❌ Erreur.' });
        } finally {
            connection.release();
        }
    },
};