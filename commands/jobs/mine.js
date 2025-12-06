const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Ces constantes sont toujours valides
const PICKAXE_BONUS = {
    basique: 1,
    fer: 1.5,
    diamant: 2.0,
};

const WAGON_CAPACITY = {
    petit: 100, // Wagon de base
    moyen: 200,
    grand: 500,
};

// NOUVELLES RESSOURCES - Concentrées sur le MINAGE (pierre, métal, charbon, or)
const BASE_RATES = {
    pierre: 20,
    metal: 10,
    charbon: 5,
    or: 1,
};

// Définition des objets de job qui ne sont PAS une pioche.
// On exclut le bois et la nourriture pour obliger l'utilisateur à faire d'autres jobs.
const JOB_ITEMS = [
    'hache',    // Bûcheron (pour le bois)
    'filet',    // Pêcheur (pour la nourriture/argent)
    'couteau',  // Chasseur (pour la nourriture)
    // ... autres objets qui ne sont pas des pioches ou des wagons
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('Partir miner pour récolter des ressources.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const user = await prisma.user.findUnique({
            where: { id: interaction.user.id },
            include: { crew: true }
        });

        if (!user || !user.crew) {
            return interaction.editReply({ content: '❌ Tu dois être dans un clan pour miner des ressources.' });
        }
        
        // 1. VÉRIFICATION DU COOLDOWN
        const now = Date.now();
        // Cooldown d'une heure (3 600 000 ms)
        const COOLDOWN_DURATION = 3600000; 
        if (user.mineCooldown && now < new Date(user.mineCooldown).getTime()) {
            const timeLeft = Math.ceil((new Date(user.mineCooldown).getTime() - now) / 60000);
            return interaction.editReply({ content: `⏳ Tu dois attendre encore **${timeLeft} minutes** pour miner à nouveau.` });
        }
        
        // 2. VÉRIFICATION DE L'ÉQUIPEMENT
        // La pioche par défaut doit être 'basique' si le champ est vide
        const pickaxe = user.pickaxe || 'basique';
        const wagon = user.wagon || 'petit';
        
        const pickaxeBonus = PICKAXE_BONUS[pickaxe] || 1;
        const wagonCapacity = WAGON_CAPACITY[wagon] || 100;
        
        // On suppose que user.jobsItems est un tableau (type JSON dans Prisma) ou une chaîne à séparer
        // S'il s'agit d'une chaîne (ex: "hache,filet"), décommentez la ligne suivante :
        // const userJobItems = user.jobsItems ? user.jobsItems.split(',') : [];

        // Si c'est un Array/JSON (le cas préféré si possible) :
        const userJobItems = Array.isArray(user.jobsItems) ? user.jobsItems : [];


        // 3. VÉRIFICATION DE L'ÉQUIPEMENT SPÉCIFIQUE (NON MINAGE)
        // L'utilisateur ne peut pas récolter les ressources du minage s'il n'a pas de pioche
        // ATTENTION: Puisque le bois et la nourriture ont été retirés de BASE_RATES, 
        // cette vérification est désormais implicite. L'utilisateur mine des minéraux.
        
        if (pickaxe === 'basique') {
            return interaction.editReply({ 
                content: `❌ Tu n'as pas de pioche, tu ne peux miner que des pierres de base. Achète une pioche dans la boutique pour débloquer plus de minerais !` 
            });
        }
        
        // 4. CALCUL DES GAINS
        let gains = {};
        let totalGains = 0;
        
        // La récolte est désormais basée sur les minéraux et le bonus de pioche
        for (const resource in BASE_RATES) {
            // Seule la pierre est minée si l'équipement est trop basique
            if (pickaxe === 'fer' && (resource === 'charbon' || resource === 'or')) {
                // Le fer ne donne pas de charbon ou d'or (ajustez selon votre jeu)
                continue; 
            }
            if (pickaxe === 'diamant' || (pickaxe === 'fer' && resource === 'metal') || resource === 'pierre') {
                const baseGain = BASE_RATES[resource];
                const finalGain = Math.floor(baseGain * pickaxeBonus);
                gains[resource] = finalGain;
                totalGains += finalGain;
            }
        }
        
        // 5. APPLICATION DE LA CAPACITÉ DU WAGON (LIMITE MAXIMALE)
        let actualTotalGains = totalGains;
        if (totalGains > wagonCapacity) {
            const ratio = wagonCapacity / totalGains;
            actualTotalGains = wagonCapacity;
            for (const resource in gains) {
                gains[resource] = Math.floor(gains[resource] * ratio);
            }
        }
        
        // 6. MISE À JOUR DE LA BASE DE DONNÉES
        const crewUpdateData = {};
        let gainFields = [];
        
        for (const resource in gains) {
            if (gains[resource] > 0) {
                // Ajout de l'incrémentation pour chaque ressource minée
                crewUpdateData[resource] = { increment: gains[resource] };
                
                // Préparation pour l'Embed (affichage)
                gainFields.push({ name: resource.charAt(0).toUpperCase() + resource.slice(1), value: `+${gains[resource]}`, inline: true });
            }
        }
        
        // Le joueur a-t-il réellement miné quelque chose ?
        if (gainFields.length === 0) {
             return interaction.editReply({ content: `❌ Même ta pioche basique ne te permet pas de miner de la pierre. Achète un équipement plus efficace !` });
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { mineCooldown: new Date(now + COOLDOWN_DURATION) },
            }),
            prisma.crew.update({
                where: { id: user.crew.id },
                data: crewUpdateData,
            })
        ]);

        // 7. ENVOI DE L'EMBED
        const embed = new EmbedBuilder()
            .setTitle('⛏️ Minage terminé !')
            .setDescription(`Tu as miné avec succès ! Ton **Wagon (${wagonCapacity})** a été rempli à ${Math.round((actualTotalGains / wagonCapacity) * 100)}%.`)
            .setColor('#7f8c8d')
            .addFields(gainFields)
            .setFooter({ text: `Pioche: ${pickaxe} | Wagon: ${wagon}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};