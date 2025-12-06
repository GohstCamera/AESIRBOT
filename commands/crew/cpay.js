const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient, TransactionType } = require('@prisma/client');
const prisma = new PrismaClient();

// --- CONFIGURATION : TAUX DE CONVERSION ET DISTRIBUTION ---
const CONFIG = {
    // Distribution des Diamants Totaux générés
    CLAN_SHARE_PERCENT: 0.70, // 70% pour le Clan
    USER_SHARE_PERCENT: 0.30, // 30% pour l'Utilisateur
    
    // Taux de Génération de Diamants (TOTAL généré avant distribution)
    DIAMONDS_PER_100_EURO: 20, 
    DIAMONDS_PER_100_RESOURCE: 30, // Taux pour les ressources
    
    // Récompense en Notoriété (par Diamant TOTAL généré)
    NOTORIETY_PER_DIAMOND: 2, 

    // Coût en € pour acheter 1 unité de ressource à donner 
    COST_PER_RESOURCE_UNIT: 1, 
};

// Fonction utilitaire pour vérifier si la date de la dernière donation doit être réinitialisée
function shouldResetDailyCount(lastDate) {
    if (!lastDate) return true;
    
    const today = new Date();
    const last = new Date(lastDate);
    
    // Vérifie si le jour est différent (Ignorer l'heure, ne comparer que la date YYYY-MM-DD)
    return today.toDateString() !== last.toDateString();
}

