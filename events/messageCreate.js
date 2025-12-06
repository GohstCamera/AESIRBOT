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
