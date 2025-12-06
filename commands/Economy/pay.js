const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Donne de l\'argent à un autre membre')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Le membre à qui vous voulez donner de l\'argent')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Le montant que vous voulez donner')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply();

        const sender = interaction.user;
        const recipient = interaction.options.getMember('member');
        const amount = interaction.options.getInteger('amount');

        if (recipient.user.bot) {
            return interaction.editReply({ content: '❌ Vous ne pouvez pas donner d\'argent à un bot.' });
        }
        if (sender.id === recipient.id) {
            return interaction.editReply({ content: '❌ Vous ne pouvez pas vous donner d\'argent à vous-même.' });
        }

        try {
            // Vérifier le solde de l'expéditeur et le créer s'il n'existe pas
            const senderUser = await prisma.user.upsert({
                where: { id: sender.id },
                update: {},
                create: { id: sender.id, balance: 0, last_daily: new Date(0) },
                select: { balance: true }
            });

            if (senderUser.balance < amount) {
                return interaction.editReply({ content: '❌ Vous n\'avez pas assez d\'argent pour effectuer cette transaction.' });
            }

            // Exécuter la transaction (débit, crédit et enregistrement)
            await prisma.$transaction(async (tx) => {
                // Créer le destinataire s'il n'existe pas, sans affecter son last_daily
                await tx.user.upsert({
                    where: { id: recipient.id },
                    update: {},
                    create: { id: recipient.id, balance: 0, last_daily: new Date(0) },
                });

                // Débiter l'expéditeur
                await tx.user.update({
                    where: { id: sender.id },
                    data: { balance: { decrement: amount } },
                });

                // Créditer le destinataire
                await tx.user.update({
                    where: { id: recipient.id },
                    data: { balance: { increment: amount } },
                });

                // Enregistrer la transaction dans la nouvelle table
                await tx.transaction.create({
                    data: {
                        senderId: sender.id,
                        recipientId: recipient.id,
                        amount: amount,
                    },
                });
            });

            const embed = new EmbedBuilder()
                .setTitle('💸 Transfert d\'argent réussi !')
                .setDescription(`**${sender.username}** a donné **${amount} 🪙** à **${recipient.user.username}**.`)
                .setColor('#3498db');

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de la commande /pay :', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
            });
        }
    },
};