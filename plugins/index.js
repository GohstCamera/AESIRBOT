// Fichier : plugins/index.js

// Importe le script keep-alive
// const keepAlive = require('./keepalive');
// Importe le script de gestion d'erreurs et de logging local
const antiCrashInitializer = require('./antiCrash');


/**
 * Charge tous les plugins essentiels pour le client Discord.
 * Il doit être appelé dans l'événement ClientReady de index.js.
 * @param {Client} client Le client Discord principal.
 */
module.exports = (client) => {
    // 1. Initialise le gestionnaire Anti-Crash et le logging local
    antiCrashInitializer(client);
    
    // 2. Démarre le serveur Keep-Alive
    // keepAlive(); // Désactivé car non nécessaire pour un hébergement local/VPS

    // 3. Ajoutez ici d'autres fonctions d'initialisation de plugins futurs
    // Ex: loadDashboard(client);

    console.log('🔌 Tous les plugins essentiels sont chargés.');
};
