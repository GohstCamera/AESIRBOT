// Fichier : events/client/debug.js

const { Events } = require('discord.js');

module.exports = {
    name: Events.Debug,
    // S'exécute à chaque fois que la librairie émet des informations de débogage
    once: false, 
    
    /**
     * S'exécute lors d'informations de débogage.
     * @param {string} info 
     */
    async execute(info) {
        // ATTENTION : Cet événement est EXTRÊMEMENT verbeux et doit être géré avec soin.
        // En mode Production, il est généralement désactivé ou filtré.

        // 💡 Exemples de filtrage :
        // 1. Filtrer les messages du 'Heartbeat' (souvent trop fréquents)
        if (info.includes('Heartbeat')) {
            // Décommenter pour voir les pings/heartbeats :
            // console.log(`[DEBUG - PING] 💖 Heartbeat : ${info}`);
            return; 
        }

        // 2. Filtrer la gestion du Cache (si votre bot est très grand)
        if (info.includes('swept')) {
            // console.log(`[DEBUG - SWEEP] Nettoyage du cache : ${info}`);
            return;
        }

        // 3. Afficher le reste
        console.log(`[DEBUG] ${info}`);
    },
};