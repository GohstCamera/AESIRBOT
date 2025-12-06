// Fichier : events/player/guildMemberRemove.js

const { Events, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberRemove, 
    once: false, 
    
    /**
     * S'exécute quand un membre quitte un serveur.
     * @param {import('discord.js').GuildMember} member 
     */
    async execute(member) {
        console.log(`[EVENT] ${member.user.tag} a quitté le serveur ${member.guild.name}.`);

        // 💡 Logique : Notifier le départ dans un salon de log
        const logChannel = member.guild.channels.cache.find(
            c => c.name.includes('log') && c.type === ChannelType.GuildText
        );
        
        if (logChannel) {
             const embed = new EmbedBuilder()
                .setTitle(`Au revoir 😥`)
                .setDescription(`L'utilisateur **${member.user.tag}** a quitté le serveur.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setColor('#e74c3c') // Rouge
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
        
        // 💡 Logique : Mettre à jour la base de données (si un profil existait)
        // try {
        //     await global.prisma.user.update({
        //         where: { id: member.id },
        //         data: { lastSeen: new Date() }
        //     });
        // } catch (e) {
        //     // Ignorer si l'utilisateur n'était pas dans la BDD
        // }
    },
};