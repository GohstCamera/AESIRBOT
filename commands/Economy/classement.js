const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('classement')
        .setDescription('Affiche le classement des meilleurs utilisateurs en argent.'),
    
    async execute(interaction) {
        await interaction.deferReply();

        // Récupère l'instance du client globalement
        const client = interaction.client; 

        try {
            // 1. Récupérer les 10 premiers utilisateurs avec le plus d'argent
            const topUsers = await prisma.user.findMany({
                orderBy: {
                    balance: 'desc',
                },
                take: 10,
            });

            let classementText = '';
            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                
                // --- CORRECTION CLÉ : Utiliser client.users.fetch() ---
                // Cela récupère l'utilisateur GLOBALEMENT via l'API Discord,
                // sans dépendre de sa présence sur le serveur actuel (interaction.guild).
                let discordUser;
                try {
                    discordUser = await client.users.fetch(user.id);
                } catch (e) {
                    // Si l'utilisateur a supprimé son compte ou est inaccessible
                    discordUser = null; 
                }
                
                // Utiliser le tag si disponible, sinon un message d'erreur clair
                const username = discordUser ? discordUser.username : `Utilisateur Supprimé (${user.id})`;
                // --------------------------------------------------------
                
                const emoji = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                
                classementText += `${emoji} **#${i + 1}** ${username} : **${user.balance.toLocaleString()}€**\n`;
            }

            // 2. Trouver la position de l'utilisateur qui a fait la commande
            const userBalance = await prisma.user.findUnique({
                where: { id: interaction.user.id },
                select: { balance: true }
            });
            
            // Le calcul du rang est correct : compte ceux qui ont un solde plus grand.
            const userRank = await prisma.user.count({
                where: { balance: { gt: userBalance?.balance || 0 } }
            }) + 1;

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
                    value: `Vous êtes actuellement à la **#${userRank}** place avec **${(userBalance?.balance || 0).toLocaleString()}€**.`,
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