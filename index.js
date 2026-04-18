require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./utils/database');

const loadPlugins = require('./plugins');

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

client.commands = new Collection();
const commands = [];
const interactionHandlers = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath).filter(folder => fs.statSync(path.join(foldersPath, folder)).isDirectory());
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const folderCommandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of folderCommandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const module = require(filePath);
            if (folder === 'crew' && file === 'index.js') {
                if (module.handleInteraction) interactionHandlers.set('crew', module.handleInteraction);
            } else if (folder === 'jobs' && file === 'index.js') {
                if (module.handleInteraction) interactionHandlers.set('jobs', module.handleInteraction);
            } else if ('data' in module && 'execute' in module) {
                client.commands.set(module.data.name, module);
                commands.push(module.data.toJSON());
            }
        } catch (error) {
            console.error(`❌ Erreur chargement ${filePath}:`, error);
        }
    }
}

for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
}

client.textCommands = new Collection();
const textCommandsPath = path.join(__dirname, 'textCommands');
if (fs.existsSync(textCommandsPath)) {
    const textCommandFiles = fs.readdirSync(textCommandsPath).filter(file => file.endsWith('.js'));
    for (const file of textCommandFiles) {
        const command = require(path.join(textCommandsPath, file));
        if ('name' in command && 'execute' in command) client.textCommands.set(command.name, command);
    }
}

client.once(Events.ClientReady, async () => {
    console.log(`🤖 AESIRBOT connecté : ${client.user.tag}`);

    const statuses = [{ name: '/aesir', type: ActivityType.Playing }];
    let index = 0;
    setInterval(() => {
        const status = statuses[index];
        client.user.setPresence({ activities: [{ name: status.name, type: status.type }], status: 'online' });
        index = (index + 1) % statuses.length;
    }, 10000);

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    try {
        const guildId = process.env.GUILD_ID;
        if (guildId) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
            console.log(`✅ Commandes locales chargées.`);
        } else {
            await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            console.log(`🌍 Commandes globales chargées.`);
        }
    } catch (error) {
        console.error('❌ Erreur sync commandes:', error);
    }
    loadPlugins(client);
});

const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
        else client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
            console.log(`[${new Date().toLocaleTimeString()}] ${interaction.user.tag} : /${interaction.commandName}`);
        } catch (error) {
            console.error(`❌ Erreur /${interaction.commandName}:`, error);
            if (error.code === 10062) return;
            try {
                const msg = '❌ Une erreur est survenue.';
                if (interaction.replied || interaction.deferred) await interaction.followUp({ content: msg, ephemeral: true });
                else await interaction.reply({ content: msg, ephemeral: true });
            } catch (e) {}
        }
    }

    else if (interaction.isModalSubmit() || interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('anim_')) {
            const command = client.commands.get('animation');
            if (!command) return;
            try {
                if (interaction.isStringSelectMenu() && interaction.customId.startsWith('anim_channel_select')) await command.handleChannelSelect(interaction);
                else if (interaction.isButton() && interaction.customId.startsWith('anim_show_modal')) await command.handleShowModal(interaction);
                else if (interaction.isButton() && interaction.customId.startsWith('anim_type_')) await command.handleEventTypeSelect(interaction);
                else if (interaction.isModalSubmit() && interaction.customId.startsWith('anim_details_modal')) await command.handleModalSubmit(interaction);
                else if (interaction.isModalSubmit() && interaction.customId.startsWith('anim_address_modal')) await command.handleAddressModalSubmit(interaction);
                else if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('anim_voice_channel_select')) await command.handleVoiceChannelSelect(interaction);
            } catch (error) {
                console.error(`❌ Erreur handler anim:`, error);
            }
            return;
        }

        let handlerKey = (interaction.isModalSubmit() && interaction.customId === 'create_crew_modal') ? 'crew' : interaction.customId.split('_')[0];
        if (interactionHandlers.has(handlerKey)) {
            try {
                await interactionHandlers.get(handlerKey)(interaction);
            } catch (error) {
                console.error(`❌ Erreur handler '${handlerKey}':`, error);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);

async function shutdown() {
    console.log('\n🛑 Arrêt...');
    if (client.isReady()) {
        client.user.setPresence({ status: 'invisible' });
        client.destroy();
    }
    try {
        await db.end();
        console.log('💾 MySQL déconnecté.');
    } catch (e) {}
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);