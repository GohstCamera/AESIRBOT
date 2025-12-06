const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JOBS_LIST = [
    { id: 'bucheron', name: 'Bûcheron', cost: { bois: 500, pierre: 100 }, description: 'Récolte du bois pour ton clan.', emoji: '🪓' },
    { id: 'chasseur', name: 'Chasseur', cost: { bois: 100, nourriture: 500 }, description: 'Chasse pour de la nourriture.', emoji: '🏹' },
    { id: 'perceur', name: 'Perceur de Coffre', cost: { bois: 200, pierre: 800 }, description: 'Attaque les réserves des autres clans.', emoji: '🕵️' },
    { id: 'pecheur', name: 'Pêcheur', cost: { bois: 300, nourriture: 100 }, description: 'Pêche pour de la nourriture et de l\'argent.', emoji: '🎣' },
    { id: 'ingenieur', name: 'Ingénieur', cost: { bois: 500, pierre: 500 }, description: 'Construis des améliorations pour ton clan.', emoji: '⚙️' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jobs')
        .setDescription('Gère l\'achat de nouveaux jobs.')
        .addStringOption(option =>
            option.setName('job')
                .setDescription('Le job que tu veux acheter.')
                .setRequired(true)
                .addChoices(
                    ...JOBS_LIST.map(job => ({ name: `${job.name} (${job.emoji})`, value: job.id }))
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        const user = await prisma.user.findUnique({
            where: { id: interaction.user.id },
            include: { crew: true }
        });

        if (!user || !user.crew) {
            return interaction.editReply({ content: '❌ Tu dois être dans un clan pour utiliser les jobs.' });
        }

        const jobId = interaction.options.getString('job');
        const jobToBuy = JOBS_LIST.find(job => job.id === jobId);

        if (!jobToBuy) {
            return interaction.editReply({ content: '❌ Ce job n\'existe pas.' });
        }

        const userJobs = user.jobs.split(',').filter(j => j.length > 0);
        if (userJobs.includes(jobId)) {
            return interaction.editReply({ content: `❌ Tu possèdes déjà le job de ${jobToBuy.name}.` });
        }

        const crew = user.crew;
        if (crew.bois < jobToBuy.cost.bois || crew.pierre < jobToBuy.cost.pierre || crew.nourriture < jobToBuy.cost.nourriture) {
            const missingResources = [];
            if (crew.bois < jobToBuy.cost.bois) missingResources.push(`${jobToBuy.cost.bois - crew.bois} bois`);
            if (crew.pierre < jobToBuy.cost.pierre) missingResources.push(`${jobToBuy.cost.pierre - crew.pierre} pierre`);
            if (crew.nourriture < jobToBuy.cost.nourriture) missingResources.push(`${jobToBuy.cost.nourriture - crew.nourriture} nourriture`);

            return interaction.editReply({
                content: `❌ Ton clan n'a pas assez de ressources pour acheter le job de ${jobToBuy.name}. Il vous manque : ${missingResources.join(', ')}.`,
            });
        }

        const updatedJobs = [...userJobs, jobId];

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { jobs: updatedJobs.join(',') },
            }),
            prisma.crew.update({
                where: { id: crew.id },
                data: {
                    bois: { decrement: jobToBuy.cost.bois },
                    pierre: { decrement: jobToBuy.cost.pierre },
                    nourriture: { decrement: jobToBuy.cost.nourriture },
                },
            }),
        ]);

        const embed = new EmbedBuilder()
            .setTitle(`✅ Job acheté !`)
            .setDescription(`Tu es maintenant un **${jobToBuy.name}** !`)
            .setColor('#2ecc71')
            .addFields(
                { name: 'Coût', value: `Bois: ${jobToBuy.cost.bois}\nPierre: ${jobToBuy.cost.pierre}\nNourriture: ${jobToBuy.cost.nourriture}` },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};