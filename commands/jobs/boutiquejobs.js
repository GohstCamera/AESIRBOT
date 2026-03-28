const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

const SHOP_ITEMS = {
    pioches: [
        { id: 'fer', name: 'Pioche en Fer', price: 1000, emoji: '⛏️', description: 'Augmente la récolte de 50%.' },
        { id: 'diamant', name: 'Pioche en Diamant', price: 5000, emoji: '💎', description: 'Double la récolte !' },
    ],
    wagons: [
        { id: 'moyen', name: 'Wagon Moyen', price: 1500, emoji: '火车', description: 'Capacité de 200 ressources.' },
        { id: 'grand', name: 'Grand Wagon', price: 6000, emoji: '🚛', description: 'Capacité de 500 ressources.' },
    ],
    jobs: [
        { id: 'hache', name: 'Hache de Bûcheron', price: 750, emoji: '🪓', description: 'Nécessaire pour le job de Bûcheron.' },
        { id: 'filet', name: 'Filet de Pêche', price: 600, emoji: '🎣', description: 'Permet de pêcher plus de nourriture.' },
        { id: 'grenade', name: 'Grenade IEM', price: 1200, emoji: '💣', description: 'Permet d\'attaquer plus efficacement les clans.' },
        { id: 'outils', name: 'Boîte à Outils', price: 900, emoji: '🔧', description: 'Indispensable pour le job d\'Ingénieur.' },
        { id: 'couteau', name: 'Couteau de Chasse', price: 850, emoji: '🔪', description: 'Améliore la récolte de viande.' }
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boutiquejobs')
        .setDescription('Ouvre la boutique des jobs et des équipements.'),
    
    async execute(interaction) {
        const piochesOptions = SHOP_ITEMS.pioches.map(item =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.emoji} ${item.name} (${item.price}€)`)
                .setDescription(item.description)
                .setValue(`pioche_${item.id}`)
        );

        const wagonsOptions = SHOP_ITEMS.wagons.map(item =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.emoji} ${item.name} (${item.price}€)`)
                .setDescription(item.description)
                .setValue(`wagon_${item.id}`)
        );

        const jobsOptions = SHOP_ITEMS.jobs.map(item =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.emoji} ${item.name} (${item.price}€)`)
                .setDescription(item.description)
                .setValue(`jobs_item_${item.id}`)
        );

        const piochesMenu = new StringSelectMenuBuilder()
            .setCustomId('jobs_boutique_pioche')
            .setPlaceholder('Choisir une pioche...')
            .addOptions(piochesOptions);

        const wagonsMenu = new StringSelectMenuBuilder()
            .setCustomId('jobs_boutique_wagon')
            .setPlaceholder('Choisir un wagon...')
            .addOptions(wagonsOptions);

        const jobsMenu = new StringSelectMenuBuilder()
            .setCustomId('jobs_boutique_item')
            .setPlaceholder('Choisir un objet de job...')
            .addOptions(jobsOptions);

        const piochesRow = new ActionRowBuilder().addComponents(piochesMenu);
        const wagonsRow = new ActionRowBuilder().addComponents(wagonsMenu);
        const jobsRow = new ActionRowBuilder().addComponents(jobsMenu);

        const embed = new EmbedBuilder()
            .setTitle('💼 Boutique des Jobs')
            .setDescription('Améliore ton équipement pour augmenter tes gains !')
            .setColor('#f1c40f');

        await interaction.reply({
            embeds: [embed],
            components: [piochesRow, wagonsRow, jobsRow],
            ephemeral: true,
        });
    },
};