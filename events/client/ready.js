// Fichier : events/client/ready.js

const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady, 
    once: true, 
    
    /**
     * S'exécute quand le bot est prêt.
     * @param {import('discord.js').Client} client 
     */
    async execute(client) {
        // Ces fonctions sont maintenant attachées à l'objet client dans votre index.js
        const deployCommands = client.deployCommands; 
        const setDynamicStatus = client.setDynamicStatus;
        const loadPlugins = require('../../../plugins'); // Chemin ajusté
        
        console.log(`🤖 AESIRBOT connecté en tant que ${client.user.tag}`);

        // 1. Déploiement des commandes
        await deployCommands();

        // 2. Lancement du statut dynamique
        setDynamicStatus(); 
        
        // 3. Activation des plugins
        loadPlugins(client);
        
        // 4. Test de la BDD
        try {
            await global.prisma.$queryRaw`SELECT 1`;
            console.log(`[EVENT] Connexion Prisma : ✅ Base de données accessible.`);
        } catch (e) {
            console.error(`[EVENT] Connexion Prisma : ❌ Erreur BDD.`, e.message);
        }
    },
};