module.exports = {
    // Définition de la commande principale /cpay et de ses sous-commandes
    data: new SlashCommandBuilder()
        .setName('cpay')
        .setDescription('Faire un don d\'argent ou de ressources pour générer des Diamants et de la Notoriété.')
        // 1. Sous-commande pour le don d'ARGENT (€)
        .addSubcommand(subcommand =>
            subcommand
                .setName('argent')
                .setDescription('Faire un don de monnaie (€). Génère des Diamants (Clan/Perso) et de la Notoriété.')
                .addIntegerOption(option =>
                    option.setName('montant')
                        .setDescription('Le montant en € à donner (Min. 100€).')
                        .setRequired(true)
                        .setMinValue(100)
                )
        )
        // 2. Sous-commande pour le don de RESSOURCE
        .addSubcommand(subcommand =>
            subcommand
                .setName('ressource')
                .setDescription('Acheter une ressource pour le clan. Génère des Diamants (Clan/Perso) et de la Notoriété.')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Le type de ressource à donner.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Bois 🪵', value: 'bois' },
                            { name: 'Pierre 🧱', value: 'pierre' },
                            { name: 'Nourriture 🍖', value: 'nourriture' },
                        )
                )
                .addIntegerOption(option =>
                    option.setName('quantite')
                        .setDescription('La quantité de ressource à donner (Min. 100 unités).')
                        .setRequired(true)
                        .setMinValue(100)
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        // 1. Récupérer les données de l'utilisateur et du clan
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                balance: true,
                diamants: true, 
                notoriety: true, 
                crewId: true,
                dailyDonationCount: true, 
                lastDonationDate: true,    
                maxDailyDonations: true, // Limite personnalisée
                crew: {
                    select: {
                        id: true,
                        name: true,
                        diamants: true, 
                        bois: true,
                        pierre: true,
                        nourriture: true,
                        power: true, 
                    }
                }
            }
        });

        // Vérification du clan
        if (!user || !user.crewId || !user.crew) {
            return interaction.editReply({
                content: '❌ Vous devez faire partie d\'un clan pour faire un don !',
                ephemeral: true
            });
        }
        
        const crew = user.crew;
        let finalUserUpdate = {};
        let finalCrewUpdate = {};
        let embedDescription = '';
        let success = true;
        let totalDiamondsGenerated = 0;
        let transactionAmount = 0; // Montant en € dépensé pour la transaction

        let currentDonationCount = user.dailyDonationCount || 0;
        let lastDonationDate = user.lastDonationDate;
        
        // --- 2. LOGIQUE DE LA LIMITE QUOTIDIENNE ---
        const donationLimit = user.maxDailyDonations || 10;
        
        if (shouldResetDailyCount(lastDonationDate)) {
            currentDonationCount = 0;
        }

        if (currentDonationCount >= donationLimit) {
             return interaction.editReply({
                content: `⏳ Vous avez atteint la limite de **${donationLimit} dons** pour aujourd'hui. Réessayez demain !`,
                ephemeral: true
            });
        }
        
        const newDonationCount = currentDonationCount + 1;
        
        // --- 3. LOGIQUE DES DONS PAR SOUS-COMMANDE ---
        try {
            if (subcommand === 'argent') {
                const amount = interaction.options.getInteger('montant');
                transactionAmount = amount; // Le montant en € dépensé
                
                if (user.balance < amount) {
                    success = false;
                    embedDescription = `❌ Vous n'avez pas assez d'argent. Votre solde actuel est de ${user.balance.toLocaleString()}€.`;
                } else {
                    const ratio = Math.floor(amount / 100);
                    if (ratio === 0) {
                        success = false;
                        embedDescription = `❌ Le montant minimum de 100€ est requis pour générer des récompenses.`;
                    } else {
                        totalDiamondsGenerated = ratio * CONFIG.DIAMONDS_PER_100_EURO;
                        
                        // Calcul des gains et répartition 70/30
                        const generatedClanDiamants = Math.round(totalDiamondsGenerated * CONFIG.CLAN_SHARE_PERCENT);
                        const generatedUserDiamants = totalDiamondsGenerated - generatedClanDiamants;
                        const generatedNotoriety = totalDiamondsGenerated * CONFIG.NOTORIETY_PER_DIAMOND;
                        
                        // Mise à jour de l'utilisateur
                        finalUserUpdate = { 
                            balance: user.balance - amount, 
                            diamants: user.diamants + generatedUserDiamants,
                            notoriety: user.notoriety + generatedNotoriety,
                            dailyDonationCount: newDonationCount,
                            lastDonationDate: new Date(),
                        };

                        // Mise à jour du clan
                        finalCrewUpdate = { 
                            diamants: crew.diamants + generatedClanDiamants 
                        };

                        embedDescription = `Vous avez donné **${amount.toLocaleString()}€** à votre clan, **${crew.name}** !`
                                         + `\n\n**Récompenses de la transaction (Total ${totalDiamondsGenerated} 💎):**`
                                         + `\n+ **${generatedClanDiamants.toLocaleString()} 💎** pour le Clan (70%).`
                                         + `\n+ **${generatedUserDiamants.toLocaleString()} 💎** pour vous (30%).`
                                         + `\n+ **${generatedNotoriety.toLocaleString()} Notoriété** pour vous.`;
                    }
                }

            } else if (subcommand === 'ressource') {
                const type = interaction.options.getString('type');
                const quantity = interaction.options.getInteger('quantite');
                const totalCost = quantity * CONFIG.COST_PER_RESOURCE_UNIT; 
                transactionAmount = totalCost; // Le montant en € dépensé
                
                if (user.balance < totalCost) {
                    success = false;
                    embedDescription = `❌ Pour acheter ${quantity.toLocaleString()} de ${type} et les donner, vous avez besoin de ${totalCost.toLocaleString()}€. Votre solde actuel est de ${user.balance.toLocaleString()}€.`;
                } else {
                    const ratio = Math.floor(quantity / 100);
                    if (ratio === 0) {
                        success = false;
                        embedDescription = `❌ La quantité minimale de 100 unités est requise pour générer des récompenses.`;
                    } else {
                        totalDiamondsGenerated = ratio * CONFIG.DIAMONDS_PER_100_RESOURCE; 

                        // Calcul des gains et répartition 70/30
                        const generatedClanDiamants = Math.round(totalDiamondsGenerated * CONFIG.CLAN_SHARE_PERCENT);
                        const generatedUserDiamants = totalDiamondsGenerated - generatedClanDiamants; 
                        const generatedNotoriety = totalDiamondsGenerated * CONFIG.NOTORIETY_PER_DIAMOND;

                        // Mise à jour de l'utilisateur
                        finalUserUpdate = { 
                            balance: user.balance - totalCost, 
                            diamants: user.diamants + generatedUserDiamants,
                            notoriety: user.notoriety + generatedNotoriety,
                            dailyDonationCount: newDonationCount,
                            lastDonationDate: new Date(),
                        };
                        
                        // Mise à jour du clan
                        finalCrewUpdate = { 
                            diamants: crew.diamants + generatedClanDiamants, 
                            [type]: crew[type] + quantity // Ajout de la ressource au stock
                        };
                        
                        embedDescription = `Vous avez acheté et donné **${quantity.toLocaleString()} ${type}** à votre clan, **${crew.name}** (Coût: ${totalCost.toLocaleString()}€) !`
                                         + `\n\n**Récompenses de la transaction (Total ${totalDiamondsGenerated} 💎):**`
                                         + `\n+ **${generatedClanDiamants.toLocaleString()} 💎** pour le Clan (70%).`
                                         + `\n+ **${generatedUserDiamants.toLocaleString()} 💎** pour vous (30%).`
                                         + `\n+ **${generatedNotoriety.toLocaleString()} Notoriété** pour vous.`;
                    }
                }
            }

            // --- 4. Application des mises à jour des données (transaction Prisma) ---
            if (success) {
                // Création de l'enregistrement de la transaction (historique)
                const transactionCreation = prisma.transaction.create({
                    data: {
                        senderId: userId,
                        // Le destinataire est l'utilisateur lui-même (récipiendaire de la récompense)
                        recipientId: userId, 
                        amount: transactionAmount, // Montant en € dépensé par le joueur
                        type: TransactionType.CREW_DONATION,
                        crewId: crew.id,
                    },
                });

                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: userId },
                        data: finalUserUpdate,
                    }),
                    prisma.crew.update({
                        where: { id: crew.id },
                        data: finalCrewUpdate,
                    }),
                    transactionCreation, // Enregistrement dans l'historique
                ]);
            }

        } catch (error) {
            console.error('❌ ERREUR-CPAY] Échec de l\'exécution de /cpay:', error.stack);
            success = false;
            embedDescription = 'Une erreur inattendue est survenue. Veuillez réessayer.';
        }

        // --- 5. Envoi de la réponse ---
        const newBalance = success ? finalUserUpdate.balance : user.balance;
        const newDiamants = success ? finalUserUpdate.diamants : user.diamants;
        const newNotoriety = success ? finalUserUpdate.notoriety : user.notoriety;
        
        const finalEmbed = new EmbedBuilder()
            .setTitle(success ? 'Don au Clan Réussi ! 🎉' : 'Transaction Annulée 🚨')
            .setDescription(embedDescription)
            .setColor(success ? 'Green' : 'Red')
            .setFooter({ 
                text: `Dons restants aujourd'hui: ${donationLimit > 0 ? donationLimit - (success ? newDonationCount : currentDonationCount) : 'N/A'} | Solde: ${newBalance.toLocaleString()}€ | Diamants: ${newDiamants.toLocaleString()} 💎 | Notoriété: ${newNotoriety.toLocaleString()} ✨` 
            })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [finalEmbed], ephemeral: true });
    },
};