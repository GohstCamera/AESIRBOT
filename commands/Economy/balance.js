const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
            let user = await prisma.user.findUnique({
                where: { id: userId },
                select: { balance: true }
            });

            let userBalance = 0;

            if (!user) {
                // The user doesn't exist, so we need to create them.
                // We MUST provide the 'last_daily' field as it's required in your schema.
                user = await prisma.user.create({
                    data: {
                        id: userId,
                        balance: initialBalance,
                        last_daily: new Date(0), // Set to a very old date so they can use /daily immediately
                    },
                    select: { balance: true }
                });
                userBalance = user.balance;
            } else {
                userBalance = user.balance;
            }

            const embed = new EmbedBuilder()
                .setTitle(`💰 Solde de ${member.user.username}`)
                .setDescription(`**Solde :** ${userBalance} 🪙`)
                .setColor('#f4c430');

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de la récupération du solde :', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de la récupération du solde.',
                ephemeral: false
            });
        }
    },
};