require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./utils/database'); // Importe la connexion MySQL

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

        const guildId = process.env.GUILD_ID;

        if (guildId) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: commands }
            );
            console.log(`✅ Commandes slash rechargées avec succès sur le serveur de test (ID: ${guildId}).`);
        } else {
            console.warn("⚠️ GUILD_ID non trouvé dans .env. Déploiement des commandes en mode global.");
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log(`🌍 Commandes slash synchronisées globalement (${commands.length}).`);
        }

    } catch (error) {
        console.error('❌ Erreur lors de la synchronisation des commandes:', error);
    }

    loadPlugins(client);
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
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        const now = new Date();
        const time = now.toLocaleTimeString('fr-FR');
        console.log(`[${time}] ${interaction.user.tag} a utilisé /${interaction.commandName} sur ${interaction.guild?.name || 'DM'}`);

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`❌ Erreur dans /${interaction.commandName}:`, error);

            if (error.code === 10062) return;

            const errorMessage = '❌ Une erreur critique est survenue lors de cette action.';
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (e) {
                console.error(`❌ Impossible d'envoyer le message d'erreur:`, e);
            }
        }
    }

    else if (interaction.isModalSubmit() || interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('anim_')) {
            const command = client.commands.get('animation');
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
                console.error(`❌ Erreur dans le handler anim:`, error);
                const errorMessage = '❌ Une erreur est survenue lors de cette étape.';
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: errorMessage, ephemeral: true });
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    }
                } catch (e) {}
            }
            return;
        }

        let handlerKey;
        if (interaction.isModalSubmit() && interaction.customId === 'create_crew_modal') {
            handlerKey = 'crew';
        } else {
            handlerKey = interaction.customId.split('_')[0];
        }

        if (interactionHandlers.has(handlerKey)) {
            try {
                await interactionHandlers.get(handlerKey)(interaction);
            } catch (error) {
                console.error(`❌ Erreur dans interactionHandler '${handlerKey}':`, error);
                const errorMessage = '❌ Une erreur est survenue lors de cette action.';
                try {
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply({ content: errorMessage, components: [], embeds: [] }).catch(() => {});
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
                    }
                } catch (e) {}
            }
        }
    }
});

// 🔑 Connexion du bot
client.login(process.env.DISCORD_TOKEN).catch(console.error);

// =======================================================
// --- GESTION DE L'ARRÊT PROPRE ---
// =======================================================

async function shutdown() {
    console.log('\n🛑 Signal d\'arrêt reçu. Extinction...');

    if (client.isReady()) {
        console.log('🔌 Déconnexion du client Discord...');
        client.user.setPresence({ status: 'invisible' });
        client.destroy();
    }

    try {
        await db.end();
        console.log('💾 Déconnexion de MySQL réussie.');
    } catch (e) {
        console.error('❌ Erreur lors de la déconnexion de MySQL:', e);
    }

    console.log('👋 Adieu !');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);