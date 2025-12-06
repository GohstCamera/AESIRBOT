require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- Importation du chargeur de plugins ---
const loadPlugins = require('./plugins');

// 🧠 Initialisation du client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ]
});

global.client = client;

// 📦 Chargement des commandes slash
client.commands = new Collection();
const commands = [];
const interactionHandlers = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath).filter(folder => {
    const stats = fs.statSync(path.join(foldersPath, folder));
    return stats.isDirectory();
});
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));

console.log('📁 Dossiers de commandes slash détectés:', commandFolders);
console.log('📁 Commandes slash directes détectées:', commandFiles);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const folderCommandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of folderCommandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const module = require(filePath);

            // Logique de chargement pour les sous-commandes/handlers
            if (folder === 'crew' && file === 'index.js') {
                const crewModule = require(filePath);

                if (crewModule.handleInteraction) {
                    interactionHandlers.set('crew', crewModule.handleInteraction);
                }

                console.log(`✅ Module de commandes du dossier 'crew' chargé.`);
            } else if (folder === 'jobs' && file === 'index.js') {
                const jobsModule = require(filePath);
                if (jobsModule.handleInteraction) {
                    interactionHandlers.set('jobs', jobsModule.handleInteraction);
                }
                console.log(`✅ Module de commandes du dossier 'jobs' chargé.`);
            } else if ('data' in module && 'execute' in module) {
                client.commands.set(module.data.name, module);
                commands.push(module.data.toJSON());
                console.log(`✅ Commande slash chargée: /${module.data.name} (depuis ${folder}/${file})`);
            } else {
                console.log(`⚠️ Fichier invalide: ${filePath}`);
            }
        } catch (error) {
            console.error(`❌ Erreur lors du chargement du module ${filePath}:`, error);
        }
    }
}

for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`✅ Commande slash chargée: /${command.data.name}`);
    } else {
        console.log(`⚠️ Commande invalide: ${filePath} (data ou execute manquant)`);
    }
}

// 💬 Chargement des commandes textuelles
client.textCommands = new Collection();
const textCommandsPath = path.join(__dirname, 'textCommands');
const textCommandFiles = fs.existsSync(textCommandsPath)
    ? fs.readdirSync(textCommandsPath).filter(file => file.endsWith('.js'))
    : [];

console.log('📁 Commandes textuelles détectées:', textCommandFiles);

for (const file of textCommandFiles) {
    const command = require(path.join(textCommandsPath, file));
    if ('name' in command && 'execute' in command) {
        client.textCommands.set(command.name, command);
        console.log(`✅ Commande textuelle chargée: *${command.name}`);
    } else {
        console.log(`⚠️ Commande textuelle invalide: ${file} (name ou execute manquant)`);
    }
}

// 🚀 Ready event
client.once(Events.ClientReady, async () => {
    console.log(`🤖 AESIRBOT connecté en tant que ${client.user.tag}`);

    // 🔄 Status dynamique
    const statuses = [
        { name: '/aesir', type: ActivityType.Playing }
    ];
    let index = 0;
    setInterval(() => {
        const status = statuses[index];
        client.user.setPresence({
            activities: [{ name: status.name, type: status.type }],
            status: 'online'
        });
        index = (index + 1) % statuses.length;
    }, 10000);

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`🚀 Début du rafraîchissement des ${commands.length} commandes slash.`);

        // Pour le développement, on déploie les commandes uniquement sur le serveur de test (GUILD_ID)
        // C'est instantané, contrairement au déploiement global.
        // Assurez-vous que GUILD_ID est bien défini dans votre fichier .env
        const guildId = process.env.GUILD_ID; // ID du serveur de test

        if (guildId) {
            // Déploiement LOCAL (pour le développement)
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: commands }
            );
            console.log(`✅ Commandes slash rechargées avec succès sur le serveur de test (ID: ${guildId}).`);
        } else {
            // Déploiement GLOBAL (pour la production)
            console.warn("⚠️ GUILD_ID non trouvé dans .env. Déploiement des commandes en mode global. (Peut prendre jusqu'à 1 heure)");
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log(`🌍 Commandes slash synchronisées globalement (${commands.length}).`);
        }

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage ou de la synchronisation:', error);
    }

    // --- Activation des plugins après la connexion et le déploiement ---
    loadPlugins(client);
    // Le message 'Anti-crash bien lancé' est maintenant dans le module antiCrash.
    // ------------------------------------------------------------------
});

// =======================================================
// --- CHARGEMENT DES ÉVÉNEMENTS ---
// =======================================================
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    console.log(`📁 Fichiers d'événements détectés: ${eventFiles.length}`);

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        console.log(`✅ Événement chargé: ${event.name} (${event.once ? 'once' : 'on'})`);
    }
} else {
    console.warn('⚠️ Dossier /events non trouvé. Aucun événement ne sera chargé.');
}

