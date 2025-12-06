const fs = require('fs').promises;
const path = require('path');

const CASIERS_DIR = path.join(__dirname, '../casiers');

// Assurez-vous que le dossier casiers existe
async function ensureCasiersDir() {
    try {
        await fs.access(CASIERS_DIR);
    } catch {
        await fs.mkdir(CASIERS_DIR, { recursive: true });
    }
}

// Obtenir le chemin du fichier casier pour un serveur
function getCasierPath(guildId) {
    return path.join(CASIERS_DIR, `${guildId}.json`);
}

// ✅ Ajouter une infraction au casier (version objet)
async function addToCasier({ guildId, userId, type, reason, modId }) {
    await ensureCasiersDir();
    const casierPath = getCasierPath(guildId);

    let casiers;
    try {
        const data = await fs.readFile(casierPath, 'utf8');
        casiers = JSON.parse(data);
    } catch {
        casiers = {};
    }

    if (!casiers[userId]) {
        casiers[userId] = [];
    }

    const infraction = {
        type,
        reason,
        modId,
        date: new Date().toISOString()
    };

    casiers[userId].push(infraction);
    await fs.writeFile(casierPath, JSON.stringify(casiers, null, 2));
    return infraction;
}

// ✅ Récupérer le casier d'un utilisateur
async function getCasier(guildId, userId) {
    await ensureCasiersDir();
    const casierPath = getCasierPath(guildId);

    try {
        const data = await fs.readFile(casierPath, 'utf8');
        const casiers = JSON.parse(data);
        return casiers[userId] || [];
    } catch {
        return [];
    }
}

// ✅ Réécrire le casier d’un utilisateur
async function saveCasier(guildId, userId, infractions) {
    await ensureCasiersDir();
    const casierPath = getCasierPath(guildId);

    let casiers;
    try {
        const data = await fs.readFile(casierPath, 'utf8');
        casiers = JSON.parse(data);
    } catch {
        casiers = {};
    }

    casiers[userId] = infractions;
    await fs.writeFile(casierPath, JSON.stringify(casiers, null, 2));
}
  
module.exports = {
    addToCasier,
    getCasier,
    saveCasier
};
