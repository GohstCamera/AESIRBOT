const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    MessageFlags,
    ButtonStyle,
    ScheduledEntityType,
} = require('discord.js');
const animationManager = require('./animationManager.js');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('animation')
        .setDescription('Créer un événement programmé.')
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('Le canal où envoyer l\'animation (optionnel, sinon choix interactif)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    async execute(interaction) {
        const requiredRoleId = '1002927692489969724';
        const hasPermission = require('../../../utils/hasPermission');
        const hasPermission = require('../../utils/hasPermission');

        // Vérifie si l'utilisateur a le rôle requis OU s'il est un administrateur/propriétaire
        if (!interaction.member.roles.cache.has(requiredRoleId) && !hasPermission(interaction, ['Administrator'])) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
                ephemeral: true
            });
        }

        // On accuse réception immédiatement pour éviter les timeouts
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const providedChannel = interaction.options.getChannel('canal');
        const interactionId = uuidv4(); // ID unique pour cette session de création

        if (providedChannel) {
            // Si un canal est fourni, on passe directement à l'étape suivante
            const button = new ButtonBuilder()
                .setCustomId(`anim_show_modal_${interactionId}_${providedChannel.id}`)
                .setLabel('📝 Remplir les détails')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);
            await interaction.editReply({
                content: `Vous avez choisi le canal ${providedChannel}. Cliquez sur le bouton pour continuer.`,
                components: [row],
            });
        } else {
            // Sinon, on affiche le menu de sélection de canal
            const embed = new EmbedBuilder()
                .setTitle('Création d\'une nouvelle animation')
                .setDescription('Veuillez sélectionner le canal dans lequel l\'animation sera publiée.')
                .setColor('#3498db');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`anim_channel_select_${interactionId}`)
                .setPlaceholder('Choisir un canal...')
                .addOptions(
                    interaction.guild.channels.cache
                        .filter(c => c.type === ChannelType.GuildText)
                        .map(c => ({ label: c.name, value: c.id }))
                        .slice(0, 25) // Limite de 25 options
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.editReply({
                embeds: [embed],
                components: [row],
            });
        }
    },

    async handleChannelSelect(interaction) {
        const interactionId = interaction.customId.split('_')[3];
        const channelId = interaction.values[0];

        const button = new ButtonBuilder()
            .setCustomId(`anim_show_modal_${interactionId}_${channelId}`)
            .setLabel('📝 Remplir les détails')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.editReply({
            content: `Vous avez sélectionné le canal <#${channelId}>. Cliquez sur le bouton pour continuer.`,
            embeds: [],
            components: [row]
        });
    },

    async handleShowModal(interaction) {
        const interactionId = interaction.customId.split('_')[3];
        const channelId = interaction.customId.split('_')[4];

        const modal = new ModalBuilder()
            .setCustomId(`anim_details_modal_${interactionId}_${channelId}`)
            .setTitle('Détails de l\'animation');

        const titleInput = new TextInputBuilder().setCustomId('title').setLabel("Titre").setStyle(TextInputStyle.Short).setRequired(true);
        const descriptionInput = new TextInputBuilder().setCustomId('description').setLabel("Description").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const dateInput = new TextInputBuilder().setCustomId('date').setLabel("Date (JJ/MM/AAAA)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 25/12/2024');
        const timeInput = new TextInputBuilder().setCustomId('time').setLabel("Heure (HH:MM)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: 21:00');
        const placesInput = new TextInputBuilder().setCustomId('places').setLabel("Places (0 = illimité)").setStyle(TextInputStyle.Short).setRequired(false).setValue('0');

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(dateInput),
            new ActionRowBuilder().addComponents(timeInput),
            new ActionRowBuilder().addComponents(placesInput)
        );

        await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
        // On accuse réception de la soumission du modal en différant la mise à jour du message précédent.
        await interaction.deferUpdate();

        const interactionId = interaction.customId.split('_')[3];

        const channelId = interaction.customId.split('_')[4];
        const channel = await interaction.guild.channels.fetch(channelId);

        if (!channel) {
            return interaction.followUp({ content: '❌ Le canal sélectionné n\'existe plus.', flags: MessageFlags.Ephemeral });
        }

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const date = interaction.fields.getTextInputValue('date');
        const time = interaction.fields.getTextInputValue('time');
        const slots = parseInt(interaction.fields.getTextInputValue('places') || '0', 10) || 0;

        const dateTimeString = `${date} ${time}`;
        const animationDateTime = moment(dateTimeString, 'DD/MM/YYYY HH:mm', true);

        if (!animationDateTime.isValid()) {
            return interaction.followUp({ content: '❌ Format de date ou d\'heure invalide. Utilisez `JJ/MM/AAAA` et `HH:MM`.', flags: MessageFlags.Ephemeral });
        }

        if (animationDateTime.isBefore(moment())) {
            return interaction.followUp({ content: '❌ La date de l\'animation ne peut pas être dans le passé.', ephemeral: true });
        }

        // --- Étape suivante : Choix du type d'événement (En ligne / Physique) ---
        const onlineButton = new ButtonBuilder()
            .setCustomId(`anim_type_online_${interactionId}`)
            .setLabel('En ligne')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💻');

        const physicalButton = new ButtonBuilder()
            .setCustomId(`anim_type_physical_${interactionId}`)
            .setLabel('En physique')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📍');

        const row = new ActionRowBuilder().addComponents(onlineButton, physicalButton);

        const embed = new EmbedBuilder()
            .setTitle('📍 Type d\'événement')
            .setDescription('Où se déroulera l\'animation ?')
            .setColor('#3498db');

        animationManager.setTempData(interactionId, {
            channelId, title, description, date, time, slots,
            author: { tag: interaction.user.tag, avatar: interaction.user.displayAvatarURL() }
        });

        // On utilise followUp pour envoyer un nouveau message éphémère après le deferUpdate
        await interaction.followUp({
            content: 'Dernière étape : choix du type d\'événement.',
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },

    async handleVoiceChannelSelect(interaction) {
        // Cette fonction est maintenant obsolète, mais nous la gardons pour la compatibilité
        // et la redirigeons vers la nouvelle logique si nécessaire.
        // Pour l'instant, nous allons simplement la laisser vide ou la supprimer si elle n'est plus appelée.
    },

    async createScheduledEvent(interaction, interactionId, entityOptions) {
        const animData = animationManager.getTempData(interactionId);

        const { title, description, date, time, slots } = animData;
        const animationDateTime = moment(`${date} ${time}`, 'DD/MM/YYYY HH:mm');

        // Concaténer la description avec le nombre de places
        const eventDescription = `${description}\n\n` +
                                 `--------------------\n` +
                                 `Places : ${slots === 0 ? 'Illimitées' : slots}`;

        try {
            const scheduledEvent = await interaction.guild.scheduledEvents.create({
                name: title,
                description: eventDescription,
                scheduledStartTime: animationDateTime.toDate(),
                privacyLevel: 2, // GuildOnly
                ...entityOptions,
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Événement créé avec succès !')
                .setDescription(`L'événement **${title}** a été programmé.`)
                .setURL(scheduledEvent.url)
                .setColor('#2ecc71');

            // On utilise editReply sur le message "Dernière étape..."
            await interaction.editReply({ content: '', embeds: [successEmbed], components: [] });

        } catch (error) {
            console.error("Erreur lors de la création de l'événement Discord :", error);
            await interaction.editReply({ content: `❌ Une erreur est survenue. Vérifiez que j'ai bien la permission de "Gérer les événements" sur le serveur.`, embeds: [], components: [] });
        }

        animationManager.clearTempData(interactionId);
    },

    async handleEventTypeSelect(interaction) {
        const parts = interaction.customId.split('_');
        const eventType = parts[2]; // 'online' ou 'physical'
        const interactionId = parts[3];

        const animData = animationManager.getTempData(interactionId);
        if (!animData) {
            return interaction.editReply({ content: '❌ Les données de cette animation ont expiré. Veuillez recommencer.', embeds: [], components: [] });
        }

        if (eventType === 'online') {
            const entityOptions = {
                entityType: ScheduledEntityType.External,
                entityMetadata: { location: 'Discord AESIR' },
            };
            await this.createScheduledEvent(interaction, interactionId, entityOptions);
        } else if (eventType === 'physical') {
            // Afficher un modal pour demander l'adresse
            const addressModal = new ModalBuilder()
                .setCustomId(`anim_address_modal_${interactionId}`)
                .setTitle('Adresse de l\'événement');

            const addressInput = new TextInputBuilder()
                .setCustomId('address')
                .setLabel("Adresse complète de l'événement")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Ex: 123 Rue de l\'Exemple, 63000 Clermont-Ferrand');

            addressModal.addComponents(new ActionRowBuilder().addComponents(addressInput));
            await interaction.showModal(addressModal);
        }
    },

    async handleAddressModalSubmit(interaction) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split('_');
        const interactionId = parts[3];

        const animData = animationManager.getTempData(interactionId);
        if (!animData) {
            return interaction.editReply({ content: '❌ Les données de cette animation ont expiré. Veuillez recommencer.', embeds: [], components: [] });
        }

        const address = interaction.fields.getTextInputValue('address');

        if (!address) {
            return interaction.editReply({ content: '❌ L\'adresse ne peut pas être vide.', embeds: [], components: [] });
        }

        const entityOptions = {
            entityType: ScheduledEntityType.External,
            entityMetadata: { location: address },
        };

        // On utilise l'interaction du modal (qui a été différée) pour répondre.
        await this.createScheduledEvent(interaction, interactionId, entityOptions);
    }
};