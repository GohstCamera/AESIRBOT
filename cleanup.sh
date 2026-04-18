#!/bin/bash

# Script de nettoyage mis à jour (sans Prisma)

echo "🧹 Démarrage du script de nettoyage..."

FILES_TO_DELETE=(
    "events/animReaction.js"
    "events/animReactionRemove.js"
    "events/animInteraction.js"
    "events/voteRewards.js"
    "animations/animations.json"
    "commands/anim.js"
    "animations/anim.js"
    "commands/moderation/adminmoney.js"
)

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "   - Fichier supprimé : $file"
    fi
done

echo "🎉 Nettoyage terminé !"