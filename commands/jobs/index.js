const db = require('../../utils/database');

const SHOP_ITEMS = {
    pioches: [
        { id: 'fer', name: 'Pioche en Fer', price: 1000, type: 'pioche', value: 1.5 },
        { id: 'diamant', name: 'Pioche en Diamant', price: 5000, type: 'pioche', value: 2.0 },
    ],
    wagons: [
        { id: 'moyen', name: 'Wagon Moyen', price: 1500, type: 'wagon', value: 200 },
        { id: 'grand', name: 'Grand Wagon', price: 6000, type: 'wagon', value: 500 },
    ],
    jobs: [
        { id: 'hache', name: 'Hache de Bûcheron', price: 750, type: 'job_item', value: 'bucheron' },
        { id: 'filet', name: 'Filet de Pêche', price: 600, type: 'job_item', value: 'pecheur' },
        { id: 'grenade', name: 'Grenade IEM', price: 1200, type: 'job_item', value: 'perceur' },
        { id: 'outils', name: 'Boîte à Outils', price: 900, type: 'job_item', value: 'ingenieur' },
        { id: 'couteau', name: 'Couteau de Chasse', price: 850, type: 'job_item', value: 'chasseur' },
    ]
};

async function handleShopSelection(interaction) {
    const selectedValue = interaction.values[0];
    const parts = selectedValue.split('_'); 
    
    let itemToBuy;
    let type;
    let itemId;

    if (parts[0] === 'pioche' || parts[0] === 'wagon') {
        type = parts[0];
        itemId = parts[1];
        itemToBuy = SHOP_ITEMS[`${type}s`].find(item => item.id === itemId);
    } else if (parts[0] === 'jobs' && parts[1] === 'item') {
        type = 'job_item';
        itemId = parts[2];
        itemToBuy = SHOP_ITEMS.jobs.find(item => item.id === itemId); 
    }

    await interaction.deferUpdate({ ephemeral: true });

    if (!itemToBuy) {
        return interaction.editReply({ content: '❌ Cet article n\'existe pas.', components: [] });
    }

    const [userRows] = await db.execute('SELECT * FROM User WHERE id = ?', [interaction.user.id]);
    const user = userRows[0];

    if (!user) return interaction.editReply({ content: '❌ Profil non trouvé.', components: [] });

    if (user.balance < itemToBuy.price) {
        return interaction.editReply({ content: `❌ Pas assez d'argent. Il te manque **${(itemToBuy.price - user.balance).toLocaleString()}€**`, components: [] });
    }
    
    let currentJobsItems = [];
    try {
        currentJobsItems = typeof user.jobsItems === 'string' ? JSON.parse(user.jobsItems || '[]') : (user.jobsItems || []);
    } catch (e) {
        currentJobsItems = [];
    }

    if (type === 'job_item' && currentJobsItems.includes(itemId)) {
        return interaction.editReply({ content: `❌ Tu possèdes déjà cet objet.`, components: [] });
    }
    
    let updateQuery = 'UPDATE User SET balance = balance - ?';
    let updateParams = [itemToBuy.price];

    if (type === 'pioche') {
        updateQuery += ', pickaxe = ?';
        updateParams.push(itemId);
    } else if (type === 'wagon') {
        updateQuery += ', wagon = ?';
        updateParams.push(itemId);
    } else if (type === 'job_item') {
        currentJobsItems.push(itemId);
        updateQuery += ', jobsItems = ?';
        updateParams.push(JSON.stringify(currentJobsItems));
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(user.id);

    try {
        await db.execute(updateQuery, updateParams);
        return interaction.editReply({ 
            content: `✅ Tu as acheté **${itemToBuy.name}** pour **${itemToBuy.price.toLocaleString()}€** !`, 
            components: [],
            embeds: interaction.message.embeds
        });
    } catch (error) {
         console.error(error);
         return interaction.editReply({ content: '❌ Erreur SQL.', components: [] });
    }
}

module.exports = {
    async handleInteraction(interaction) {
        if (!interaction.isStringSelectMenu()) return false;
        if (interaction.customId.startsWith('jobs_boutique_')) return handleShopSelection(interaction);
        return false; 
    }
};