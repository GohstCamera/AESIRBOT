const db = require('./database');

/**
 * Ajoute une infraction dans la table Transaction de MySQL.
 */
async function addToCasier({ guildId, userId, type, reason, modId }) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. S'assurer que le MODÉRATEUR existe
        await connection.execute(
            'INSERT INTO User (id, username, balance) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE id=id',
            [modId, 'Modérateur']
        );

        // 2. S'assurer que l'UTILISATEUR CIBLE existe
        await connection.execute(
            'INSERT INTO User (id, username, balance) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE id=id',
            [userId, 'Utilisateur']
        );

        // 3. Insérer l'infraction (On met NULL dans crewId car c'est une action de modération globale au serveur)
        const query = `
            INSERT INTO Transaction (senderId, recipientId, amount, type, guildId, crewId, reason, modId)
            VALUES (?, ?, 0, ?, ?, NULL, ?, ?)
        `;

        await connection.execute(query, [modId, userId, type.toUpperCase(), guildId, reason, modId]);

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Récupère les infractions depuis MySQL.
 */
async function getCasier(guildId, userId) {
    const query = `
        SELECT id, type, reason, modId, createdAt as date
        FROM Transaction
        WHERE recipientId = ? AND guildId = ? AND type IN ('WARN', 'MUTE', 'KICK', 'BAN', 'UNBAN', 'UNMUTE', 'NOTE')
        ORDER BY createdAt ASC
    `;
    const [rows] = await db.execute(query, [userId, guildId]);
    return rows;
}

async function removeWarn(infractionId) {
    const query = "DELETE FROM Transaction WHERE id = ? AND type = 'WARN'";
    await db.execute(query, [infractionId]);
}

async function updateWarn(infractionId, newReason) {
    const query = "UPDATE Transaction SET reason = ? WHERE id = ? AND type = 'WARN'";
    await db.execute(query, [newReason, infractionId]);
}

module.exports = {
    addToCasier,
    getCasier,
    removeWarn,
    updateWarn
};