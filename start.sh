#!/bin/bash

echo "🚀 Démarrage du bot Discord..."

# Active ton environnement Node.js si nécessaire
# source ~/.nvm/nvm.sh
# nvm use 18

# Lancer le bot
node index.js

# Vérifie si le bot s'est lancé correctement
if [ $? -eq 0 ]; then
    echo "✅ Bot lancé avec succès."
else
    echo "❌ Le bot a rencontré une erreur."
fi

# Optionnel : attendre une touche avant de fermer le terminal
read -p "Appuie sur Entrée pour quitter..."

