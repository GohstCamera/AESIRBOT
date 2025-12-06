const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Définition de TOUS les articles de la boutique
const shopItems = [
    {
        id: 'crew_item_1',
        name: 'Pack de Ressources 📦',
        description: 'Un lot de ressources pour votre clan.',
        price: 250,
        emoji: '📦',
        type: 'ressource',
        givesDiamants: 5, // Ajout pour la logique : donne 5 diamants au clan/joueur
        givesNotoriety: 10, // Ajout pour la logique : donne 10 notoriété au joueur
    },
    {
        id: 'crew_item_2',
        name: 'Bannière de Clan ✨',
        description: 'Une bannière décorative pour votre base de clan.',
        price: 500,
        emoji: '✨',
        type: 'cosmetic',
        givesDiamants: 10,
        givesNotoriety: 20,
    },
    {
        id: 'crew_item_3',
        name: 'Bonus de Récolte 🌾',
        description: 'Augmente la récolte de ressources de 20% pendant 24h.',
        price: 750,
        emoji: '🌾',
        type: 'bonus',
        duration: 24,
        multiplier: 1.2,
        givesDiamants: 15,
        givesNotoriety: 30,
    },
    // Les Boucliers sont souvent achetés par le clan avec des Diamants, mais ici ils sont pour l'utilisateur
    {
        id: 'crew_shield_1',
        name: '🛡️ Bouclier de Fer',
        description: 'Protège votre clan des attaques pendant 12 heures.',
        price: 1500,
        type: 'shield',
        duration: 12, 
        protection: 0.25, 
        givesDiamants: 30,
        givesNotoriety: 50,
    }
,   // 1. NON PERMANENT (Monnaie personnelle €)
    {
        id: 'crew_don_temp_1',
        name: '🚀 Don Boost (24h)',
        description: 'Augmente la limite de don de 10€ pour 24 heures.',
        price: 300, 
        currency: 'euros', // Nouvelle propriété
        donationBonus: 10,
        durationHours: 24, // Nouvelle propriété
        emoji: '🚀',
        type: 'boost_don',
        givesDiamants: 5,
        givesNotoriety: 10,
    },
    
    // 2. NON PERMANENT (Diamants personnels 💎) - Plus cher car acheté en Diamants
    {
        id: 'crew_don_temp_2',
        name: '✨ Don Ultime (48h)',
        description: 'Augmente la limite de don de 20€ pour 48 heures.',
        price: 50, // Prix en Diamants (moins cher en quantité, plus cher en valeur)
        currency: 'diamants', // Nouvelle propriété
        donationBonus: 20,
        durationHours: 48, // Nouvelle propriété
        emoji: '✨',
        type: 'boost_don',
        givesDiamants: 15,
        givesNotoriety: 30,
    },

    // 3. PERMANENT (Monnaie personnelle €) - Le plus cher, mais définitif
    {
        id: 'crew_don_perm_1',
        name: '👑 Limite de Don Définitive',
        description: 'Augmente votre limite de don maximum de 25€ de manière permanente.',
        price: 10000,
        currency: 'euros',
        donationBonus: 25,
        isPermanent: true, // Nouvelle propriété
        emoji: '👑',
        type: 'perk_perm',
        givesDiamants: 50,
        givesNotoriety: 100,
    },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crewboutique')
        .setDescription('Ouvre la boutique de clan.'),
    
    shopItems,

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // 1. Récupération des données utilisateur et de clan
        const user = await prisma.user.findUnique({
            where: { id: interaction.user.id },
            select: { 
                balance: true, 
                diamants: true, // Diamants personnels
                crewId: true, 
                crewRole: true,
                crew: { 
                    select: { diamants: true, name: true, emoji: true } // Diamants du clan
                } 
            }
        });
        
        // Vérification du clan
        if (!user || !user.crewId || !user.crew) {
            return interaction.editReply({ 
                content: 'Vous devez faire partie d\'un clan pour accéder à la boutique de clan !', 
                ephemeral: true 
            });
        }

        // Définition des rôles
        const isOfficerOrHigher = user.crewRole === 'CAPTAIN' || user.crewRole === 'OFFICER';
        const userRole = user.crewRole || 'MEMBER';
        const crew = user.crew;
        
        // Message d'instruction basé sur le rôle
        let description = `Bienvenue à la boutique de **${crew.name}** !`;

        if (isOfficerOrHigher) {
            description += `\nEn tant qu'**${userRole}**, vous pouvez acheter des améliorations pour le clan. Ces achats sont faits avec votre monnaie personnelle (€) et génèrent des Diamants pour le Clan et de la Notoriété pour vous.`;
        } else {
            description += `\nCes articles sont des dons à votre clan. Chaque achat avec votre monnaie personnelle (€) génère des **Diamants pour le Clan** et de la **Notoriété pour vous**.`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${crew.emoji || '🛍️'} Boutique de Clan - ${crew.name}`)
            .setDescription(description)
            .addFields(
                { name: '💰 Votre Solde', value: `${user.balance.toLocaleString()}€`, inline: true },
                { name: '💎 Vos Diamants', value: `${user.diamants.toLocaleString()} 💎`, inline: true },
                { name: '💎 Diamants du Clan', value: `${crew.diamants.toLocaleString()} 💎`, inline: true },
            )
            .setColor('#2ecc71');

        const menuOptions = shopItems.map(item => {
            // Description détaillée pour le menu
            const detailDescription = 
                `${item.description} | +${item.givesDiamants} 💎 Clan & +${item.givesNotoriety} Notoriété.`;
            
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name} (${item.price}€)`)
                .setDescription(detailDescription.substring(0, 100)) // Limiter à 100 caractères
                .setValue(item.id)
                .setEmoji(item.emoji || '🛒')
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('crew_shop_select')
            .setPlaceholder('Sélectionne un article à acheter...')
            .addOptions(menuOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
            embeds: [embed],
            components: [row],
            ephemeral: true,
        });
    },
};