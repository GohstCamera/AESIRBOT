const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Définition des taux de conversion en puissance
const CONVERSION_RATES = {
    argent: 10,        // 10€ = 1 point de puissance (1 point par 10€)
    bois: 5,           // 5 bois = 1 point de puissance (1 point par 5 bois)
    pierre: 8,         // 8 pierres = 1 point de puissance
    nourriture: 4,     // 4 nourritures = 1 point de puissance
};

const RESOURCE_EMOJIS = {
    argent: '€',
    bois: '🪵',
    pierre: '🧱',
    nourriture: '🍖',
};

// Mappage des options d'entrée aux clés de l'inventaire (jobs)
const INVENTORY_MAP = {
    bois: 'bois',      // Clé JSON dans user.jobs
    pierre: 'pierre',  // Clé JSON dans user.jobs
    nourriture: 'nourriture', // Clé JSON dans user.jobs
};


module.exports = {
    data: new SlashCommandBuilder()
        .setName('don')
        .setDescription('Fais un don (argent ou ressources) pour augmenter la puissance de ton clan.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Le type de don à faire.')
                .setRequired(true)
                .addChoices(
                    { name: 'Argent', value: 'argent' },
                    { name: 'Bois', value: 'bois' },
                    { name: 'Pierre', value: 'pierre' },
                    { name: 'Nourriture', value: 'nourriture' }
                ))
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le montant/quantité du don.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const donType = interaction.options.getString('type');
        const montant = interaction.options.getInteger('montant');
        const resourceEmoji = RESOURCE_EMOJIS[donType];

        try {
            // 1. Récupération des données utilisateur et du clan
            // 💡 AJOUT : Récupération des champs de limite de don
            const user = await prisma.user.findUnique({
                where: { id: interaction.user.id },
                select: { 
                    id: true, 
                    balance: true, 
                    jobs: true, 
                    crewId: true, 
                    crew: true,
                    // NOUVEAUX CHAMPS
                    maxDonation: true,
                    dailyDonationCount: true,
                    lastDonationDate: true,
                    donationBoostValue: true,
                    donationBoostExpiresAt: true,
                }
            });

            if (!user || !user.crew) {
                return interaction.editReply({ content: '❌ Tu dois être dans un clan pour faire un don.' });
            }

            const conversionRate = CONVERSION_RATES[donType];
            const powerGain = Math.floor(montant / conversionRate);

            if (powerGain < 1) {
                return interaction.editReply({ content: `❌ Le montant est trop faible pour gagner de la puissance. Il faut au moins **${conversionRate} ${donType}** pour gagner 1 point.` });
            }
            
            // --- 2. GESTION DES LIMITES DE DON (APPLICABLE UNIQUEMENT À L'ARGENT) ---
            let updateUserData = {};
            let updateCrewData = {
                power: { increment: powerGain },
                // Ajout des ressources/argent au stock du clan
                [donType]: { increment: montant }
            };
            
            // Logique pour l'argent (avec limite)
            if (donType === 'argent') {
                
                // 2.1. CALCUL DE LA LIMITE ACTUELLE
                let currentMaxDonation = user.maxDonation; // La base permanente
                let isBoostActive = false;

                // 2.2. VÉRIFICATION ET APPLICATION DU BOOST TEMPORAIRE
                if (user.donationBoostExpiresAt && user.donationBoostExpiresAt > new Date()) {
                    currentMaxDonation += user.donationBoostValue;
                    isBoostActive = true;
                } else {
                    // Si le boost a expiré, on s'assure qu'il est réinitialisé dans la BDD (si on ne l'a pas fait avant)
                    if (user.donationBoostValue > 0) {
                         // On ne le réinitialise pas ici pour ne pas compliquer la transaction, on le fait à la prochaine connexion/commande pour cet utilisateur
                         // Pour l'instant, on ignore juste sa valeur si la date est dépassée
                    }
                }

                // 2.3. VÉRIFICATION DU COMPTEUR QUOTIDIEN ET RÉINITIALISATION
                const today = new Date().toDateString();
                const lastDonationDay = user.lastDonationDate.toDateString();
                let dailyDonationCount = user.dailyDonationCount;

                // Si le dernier don n'était pas aujourd'hui, réinitialiser le compteur
                if (lastDonationDay !== today) {
                    dailyDonationCount = 0;
                }
                
                // 2.4. CALCUL DU MONTANT RESTANT DISPONIBLE
                const donationRemaining = currentMaxDonation - dailyDonationCount;

                if (donationRemaining <= 0) {
                    return interaction.editReply({ 
                        content: `❌ Tu as atteint ta limite de don quotidienne (**${currentMaxDonation.toLocaleString()}€**). Réessaie demain.`,
                        ephemeral: true
                    });
                }

                if (montant > donationRemaining) {
                    return interaction.editReply({ 
                        content: `❌ Tu ne peux donner que **${donationRemaining.toLocaleString()}€** de plus aujourd'hui (Limite: ${currentMaxDonation.toLocaleString()}€).`
                    });
                }
                
                // 2.5. VÉRIFICATION ARGENT (balance)
                if (user.balance < montant) {
                    return interaction.editReply({ content: `❌ Tu n'as pas assez d'argent. Il te manque **${(montant - user.balance).toLocaleString()}€**.` });
                }
                
                // 2.6. MISE À JOUR DES DONNÉES UTILISATEUR (Débit + Limites)
                updateUserData.balance = { decrement: montant };
                updateUserData.dailyDonationCount = { increment: montant };
                updateUserData.lastDonationDate = new Date();
                
            } 
            
            // Logique pour les ressources (sans limite de don quotidienne)
            else { 
                let userJobs = {};
                if (user.jobs && user.jobs !== "") {
                    try {
                        userJobs = JSON.parse(user.jobs);
                    } catch (e) {
                        console.error("Erreur de parsing JSON pour l'inventaire :", user.jobs, e);
                        userJobs = {}; 
                    }
                }

                const inventoryKey = INVENTORY_MAP[donType];
                const userResourceStock = userJobs[inventoryKey] || 0;

                // VÉRIFICATION RESSOURCES
                if (userResourceStock < montant) {
                    return interaction.editReply({ 
                        content: `❌ Tu n'as pas assez de **${donType}** dans ton inventaire. Il te manque **${(montant - userResourceStock).toLocaleString()} ${resourceEmoji}**.` 
                    });
                }

                // DÉBIT RESSOURCES (Mise à jour du JSON)
                userJobs[inventoryKey] = userResourceStock - montant;
                updateUserData.jobs = JSON.stringify(userJobs);
                
                // Pour la traçabilité des transactions de clan, on peut utiliser un ID factice 'RESOURCE_BANK'
                updateCrewData.transactionRecipientId = 'RESOURCE_BANK';
            }

            // --- 3. EXÉCUTION DE LA TRANSACTION BDD ---
            await prisma.$transaction(async (tx) => {
                // 3.1. Débiter l'utilisateur
                await tx.user.update({
                    where: { id: user.id },
                    data: updateUserData,
                });

                // 3.2. Créditer le clan (Puissance et Stock)
                await tx.crew.update({
                    where: { id: user.crew.id },
                    data: updateCrewData,
                });
                
                // 3.3. Enregistrement de la transaction
                await tx.transaction.create({
                    data: {
                        senderId: user.id,
                        recipientId: user.crew.id, // L'ID du clan comme destinataire (ou "BOT_BANK" si argent)
                        amount: montant,
                        type: 'CREW_DONATION', // Utilisation de l'enum CREW_DONATION
                        crewId: user.crew.id,
                        createdAt: new Date(),
                    }
                });
            });

            // --- 4. RÉPONSE DE SUCCÈS ---
            const embed = new EmbedBuilder()
                .setTitle(`🤝 Don de ${donType} réussi pour ${user.crew.name}`)
                .setDescription(`Tu as donné **${montant.toLocaleString()} ${resourceEmoji}** de ${donType} au clan !`)
                .addFields(
                    { name: '💪 Puissance Gagnée', value: `+**${powerGain.toLocaleString()}** 💪`, inline: true },
                    { name: `${donType.charAt(0).toUpperCase() + donType.slice(1)} ajouté au stock`, value: `+**${montant.toLocaleString()} ${resourceEmoji}**`, inline: true },
                    { name: 'Total Puissance du Clan (Avant Don)', value: `${(user.crew.power).toLocaleString()} 💪`, inline: false }
                )
                .setColor(donType === 'argent' ? '#2ecc71' : '#e67e22') // Couleur différente pour l'argent/ressources
                .setTimestamp();
            
            if (donType === 'argent') {
                const newDailyCount = user.dailyDonationCount + montant;
                const totalMax = currentMaxDonation;
                const remaining = totalMax - newDailyCount;

                embed.setFooter({ text: isBoostActive ? '🚀 Bonus de don actif !' : '' });
                embed.addFields({
                    name: `Limite de Don (Aujourd'hui)`, 
                    value: `**${newDailyCount.toLocaleString()}€** donnés sur **${totalMax.toLocaleString()}€** (${remaining > 0 ? `${remaining.toLocaleString()}€ restants` : 'Limite atteinte'})`, 
                    inline: false 
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Erreur critique lors du don de clan :', error.stack);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande de don. Le don a été annulé.' });
        }
    }
};