// Fichier : events/client/ready.js

const { Events } = require('discord.js');
const db = require('../../utils/database');

module.exports = {
    name: Events.ClientReady, 
    once: true, 
    
    async execute(client) {
        console.log(`🤖 AESIRBOT connecté en tant que ${client.user.tag}`);

        // Le chargement des plugins et le déploiement sont gérés dans index.js,
        // mais nous testons la connexion MySQL ici pour confirmation.
        try {
            await db.execute('SELECT 1');
            console.log(`[EVENT] Connexion MySQL : ✅ Base de données accessible.`);
        } catch (e) {
            console.error(`[EVENT] Connexion MySQL : ❌ Erreur BDD.`, e.message);
        }
    },
};