const db = require('./database');

/**
 * Ajoute une infraction (transaction) dans la base de données.
 * @param {object} infraction - L'objet contenant les détails de l'infraction.
 * @param {string} infraction.guildId - L'ID du serveur.
 * @param {string} infraction.userId - L'ID de l'utilisateur sanctionné.
 * @param {string} infraction.type - Le type d'infraction (warn, mute, kick, ban).
 * @param {string} infraction.reason - La raison de l'infraction.
 * @param {string} infraction.modId - L'ID du modérateur.
 */
async function addToCasier({ guildId, userId, type, reason, modId }) {
    const query = `
        INSERT INTO Transaction (senderId, recipientId, amount, type, crewId, reason, modId)
        VALUES (?, ?, 0, ?, ?, ?, ?)
    `;
    await db.execute(query, [modId, userId, type.toUpperCase(), guildId, reason, modId]);
}

/**
 * Récupère le casier judiciaire (toutes les infractions) d'un utilisateur.
 * @param {string} guildId - L'ID du serveur.
 * @param {string} userId - L'ID de l'utilisateur.
 * @returns {Promise<Array>} - Un tableau d'objets d'infraction.
 */
async function getCasier(guildId, userId) {
    const query = `
        SELECT id, type, reason, modId, createdAt as date
        FROM Transaction
        WHERE recipientId = ? AND crewId = ? AND type IN ('WARN', 'MUTE', 'KICK', 'BAN', 'UNBAN', 'UNMUTE', 'NOTE')
        ORDER BY createdAt ASC
    `;
    const [rows] = await db.execute(query, [userId, guildId]);
    return rows;
}

/**
 * Supprime un avertissement spécifique du casier d'un utilisateur.
 * @param {number} infractionId - L'ID de l'infraction (transaction) à supprimer.
 */
async function removeWarn(infractionId) {
    const query = 'DELETE FROM Transaction WHERE id = ? AND type = \'WARN\'';
    await db.execute(query, [infractionId]);
}

/**
 * Met à jour la raison d'un avertissement spécifique.
 * @param {number} infractionId - L'ID de l'infraction (transaction) à modifier.
 * @param {string} newReason - La nouvelle raison.
 */
async function updateWarn(infractionId, newReason) {
    const query = 'UPDATE Transaction SET reason = ? WHERE id = ? AND type = \'WARN\'';
    await db.execute(query, [newReason, infractionId]);
}

module.exports = {
    addToCasier,
    getCasier,
    removeWarn,
    updateWarn
};