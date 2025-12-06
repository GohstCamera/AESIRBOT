const fs = require('fs').promises;
const path = require('path');

// Fonction pour mettre à jour un fichier
async function updateFile(filePath) {
    try {
        // Lire le contenu du fichier
        let content = await fs.readFile(filePath, 'utf8');

        // Remplacer les imports
        content = content.replace(
            /const isOwner = require\('\.\.\/utils\/isOwner'\);/g,
            "const hasPermission = require('../utils/hasPermission');"
        );

        // Remplacer les vérifications de permission
        content = content.replace(
            /const isUserOwner = isOwner\(interaction\.user\.id\);[\s\S]*?if \(!isUserOwner && !hasPermission\)/g,
            "if (!hasPermission(interaction, ['ModerateMembers']))"
        );

        // Écrire le contenu mis à jour
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`✅ Mis à jour: ${filePath}`);
    } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour de ${filePath}:`, error);
    }
}

// Fonction principale
async function main() {
    const commandsDir = path.join(__dirname, 'commands');
    
    // Lire tous les fichiers de commande
    const files = await fs.readdir(commandsDir);
    
    // Mettre à jour chaque fichier
    for (const file of files) {
        if (file.endsWith('.js')) {
            await updateFile(path.join(commandsDir, file));
        }
    }
}

// Exécuter le script
main().catch(console.error);
