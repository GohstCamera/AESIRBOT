/**
 * @module antiCrash
 * @description Configure tous les gestionnaires d'erreurs et de signaux du processus Node.js.
 * @param {Client} client Le client Discord principal.
 */
module.exports = (client) => {
    const handleExit = async () => {
        if (client) {
            // Note: client.logger n'est pas une propriété standard.
            // On utilise console.log pour la compatibilité.
            console.log("Déconnexion de Discord...");
            await client.destroy();
            console.log("Déconnexion de Discord réussie !");
            process.exit();
        }
    };

    process.on("unhandledRejection", (reason, promise) => {
        // Vérification pour ignorer l'erreur InteractionAlreadyReplied
        if (reason && reason.code === 'InteractionAlreadyReplied') {
            return; // Ignorer cette erreur spécifique
        }
        // Note: client.logger n'est pas une propriété standard.
        console.error("Unhandled Rejection at:", promise, "reason:", reason);
    });

    process.on("uncaughtException", (err) => {
        // Vérification pour ignorer l'erreur InteractionAlreadyReplied
        if (err && err.code === 'InteractionAlreadyReplied') {
            return; // Ignorer cette erreur spécifique
        }
        // Note: client.logger n'est pas une propriété standard.
        console.error("Uncaught Exception thrown:", err);
    });

    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);
    process.on("SIGQUIT", handleExit);

    console.log(`\n=================================================`);
    console.log(`✅ Anti-Crash simple initialisé.`);
    console.log(`=================================================`);
};