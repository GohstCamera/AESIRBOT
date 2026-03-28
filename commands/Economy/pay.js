const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

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

        const connection = await db.getConnection(); // Récupère une connexion du pool
        try {
            await connection.beginTransaction(); // Démarre la transaction

            // S'assurer que l'expéditeur existe et vérifier son solde
            await connection.execute(
                'INSERT INTO User (id, username, balance) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE id=id',
                [sender.id, sender.username]
            );
            const [senderRows] = await connection.execute('SELECT balance FROM User WHERE id = ? FOR UPDATE', [sender.id]);
            const senderUser = senderRows[0];

            if (senderUser.balance < amount) {
                await connection.rollback(); // Annule la transaction
                return interaction.editReply({ content: '❌ Vous n\'avez pas assez d\'argent pour effectuer cette transaction.' });
            }

            // S'assurer que le destinataire existe
            await connection.execute(
                'INSERT INTO User (id, username, balance) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE id=id',
                [recipient.id, recipient.user.username]
            );

            // Débiter l'expéditeur
            await connection.execute('UPDATE User SET balance = balance - ? WHERE id = ?', [amount, sender.id]);

            // Créditer le destinataire
            await connection.execute('UPDATE User SET balance = balance + ? WHERE id = ?', [amount, recipient.id]);

            // Enregistrer la transaction
            await connection.execute(
                'INSERT INTO Transaction (senderId, recipientId, amount, type) VALUES (?, ?, ?, ?)',
                [sender.id, recipient.id, amount, 'P2P_TRANSFER']
            );

            await connection.commit(); // Valide la transaction

            const embed = new EmbedBuilder()
                .setTitle('💸 Transfert d\'argent réussi !')
                .setDescription(`**${sender.username}** a donné **${amount} 🪙** à **${recipient.user.username}**.`)
                .setColor('#3498db');

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await connection.rollback(); // Annule la transaction en cas d'erreur
            console.error('Erreur lors de la commande /pay :', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
            });
        } finally {
            connection.release(); // Libère la connexion pour qu'elle retourne au pool
        }
    },
};