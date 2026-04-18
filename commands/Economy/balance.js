const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Affiche votre solde ou celui d\'un autre membre')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre dont vous voulez voir le solde')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const member = interaction.options.getMember('member') || interaction.member;
        const userId = member.id;
        const initialBalance = 0;

        try {
            const [rows] = await db.execute('SELECT balance FROM User WHERE id = ?', [userId]);
            let userBalance;

            if (rows.length === 0) {
                await db.execute(
                    'INSERT INTO User (id, username, balance, last_daily) VALUES (?, ?, ?, ?)',
                    [userId, member.user.username, initialBalance, null]
                );
                userBalance = initialBalance;
            } else {
                userBalance = rows[0].balance;
            }

            const embed = new EmbedBuilder()
                .setTitle(`💰 Solde de ${member.user.username}`)
                .setDescription(`**Solde :** ${userBalance.toLocaleString()}€`)
                .setColor('#f4c430');

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de la récupération du solde :', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de la récupération du solde.',
            });
        }
    },
};