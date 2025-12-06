const { InteractionType } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ATTENTION: La liste des articles DOIT être identique à celle de /commands/boutiquejobs.js
const SHOP_ITEMS = {
    pioches: [
        { id: 'fer', name: 'Pioche en Fer', price: 1000, type: 'pioche', value: 1.5 },
        { id: 'diamant', name: 'Pioche en Diamant', price: 5000, type: 'pioche', value: 2.0 },
    ],
    wagons: [
        { id: 'moyen', name: 'Wagon Moyen', price: 1500, type: 'wagon', value: 200 },
        { id: 'grand', name: 'Grand Wagon', price: 6000, type: 'wagon', value: 500 },
    ],
    jobs: [ // Ce sont les objets qui permettent d'utiliser les jobs
        { id: 'hache', name: 'Hache de Bûcheron', price: 750, type: 'job_item', value: 'bucheron' },
        { id: 'filet', name: 'Filet de Pêche', price: 600, type: 'job_item', value: 'pecheur' },
        { id: 'grenade', name: 'Grenade IEM', price: 1200, type: 'job_item', value: 'perceur' },
        { id: 'outils', name: 'Boîte à Outils', price: 900, type: 'job_item', value: 'ingenieur' },
        { id: 'couteau', name: 'Couteau de Chasse', price: 850, type: 'job_item', value: 'chasseur' },
    ]
};

async function handleShopSelection(interaction) {
    // 1. Récupérer l'ID de l'article sélectionné
    const selectedValue = interaction.values[0]; // Ex: 'pioche_fer' ou 'jobs_item_hache'
    const parts = selectedValue.split('_'); 
    
    let itemToBuy;
    let type;
    let itemId;

    // Détermination du type et de l'ID à partir de la valeur
    if (parts[0] === 'pioche' || parts[0] === 'wagon') {
        type = parts[0];
        itemId = parts[1];
        itemToBuy = SHOP_ITEMS[`${type}s`].find(item => item.id === itemId);
    } else if (parts[0] === 'jobs' && parts[1] === 'item') {
        type = 'job_item'; // Type interne pour la logique
        itemId = parts[2];
        itemToBuy = SHOP_ITEMS.jobs.find(item => item.id === itemId); 
    }

    // ⚠️ On utilise deferUpdate() pour accuser réception de la sélection
    // Je rétablis 'ephemeral: true' car la boutique est en ephemeral, mais si vous voulez que tous la voient, laissez 'false'.
    await interaction.deferUpdate({ ephemeral: true }); 

    if (!itemToBuy) {
        return interaction.editReply({ content: '❌ Cet article n\'existe pas. Merci de relancer la commande.', components: [] });
    }

    const user = await prisma.user.findUnique({
        where: { id: interaction.user.id },
    });

    if (!user) {
        return interaction.editReply({ content: '❌ Impossible de trouver votre profil.', components: [] });
    }

    // Vérification de l'argent
    if (user.balance < itemToBuy.price) {
        return interaction.editReply({ content: `❌ Tu n'as pas assez d'argent pour acheter **${itemToBuy.name}**. Il te manque **${(itemToBuy.price - user.balance).toLocaleString()}€**`, components: [] });
    }
    
    // 🟢 CORRECTION : Lecture du champ String comme JSON
    // Si la valeur est null ou vide (pour les anciens utilisateurs), on utilise '[]'
    let currentJobsItems;
    try {
        currentJobsItems = JSON.parse(user.jobsItems || '[]');
    } catch (e) {
        // En cas d'erreur de parsing (corruption), on reset à un tableau vide
        currentJobsItems = [];
        console.error(`Erreur de parsing de jobsItems pour l'utilisateur ${user.id}:`, user.jobsItems);
    }
    

    // Vérification si l'utilisateur possède déjà l'objet de job (uniquement pour les job_item)
    if (type === 'job_item' && currentJobsItems.includes(itemId)) {
        return interaction.editReply({ content: `❌ Tu possèdes déjà l'objet **${itemToBuy.name}**.`, components: [] });
    }
    
    // --- Préparation de la mise à jour ---
    const updateData = { balance: { decrement: itemToBuy.price } };

    if (type === 'pioche') {
        updateData.pickaxe = itemId;
    } else if (type === 'wagon') {
        updateData.wagon = itemId;
    } else if (type === 'job_item') {
        // Ajout de l'objet au tableau
        currentJobsItems.push(itemId);
        
        // 🟢 CORRECTION : Écriture du champ en le convertissant en String JSON
        updateData.jobsItems = JSON.stringify(currentJobsItems);
    }

    // --- Exécution de la transaction ---
    try {
        await prisma.user.update({
            where: { id: user.id },
            data: updateData
        });

        // Édition de la réponse finale
        return interaction.editReply({ 
            content: `✅ Tu as acheté **${itemToBuy.name}** pour **${itemToBuy.price.toLocaleString()}€** !`, 
            components: [], // Suppression des menus après l'achat
            embeds: interaction.message.embeds // Garde l'embed original
        });

    } catch (error) {
         console.error('❌ ERREUR DB lors de l\'achat de boutique:', error);
         return interaction.editReply({ content: '❌ Une erreur critique est survenue durant la transaction. Veuillez réessayer.', components: [] });
    }
}

module.exports = {
    // Le gestionnaire principal pour les interactions spécifiques à ce module
    async handleInteraction(interaction) {
        // Le log indiquait que le routeur cherchait la clé 'boutique'. 
        // Ici, on gère les Custom IDs qui commencent par 'jobs_boutique_'
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('jobs_boutique_')) { 
                return handleShopSelection(interaction);
            }
        }
        // Pour les autres interactions (boutons, autres menus) non gérées ici
        return false; 
    }
};