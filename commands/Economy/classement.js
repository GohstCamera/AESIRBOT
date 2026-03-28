const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('classement')
        .setDescription('Affiche le classement des meilleurs utilisateurs en argent.'),
    
    async execute(interaction) {
        await interaction.deferReply();

        const client = interaction.client;

        try {
            // 1. Récupérer les 10 premiers utilisateurs avec le plus d'argent
            const [topUsers] = await db.execute(
                'SELECT id, username, balance FROM User ORDER BY balance DESC LIMIT 10'
            );

            let classementText = '';
            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                
                let discordUser;
                try {
                    discordUser = await client.users.fetch(user.id);
                } catch (e) {
                    discordUser = null;
                }
                
                const username = discordUser ? discordUser.username : (user.username || `Utilisateur Supprimé (${user.id})`);
                
                const emoji = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                
                classementText += `${emoji} **#${i + 1}** ${username} : **${user.balance.toLocaleString()}€**\n`;
            }

            // 2. Trouver la position de l'utilisateur qui a fait la commande
            const [userBalanceRows] = await db.execute('SELECT balance FROM User WHERE id = ?', [interaction.user.id]);
            const userBalance = userBalanceRows[0]?.balance || 0;

            const [rankRows] = await db.execute('SELECT COUNT(*) as rank FROM User WHERE balance > ?', [userBalance]);
            const userRank = rankRows[0].rank + 1;

            // 3. Construction de l'Embed
            const embed = new EmbedBuilder()
                .setTitle('🏆 Classement des utilisateurs')
                .setColor('#FFD700')
                .setDescription(classementText || 'Aucun utilisateur n\'a d\'argent pour le moment.')
                .setTimestamp()
                .setFooter({
                    text: `Classement consulté par ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            // Ajouter la position de l'utilisateur si non visible dans le top 10
            if (userRank > 10) {
                embed.addFields({
                    name: 'Votre position',
                    value: `Vous êtes actuellement à la **#${userRank}** place avec **${userBalance.toLocaleString()}€**.`,
                    inline: false,
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(`Erreur lors de l'exécution de la commande /classement:`, error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de la création du classement.',
                ephemeral: false
            });
        }
    }
};