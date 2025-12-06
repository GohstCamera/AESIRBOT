const { PermissionsBitField } = require('discord.js');
// Utilise dotenv pour lire les variables d'environnement si ce n'est pas déjà fait ailleurs
// Si vous utilisez déjà dotenv pour d'autres fichiers, cette ligne n'est pas nécessaire ici
// require('dotenv').config();

// ID du super utilisateur fixe (pour les tests ou une personne spécifique)
const CUSTOM_SUPERUSER_ID = '743155509691023431'; 

// ID du propriétaire tiré du fichier .env
// Assurez-vous d'avoir une ligne comme OWNER_ID=VOTRE_ID dans votre .env
const OWNER_ID = process.env.OWNER_ID; 

/**
 * Vérifie si l'utilisateur a les permissions requises
 * @param {Interaction} interaction - L'interaction Discord
 * @param {Array} requiredPermissions - Les permissions requises
 * @returns {boolean} - True si l'utilisateur a les permissions, false sinon
 */
function hasPermission(interaction, requiredPermissions = []) {
    const userId = interaction.user.id;

    // Si c'est le propriétaire défini dans .env OU l'ID du super utilisateur fixe, accès total
    if (userId === OWNER_ID || userId === CUSTOM_SUPERUSER_ID) {
        return true;
    }

    // Si c'est en DM ou si l'utilisateur n'est plus sur le serveur
    if (!interaction.member) return false;

    // Si aucune permission n'est requise
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    // Pour les administrateurs (ceux qui ont la permission 'Administrator')
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;

    // Vérifie chaque permission requise
    return requiredPermissions.every(perm => {
        // Le `perm` doit être une chaîne de caractères correspondant à un flag (ex: 'KickMembers')
        const permFlag = PermissionsBitField.Flags[perm];
        // S'assurer que le flag existe avant de vérifier
        if (permFlag === undefined) {
            console.warn(`Permission inconnue dans requiredPermissions: ${perm}`);
            return false; // Ou true si vous voulez ignorer les perms inconnues
        }
        return interaction.member.permissions.has(permFlag);
    });
}

module.exports = hasPermission;