const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/database');

const shopItems = [
    { id: 'crew_item_1', name: 'Pack de Ressources 📦', description: 'Un lot de ressources pour votre clan.', price: 250, emoji: '📦', type: 'ressource', givesDiamants: 5, givesNotoriety: 10 },
    { id: 'crew_item_2', name: 'Bannière de Clan ✨', description: 'Une bannière décorative pour votre base de clan.', price: 500, emoji: '✨', type: 'cosmetic', givesDiamants: 10, givesNotoriety: 20 },
    { id: 'crew_item_3', name: 'Bonus de Récolte 🌾', description: 'Augmente la récolte de ressources de 20% pendant 24h.', price: 750, emoji: '🌾', type: 'bonus', duration: 24, multiplier: 1.2, givesDiamants: 15, givesNotoriety: 30 },
    { id: 'crew_shield_1', name: '🛡️ Bouclier de Fer', description: 'Protège votre clan des attaques pendant 12 heures.', price: 1500, type: 'shield', duration: 12, protection: 0.25, givesDiamants: 30, givesNotoriety: 50 },
    { id: 'crew_don_temp_1', name: '🚀 Don Boost (24h)', description: 'Augmente la limite de don de 10€ pour 24 heures.', price: 300, currency: 'euros', donationBonus: 10, durationHours: 24, emoji: '🚀', type: 'boost_don', givesDiamants: 5, givesNotoriety: 10 },
    { id: 'crew_don_temp_2', name: '✨ Don Ultime (48h)', description: 'Augmente la limite de don de 20€ pour 48 heures.', price: 50, currency: 'diamants', donationBonus: 20, durationHours: 48, emoji: '✨', type: 'boost_don', givesDiamants: 15, givesNotoriety: 30 },
    { id: 'crew_don_perm_1', name: '👑 Limite de Don Définitive', description: 'Augmente votre limite de don maximum de 25€ de manière permanente.', price: 10000, currency: 'euros', donationBonus: 25, isPermanent: true, emoji: '👑', type: 'perk_perm', givesDiamants: 50, givesNotoriety: 100 },
];

module.exports = {
    data: new SlashCommandBuilder().setName('crewboutique').setDescription('Ouvre la boutique de clan.'),
    shopItems,
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const [userRows] = await db.execute(`
            SELECT u.balance, u.diamants, u.crewId, u.crewRole, c.name AS crewName, c.emoji AS crewEmoji, c.diamants AS crewDiamants
            FROM User u
            LEFT JOIN Crew c ON u.crewId = c.id
            WHERE u.id = ?
        `, [interaction.user.id]);

        const user = userRows[0];

        if (!user || !user.crewId) {
            return interaction.editReply({ content: 'Vous devez faire partie d\'un clan pour accéder à la boutique de clan !' });
        }

        const isOfficerOrHigher = user.crewRole === 'CAPTAIN' || user.crewRole === 'OFFICER';
        let description = `Bienvenue à la boutique de **${user.crewName}** !`;
        if (isOfficerOrHigher) {
            description += `\nEn tant qu'**${user.crewRole}**, vous pouvez acheter des améliorations pour le clan.`;
        } else {
            description += `\nCes articles sont des dons à votre clan.`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${user.crewEmoji || '🛍️'} Boutique de Clan - ${user.crewName}`)
            .setDescription(description)
            .addFields(
                { name: '💰 Votre Solde', value: `${user.balance.toLocaleString()}€`, inline: true },
                { name: '💎 Vos Diamants', value: `${user.diamants.toLocaleString()} 💎`, inline: true },
                { name: '💎 Diamants du Clan', value: `${user.crewDiamants.toLocaleString()} 💎`, inline: true },
            )
            .setColor('#2ecc71');

        const menuOptions = shopItems.map(item => {
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name} (${item.price}${item.currency === 'diamants' ? '💎' : '€'})`)
                .setDescription(`${item.description.substring(0, 50)}...`)
                .setValue(item.id)
                .setEmoji(item.emoji || '🛒')
        });

        const selectMenu = new StringSelectMenuBuilder().setCustomId('crew_shop_select').setPlaceholder('Sélectionne un article...').addOptions(menuOptions);
        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};