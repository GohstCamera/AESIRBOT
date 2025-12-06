// Fichier : events/player/guildMemberAdd.js

const { Events, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd, 
    once: false, 
    
    /**
     * @param {import('discord.js').GuildMember} member 
     */
    async execute(member) {
        console.log(`[EVENT] ${member.user.tag} a rejoint le serveur ${member.guild.name}.`);

        // Logique de bienvenue (trouvez le salon et envoyez le message)
        const welcomeChannel = member.guild.channels.cache.find(
            c => c.name.includes('bienvenue') && c.type === ChannelType.GuildText
        );
        
        if (welcomeChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`Nouveau membre : ${member.user.username} !`)
                .setDescription(`Bienvenue ! On est maintenant **${member.guild.memberCount}** !`)
                .setColor('#f1c40f')
                .setTimestamp();
            await welcomeChannel.send({ content: `${member}`, embeds: [embed] });
        }
        
        // 💡 Logique : Attribution d'un rôle par défaut (si nécessaire)
        // const defaultRole = member.guild.roles.cache.find(r => r.name === 'Membre');
        // if (defaultRole) {
        //     await member.roles.add(defaultRole).catch(e => console.error("Erreur ajout rôle :", e));
        // }
    },
};