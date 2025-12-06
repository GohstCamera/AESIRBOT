// addrole.js
module.exports = {
    name: 'addrole',
    async execute(message, args) {
        const OWNER_ID = '743155509691023431';
        if (message.author.id !== OWNER_ID) return;

        const userMention = args[0];
        const roleId = args[1];

        const userId = userMention.replace(/[<@!>]/g, '');
        const member = message.guild.members.cache.get(userId);
        const role = message.guild.roles.cache.get(roleId);

        if (!member || !role) return;

        try {
            await member.roles.add(roleId);
        } catch (error) {
            console.error(`Erreur ajout rôle :`, error);
        }
    }
};
