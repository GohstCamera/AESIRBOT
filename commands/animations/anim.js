const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
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
        const hasPermission = require('../../utils/hasPermission');

        if (!interaction.member.roles.cache.has(requiredRoleId) && !hasPermission(interaction, ['Administrator'])) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
                ephemeral: true
            });
        }

        // Utilisation de deferReply pour éviter le timeout de 3s
        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (e) {
            console.error("Erreur lors du deferReply:", e);
            return;
        }

        const providedChannel = interaction.options.getChannel('canal');
        const interactionId = uuidv4();

        if (providedChannel) {
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
                        .slice(0, 25)
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.editReply({
                embeds: [embed],
                components: [row],
            });
        }
    },

    async handleChannelSelect(interaction) {
        // ACCUSÉ DE RÉCEPTION de l'interaction de sélection
        await interaction.deferUpdate();

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
        // Pas de deferUpdate ici car showModal est une réponse directe
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
        // Accusé de réception de la soumission du modal
        await interaction.deferUpdate();

        const interactionId = interaction.customId.split('_')[3];
        const channelId = interaction.customId.split('_')[4];

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const date = interaction.fields.getTextInputValue('date');
        const time = interaction.fields.getTextInputValue('time');
        const slots = parseInt(interaction.fields.getTextInputValue('places') || '0', 10) || 0;

        const animationDateTime = moment(`${date} ${time}`, 'DD/MM/YYYY HH:mm', true);

        if (!animationDateTime.isValid()) {
            return interaction.followUp({ content: '❌ Format de date ou d\'heure invalide.', ephemeral: true });
        }

        if (animationDateTime.isBefore(moment())) {
            return interaction.followUp({ content: '❌ La date ne peut pas être dans le passé.', ephemeral: true });
        }

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

        await interaction.editReply({
            content: 'Dernière étape : choix du type d\'événement.',
            embeds: [embed],
            components: [row]
        });
    },

    async handleEventTypeSelect(interaction) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        const eventType = parts[2];
        const interactionId = parts[3];

        const animData = animationManager.getTempData(interactionId);
        if (!animData) {
            return interaction.editReply({ content: '❌ Données expirées.', embeds: [], components: [] });
        }

        if (eventType === 'online') {
            const entityOptions = {
                entityType: ScheduledEntityType.External,
                entityMetadata: { location: 'Discord AESIR' },
            };
            await this.createScheduledEvent(interaction, interactionId, entityOptions);
        } else if (eventType === 'physical') {
            const addressModal = new ModalBuilder()
                .setCustomId(`anim_address_modal_${interactionId}`)
                .setTitle('Adresse de l\'événement');

            const addressInput = new TextInputBuilder()
                .setCustomId('address')
                .setLabel("Adresse complète")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            addressModal.addComponents(new ActionRowBuilder().addComponents(addressInput));
            await interaction.showModal(addressModal);
        }
    },

    async handleAddressModalSubmit(interaction) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split('_');
        const interactionId = parts[3];

        const animData = animationManager.getTempData(interactionId);
        if (!animData) return interaction.editReply({ content: '❌ Données expirées.' });

        const address = interaction.fields.getTextInputValue('address');
        const entityOptions = {
            entityType: ScheduledEntityType.External,
            entityMetadata: { location: address },
        };

        await this.createScheduledEvent(interaction, interactionId, entityOptions);
    },

    async createScheduledEvent(interaction, interactionId, entityOptions) {
        const animData = animationManager.getTempData(interactionId);
        const { title, description, date, time, slots } = animData;
        const animationDateTime = moment(`${date} ${time}`, 'DD/MM/YYYY HH:mm');

        const eventDescription = `${description}\n\n--------------------\nPlaces : ${slots === 0 ? 'Illimitées' : slots}`;

        try {
            const scheduledEvent = await interaction.guild.scheduledEvents.create({
                name: title,
                description: eventDescription,
                scheduledStartTime: animationDateTime.toDate(),
                privacyLevel: 2,
                ...entityOptions,
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Événement créé !')
                .setDescription(`L'événement **${title}** a été programmé.`)
                .setURL(scheduledEvent.url)
                .setColor('#2ecc71');

            await interaction.editReply({ content: '', embeds: [successEmbed], components: [] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Erreur lors de la création de l'événement.` });
        }

        animationManager.clearTempData(interactionId);
    },

    async handleVoiceChannelSelect(interaction) {}
};