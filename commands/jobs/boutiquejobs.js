const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Définition des articles de la boutique, doit être identique à celle dans commands/jobs/index.js
const SHOP_ITEMS = {
    pioches: [
        { id: 'fer', name: 'Pioche en Fer', price: 1000, bonus: 1.5, emoji: '⛏️', description: 'Augmente la récolte de 50%.' },
        { id: 'diamant', name: 'Pioche en Diamant', price: 5000, bonus: 2.0, emoji: '💎', description: 'Double la récolte !' },
    ],
    wagons: [
        { id: 'moyen', name: 'Wagon Moyen', price: 1500, capacity: 200, emoji: '🚂', description: 'Capacité de 200 ressources.' },
        { id: 'grand', name: 'Grand Wagon', price: 6000, capacity: 500, emoji: '🚛', description: 'Capacité de 500 ressources.' },
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
        // 1. Déférez la réponse immédiatement
        // Note: Pas besoin de deferReply ici car c'est une réponse initiale, on utilise reply()
        
        // 2. Options pour les pioches
        const piochesOptions = SHOP_ITEMS.pioches.map(item =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.emoji} ${item.name} (${item.price}€)`)
                .setDescription(item.description)
                // 💡 VALEUR CORRIGÉE: 'pioche_fer'. La logique de index.js attend (type)_(id)
                .setValue(`pioche_${item.id}`) 
        );

        // 3. Options pour les wagons
        const wagonsOptions = SHOP_ITEMS.wagons.map(item =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.emoji} ${item.name} (${item.price}€)`)
                .setDescription(item.description)
                 // 💡 VALEUR CORRIGÉE: 'wagon_moyen'
                .setValue(`wagon_${item.id}`) 
        );

        // 4. Options pour les objets de jobs
        const jobsOptions = SHOP_ITEMS.jobs.map(item =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.emoji} ${item.name} (${item.price}€)`)
                .setDescription(item.description)
                 // 💡 VALEUR CORRIGÉE: 'jobs_item_hache'. La logique de index.js a besoin du préfixe 'jobs_item' pour distinguer
                .setValue(`jobs_item_${item.id}`)
        );

        // 5. Création des menus déroulants
        const piochesMenu = new StringSelectMenuBuilder()
            // 🎯 CUSTOM ID CORRIGÉ: Ajout du préfixe 'jobs_boutique_' attendu par index.js
            .setCustomId('jobs_boutique_pioche') 
            .setPlaceholder('Choisir une pioche...')
            .addOptions(piochesOptions);

        const wagonsMenu = new StringSelectMenuBuilder()
            // 🎯 CUSTOM ID CORRIGÉ: Ajout du préfixe 'jobs_boutique_'
            .setCustomId('jobs_boutique_wagon') 
            .setPlaceholder('Choisir un wagon...')
            .addOptions(wagonsOptions);

        const jobsMenu = new StringSelectMenuBuilder()
            // 🎯 CUSTOM ID CORRIGÉ: Ajout du préfixe 'jobs_boutique_'
            .setCustomId('jobs_boutique_item') 
            .setPlaceholder('Choisir un objet de job...')
            .addOptions(jobsOptions);

        // 6. Création des ActionRows
        const piochesRow = new ActionRowBuilder().addComponents(piochesMenu);
        const wagonsRow = new ActionRowBuilder().addComponents(wagonsMenu);
        const jobsRow = new ActionRowBuilder().addComponents(jobsMenu);

        // 7. Création de l'Embed
        const embed = new EmbedBuilder()
            .setTitle('💼 Boutique des Jobs')
            .setDescription('Améliore ton équipement pour augmenter tes gains !')
            .setColor('#f1c40f');

        // 8. Envoi de la réponse
        await interaction.reply({
            embeds: [embed],
            components: [piochesRow, wagonsRow, jobsRow],
            ephemeral: true,
        });
    },
};