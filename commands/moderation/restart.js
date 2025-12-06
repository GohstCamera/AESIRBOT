const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Redémarre le bot (Propriétaire uniquement).'),

    async execute(interaction) {
        // --- Sécurité : Vérification du propriétaire ---
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas la permission d\'exécuter cette commande.',
                ephemeral: true
            });
        }

        // --- Étape 1 : Demande de confirmation ---
        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_restart')
            .setLabel('✅ Confirmer le redémarrage')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton);

        const confirmationEmbed = new EmbedBuilder()
            .setTitle('❓ Confirmation requise')
            .setDescription(`Êtes-vous sûr de vouloir redémarrer le bot **${interaction.client.user.username}** ?`)
            .setColor('#f0ad4e') // Jaune/Orange pour l'avertissement
            .setTimestamp();

        const reply = await interaction.reply({
            embeds: [confirmationEmbed],
            components: [row],
            ephemeral: true,
            fetchReply: true
        });

        // --- Étape 2 : Attente de la confirmation ---
        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000, // 30 secondes pour répondre
            filter: i => i.user.id === interaction.user.id && i.customId === 'confirm_restart'
        });

        collector.on('collect', async i => {
            await i.update({
                content: '✅ Confirmation reçue. Le bot redémarre...',
                embeds: [],
                components: []
            });
            console.log(`[RESTART] Commande de redémarrage confirmée par ${interaction.user.tag}.`);

            // --- Étape 3 : Procédure de redémarrage propre ---
            console.log('[RESTART] Déconnexion du client Discord...');
            await interaction.client.destroy();
            console.log('[RESTART] Déconnexion de la base de données Prisma...');
            await prisma.$disconnect();
            console.log('[RESTART] Lancement d\'un nouveau processus...');

            const fs = require('fs');
            const out = fs.openSync('./restart-out.log', 'a');
            const err = fs.openSync('./restart-err.log', 'a');

            const child = spawn(process.argv[0], process.argv.slice(1), {
                detached: true,
                stdio: ['ignore', out, err],
                cwd: process.cwd(),
            });

            child.unref();
            process.exit(0);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: '⌛ Le temps est écoulé, redémarrage annulé.', embeds: [], components: [] });
            }
        });
    },
};