// ⚡ Gestion des interactions slash
client.on(Events.InteractionCreate, async interaction => {
    // Gestion des Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        const now = new Date();
        const time = now.toLocaleTimeString('fr-FR');
        console.log(`[${time}] ${interaction.user.tag} a utilisé /${interaction.commandName} sur ${interaction.guild?.name || 'DM'}`);

        try {
            // La logique de permission est maintenant gérée directement dans les commandes
            // ou par les permissions par défaut de la commande.
            await command.execute(interaction);
        } catch (error) {
            console.error(`❌ Erreur dans /${interaction.commandName}:`, error);

            // Si l'erreur est "Unknown Interaction", on ne tente pas de répondre car le token est déjà invalide.
            if (error.code === 10062) {
                console.warn(`[WARN] L'interaction /${interaction.commandName} a expiré avant qu'une réponse puisse être envoyée.`);
                return;
            }

            const errorMessage = '❌ Une erreur critique est survenue lors de cette action.';
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (e) {
                console.error(`❌ Impossible d'envoyer le message d'erreur pour /${interaction.commandName}:`, e);
            }
        }
        // Pas besoin de return ici, la portée de l'événement se termine naturellement.
    }

    // =======================================================
    // 🧠 GESTION DES MODALS, BOUTONS ET MENUS
    // =======================================================
    else if (interaction.isModalSubmit() || interaction.isButton() || interaction.isStringSelectMenu()) {
        // --- Routeur Spécifique pour la commande /anim ---
        if (interaction.customId.startsWith('anim_')) { // Le préfixe est resté 'anim_'
            const command = client.commands.get('animation'); // Mais le nom de la commande est 'animation'
            if (!command) return;

            try {
                if (interaction.isStringSelectMenu() && interaction.customId.startsWith('anim_channel_select')) {
                    await command.handleChannelSelect(interaction);
                } else if (interaction.isButton() && interaction.customId.startsWith('anim_show_modal')) {
                    await command.handleShowModal(interaction);
                } else if (interaction.isButton() && interaction.customId.startsWith('anim_type_')) {
                    await command.handleEventTypeSelect(interaction);
                } else if (interaction.isModalSubmit() && interaction.customId.startsWith('anim_details_modal')) {
                    await command.handleModalSubmit(interaction);
                } else if (interaction.isModalSubmit() && interaction.customId.startsWith('anim_address_modal')) {
                    await command.handleAddressModalSubmit(interaction);
                } else if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('anim_voice_channel_select')) {
                    await command.handleVoiceChannelSelect(interaction);
                }
            } catch (error) {
                console.error(`❌ Erreur dans le handler de l'interaction anim :`, error);
                if (error.code === 10062) {
                    console.warn(`[WARN] L'interaction anim (${interaction.customId}) a expiré.`);
                    return;
                }
                const errorMessage = '❌ Une erreur est survenue lors de cette étape.';
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: errorMessage, ephemeral: true });
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    }
                } catch (e) {
                    console.error(`❌ Impossible d'envoyer le message d'erreur pour l'interaction anim:`, e);
                }
            }
            return; // On arrête ici pour ne pas passer dans le routeur générique
        }

        console.log(`[DEBUG-ROUTER] Interaction personnalisée. CustomID: ${interaction.customId}.`);

        let handlerKey;

        if (interaction.isModalSubmit() && interaction.customId === 'create_crew_modal') {
            // Routage forcé vers le handler 'crew' pour la création de clan (exemple)
            handlerKey = 'crew';
            console.log(`[DEBUG-ROUTER] Modal de clan détecté. Routage forcé vers 'crew'.`);

        } else {
            // Logique de routage standard basée sur le customId.split('_')[0]
            handlerKey = interaction.customId.split('_')[0];
            console.log(`[DEBUG-ROUTER] Clé standard déterminée: '${handlerKey}'.`);
        }

        // Exécute le gestionnaire si trouvé
        if (interactionHandlers.has(handlerKey)) {
            try {
                console.log(`[DEBUG-ROUTER] Exécution de handler pour la clé: '${handlerKey}'.`);
                await interactionHandlers.get(handlerKey)(interaction);
            } catch (error) {
                console.error(`❌ Erreur lors de la gestion de l'interaction '${interaction.customId}':`, error);
                if (error.code === 10062) {
                    console.warn(`[WARN] L'interaction '${interaction.customId}' a expiré.`);
                    return;
                }
                const errorMessage = '❌ Une erreur est survenue lors de l\'exécution de cette action.';
                try {
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply({ content: errorMessage, components: [], embeds: [] }).catch(() => {});
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
                    }
                } catch (e) {
                    console.error(`❌ Impossible d'envoyer le message d'erreur pour l'interaction '${interaction.customId}':`, e);
                }
            }
        } else {
            console.warn(`[DEBUG-ROUTER] Aucun handler trouvé pour la clé: '${handlerKey}'. Interaction ignorée.`);
        }
    }
});

// 🔑 Connexion du bot
client.login(process.env.DISCORD_TOKEN).catch(console.error);

// =======================================================
// --- GESTION DE L'ARRÊT PROPRE (GRACEFUL SHUTDOWN) ---
// =======================================================

/**
 * Fonction pour gérer l'arrêt propre du bot : 
 * déconnexion de Discord et de la base de données.
 */
async function shutdown() {
    console.log('\n🛑 Signal d\'arrêt reçu (Ctrl+C). Démarrage de la procédure d\'extinction...');

    // 1. Déconnexion du client Discord (Met le bot HORS LIGNE immédiatement)
    if (client.isReady()) {
        console.log('🔌 Déconnexion du client Discord...');
        client.user.setPresence({ status: 'invisible' });
        client.destroy();
    }

    // 2. Fermer la connexion à la base de données Prisma
    try {
        await prisma.$disconnect();
        console.log('💾 Déconnexion de Prisma réussie.');
    } catch (e) {
        // La déconnexion a échoué, mais on continue l'arrêt
        console.error('❌ Erreur lors de la déconnexion de Prisma (ignorer si le bot est déjà arrêté):', e);
    }

    // 3. Quitter le processus Node.js
    console.log('👋 Adieu ! Le processus est terminé.');
    process.exit(0);
}

// 👂 Écoute des signaux d'arrêt (SIGINT pour Ctrl+C, SIGTERM pour commandes kill/systèmes)
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);