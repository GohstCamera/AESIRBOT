// Fichier: /commands/animations/animationManager.js

// Utilise une Map pour stocker les données temporaires.
// La clé sera l'ID unique de l'interaction (interactionId), et la valeur sera l'objet de données.
const tempAnimationData = new Map();

/**
 * Sauvegarde les données temporaires pour une session de création d'animation.
 * @param {string} id - L'ID unique de l'interaction.
 * @param {object} data - L'objet contenant les données à sauvegarder.
 */
function setTempData(id, data) {
    tempAnimationData.set(id, data);
    // Ajoute un timer pour supprimer les données après un certain temps (ex: 30 minutes)
    setTimeout(() => {
        if (tempAnimationData.has(id)) {
            tempAnimationData.delete(id);
            console.log(`[AnimationManager] Données expirées et supprimées pour l'ID : ${id}`);
        }
    }, 30 * 60 * 1000); // 30 minutes
}

/**
 * Récupère les données temporaires pour une session.
 * @param {string} id - L'ID unique de l'interaction.
 * @returns {object | undefined} Les données sauvegardées, ou undefined si non trouvées.
 */
function getTempData(id) {
    return tempAnimationData.get(id);
}

/**
 * Supprime les données temporaires pour une session.
 * @param {string} id - L'ID unique de l'interaction.
 */
function clearTempData(id) {
    if (tempAnimationData.has(id)) {
        tempAnimationData.delete(id);
    }
}

module.exports = {
    setTempData,
    getTempData,
    clearTempData,
};