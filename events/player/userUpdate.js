// Fichier : events/player/userUpdate.js

const { Events, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.UserUpdate, 
    once: false, 
    
    /**
     * S'exécute quand un utilisateur (pas seulement dans le serveur) change d'informations.
     * @param {import('discord.js').User} oldUser 
     * @param {import('discord.js').User} newUser 
     */
    async execute(oldUser, newUser) {
        // Ne rien faire si c'est le même utilisateur
        if (oldUser.tag === newUser.tag && oldUser.avatarURL() === newUser.avatarURL()) return;
        
        console.log(`[EVENT] Changement détecté pour l'utilisateur : ${oldUser.tag} -> ${newUser.tag}`);

        // 💡 Logique : Mettre à jour l'utilisateur dans la BDD
        // try {
        //     await global.prisma.user.update({
        //         where: { id: newUser.id },
        //         data: { 
        //             username: newUser.username,
        //             discriminator: newUser.discriminator,
        //             avatarUrl: newUser.avatarURL(),
        //         }
        //     });
        // } catch (e) {
        //     // Gérer l'erreur si l'utilisateur n'est pas dans la BDD
        // }

        // 💡 Logique : Log du changement
        // Si le bot est dans un serveur où cet utilisateur se trouve
        const client = global.client;
        client.guilds.cache.forEach(guild => {
            const member = guild.members.cache.get(newUser.id);
            if (member && oldUser.username !== newUser.username) {
                console.log(`[EVENT] ${oldUser.tag} a changé de nom sur le serveur ${guild.name}.`);
                // Envoi d'un log ou d'une alerte au besoin
            }
        });
    },
};