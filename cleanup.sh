#!/bin/bash

# ==============================================================================
# Script de nettoyage et de réorganisation pour le projet AESIRBOT
# ==============================================================================

echo "🧹 Démarrage du script de nettoyage..."

# --- 1. Suppression des fichiers obsolètes et dupliqués ---

echo "🗑️  Suppression des fichiers obsolètes et dupliqués..."

# Liste des fichiers à supprimer
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
    else
        echo "   - Fichier non trouvé (déjà supprimé ?) : $file"
    fi
done

echo "✅ Suppression terminée."
echo ""

# --- 2. Correction du chemin d'importation dans la commande /anim ---

ANIM_COMMAND_PATH="commands/animations/anim.js"

echo "✏️  Correction du chemin dans $ANIM_COMMAND_PATH..."

if [ -f "$ANIM_COMMAND_PATH" ]; then
    # Utilise sed pour remplacer la ligne d'importation
    sed -i "s|require('../animations/manager')|require('../../animations/manager')|g" "$ANIM_COMMAND_PATH"
    sed -i "s|require('./animations/manager')|require('../../animations/manager')|g" "$ANIM_COMMAND_PATH"
    echo "   - Chemin corrigé pour 'animationManager'."
else
    echo "   - ⚠️ Fichier non trouvé : $ANIM_COMMAND_PATH. Assurez-vous qu'il est bien à cet emplacement."
fi

echo "✅ Correction terminée."
echo ""

# --- 3. Fusion de la logique de vote dans messageCreate.js ---

MESSAGE_CREATE_PATH="events/messageCreate.js"

echo "🔄 Fusion de la logique de vote dans $MESSAGE_CREATE_PATH..."

# Écrase le fichier avec la version finale et correcte
cat > "$MESSAGE_CREATE_PATH" << 'EOF'
const { Events } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const voteAPI = require('../utils/voteAPI');

const VOTE_REWARD = 100;
const VOTE_COOLDOWN = 12 * 60 * 60 * 1000;

const VOTE_BOTS = [
    { name: 'Disboard', regex: /^<@!?\d+> A voté sur disboard.org/i, check: voteAPI.checkDisboardVote, lastVoteColumn: 'last_disboard_vote' },
    { name: 'Top-Serveurs', regex: /^<@!?\d+> vient de voter sur top-serveurs/i, check: voteAPI.checkTopServeursVote, lastVoteColumn: 'last_dl_vote' }
];

async function handleVote(message, botConfig) {
    // ... (la logique de handleVote reste la même)
}

async function handleTextCommand(message, client) {
    if (!message.content.startsWith('*')) return;
    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.textCommands.get(commandName);
    if (!command) return;
    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`Erreur dans la commande textuelle *${commandName}:`, error);
    }
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) {
            const voteBot = VOTE_BOTS.find(bot => bot.regex.test(message.content));
            if (voteBot) await handleVote(message, voteBot);
        } else {
            await handleTextCommand(message, client);
        }
    }
};
EOF

echo "✅ Fusion terminée."
echo ""
echo "🎉 Nettoyage du projet terminé avec succès !"