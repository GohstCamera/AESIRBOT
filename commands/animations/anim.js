const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    GuildScheduledEventEntityType,
    ChannelType
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
                .setDescription('Le canal où envoyer l\'animation')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    async execute(interaction) {
        const requiredRoleId = '1002927692489969724';
        const hasPermission = require('../../utils/hasPermission');

        if (!interaction.member.roles.cache.has(requiredRoleId) && !hasPermission(interaction, ['Administrator'])) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const providedChannel = interaction.options.getChannel('canal');
        const interactionId = uuidv4();

        if (providedChannel) {
            const button = new ButtonBuilder()
                .setCustomId(`anim_show_modal_${interactionId}_${providedChannel.id}`)
                .setLabel('📝 Remplir les détails')
                .setStyle(ButtonStyle.Primary);

            await interaction.editReply({
                content: `📍 Canal de publication choisi : ${providedChannel}.`,
                components: [new ActionRowBuilder().addComponents(button)],
            });
        } else {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`anim_channel_select_${interactionId}`)
                .setPlaceholder('Choisir un salon textuel...')
                .addOptions(
                    interaction.guild.channels.cache
                        .filter(c => c.type === ChannelType.GuildText)
                        .map(c => ({ label: c.name, value: c.id }))
                        .slice(0, 25)
                );

            await interaction.editReply({
                content: '📢 Veuillez sélectionner le salon de publication :',
                components: [new ActionRowBuilder().addComponents(selectMenu)],
            });
        }
    },

    async handleChannelSelect(interaction) {
        await interaction.deferUpdate();
        const interactionId = interaction.customId.split('_')[3];
        const channelId = interaction.values[0];

        const button = new ButtonBuilder()
            .setCustomId(`anim_show_modal_${interactionId}_${channelId}`)
            .setLabel('📝 Remplir les détails')
            .setStyle(ButtonStyle.Primary);

        await interaction.editReply({
            content: `✅ Salon sélectionné : <#${channelId}>.`,
            components: [new ActionRowBuilder().addComponents(button)]
        });
    },

    async handleShowModal(interaction) {
        const interactionId = interaction.customId.split('_')[3];
        const channelId = interaction.customId.split('_')[4];

        const modal = new ModalBuilder()
            .setCustomId(`anim_details_modal_${interactionId}_${channelId}`)
            .setTitle('Détails de l\'animation');

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel("Titre de l'événement").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Ex: Tournoi Valorant")),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel("Description").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder("Décrivez l'animation...")),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date').setLabel("Date (JJ/MM/AAAA)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Ex: 25/12/2024")),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('time').setLabel("Heure (HH:MM)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Ex: 21:00")),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('places').setLabel("Nombre de places (0 = illimité)").setStyle(TextInputStyle.Short).setRequired(false).setValue('0'))
        );

        await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
        await interaction.deferUpdate();
        const interactionId = interaction.customId.split('_')[3];
        const channelId = interaction.customId.split('_')[4];

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const date = interaction.fields.getTextInputValue('date');
        const time = interaction.fields.getTextInputValue('time');
        const slots = parseInt(interaction.fields.getTextInputValue('places') || '0', 10) || 0;

        const animationDateTime = moment(`${date} ${time}`, 'DD/MM/YYYY HH:mm', true);
        if (!animationDateTime.isValid()) return interaction.followUp({ content: '❌ Format de date ou d\'heure invalide (JJ/MM/AAAA HH:MM).', ephemeral: true });
        if (animationDateTime.isBefore(moment())) return interaction.followUp({ content: '❌ La date ne peut pas être dans le passé.', ephemeral: true });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`anim_type_online_${interactionId}`).setLabel('En ligne').setStyle(ButtonStyle.Primary).setEmoji('💻'),
            new ButtonBuilder().setCustomId(`anim_type_physical_${interactionId}`).setLabel('En physique').setStyle(ButtonStyle.Secondary).setEmoji('📍')
        );

        animationManager.setTempData(interactionId, { channelId, title, description, date, time, slots });

        await interaction.editReply({
            content: '📍 **Dernière étape** : Où se déroulera l\'animation ?',
            components: [row]
        });
    },

    async handleEventTypeSelect(interaction) {
        const parts = interaction.customId.split('_');
        const eventType = parts[2];
        const interactionId = parts[3];

        if (eventType === 'online') {
            await interaction.deferUpdate();
            const entityOptions = {
                entityType: GuildScheduledEventEntityType.External,
                entityMetadata: { location: 'Discord AESIR' },
            };
            await this.createScheduledEvent(interaction, interactionId, entityOptions);
        } else if (eventType === 'physical') {
            const addressModal = new ModalBuilder()
                .setCustomId(`anim_address_modal_${interactionId}`)
                .setTitle('Lieu de l\'événement');

            addressModal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('address').setLabel("Adresse complète").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Ex: 123 Rue de l'Exemple, Clermont-Ferrand")
            ));
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
            entityType: GuildScheduledEventEntityType.External,
            entityMetadata: { location: address },
        };

        await this.createScheduledEvent(interaction, interactionId, entityOptions);
    },

    async createScheduledEvent(interaction, interactionId, entityOptions) {
        const animData = animationManager.getTempData(interactionId);
        const { channelId, title, description, date, time, slots } = animData;
        const animationDateTime = moment(`${date} ${time}`, 'DD/MM/YYYY HH:mm');
        const logChannelId = '1002927821154418738';

        try {
            const scheduledEvent = await interaction.guild.scheduledEvents.create({
                name: title,
                description: `${description}\n\n👥 Places : ${slots === 0 ? 'Illimitées' : slots}`,
                scheduledStartTime: animationDateTime.toDate(),
                scheduledEndTime: new Date(animationDateTime.toDate().getTime() + 3 * 3600000), // +3h par défaut
                privacyLevel: 2,
                ...entityOptions,
            });

            // --- 1. Beau message pour l'utilisateur ---
            const successEmbed = new EmbedBuilder()
                .setTitle('📅 Animation Programmée !')
                .setDescription(`L'événement **${title}** a été créé avec succès.`)
                .setColor('#2ecc71')
                .addFields(
                    { name: '📍 Lieu', value: `${entityOptions.entityMetadata.location}`, inline: true },
                    { name: '⏰ Date & Heure', value: `<t:${Math.floor(animationDateTime.valueOf() / 1000)}:F>`, inline: true },
                    { name: '👥 Places', value: `${slots === 0 ? 'Illimitées' : slots}`, inline: true }
                )
                .setURL(scheduledEvent.url)
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [successEmbed], components: [] });

            // --- 2. Log automatique ---
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🛠️ Log : Création d\'animation')
                    .setColor('#3498db')
                    .setDescription(`Une nouvelle animation a été programmée par **${interaction.user.tag}**.`)
                    .addFields(
                        { name: '📝 Titre', value: title, inline: true },
                        { name: '📅 Date', value: `${date} à ${time}`, inline: true },
                        { name: '🔗 Lien', value: `[Accéder à l'événement](${scheduledEvent.url})`, inline: false }
                    )
                    .setFooter({ text: `ID Utilisateur : ${interaction.user.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }

            // --- 3. Notification dans le salon choisi ---
            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (targetChannel) {
                const publicEmbed = new EmbedBuilder()
                    .setTitle(`📣 Nouvelle Animation : ${title}`)
                    .setDescription(description)
                    .setColor('#f1c40f')
                    .addFields(
                        { name: '⏰ Quand ?', value: `<t:${Math.floor(animationDateTime.valueOf() / 1000)}:F>`, inline: false },
                        { name: '📍 Où ?', value: entityOptions.entityMetadata.location, inline: true },
                        { name: '👥 Places', value: `${slots === 0 ? 'Illimitées' : slots}`, inline: true }
                    )
                    .setFooter({ text: `Organisé par ${interaction.user.username}` })
                    .setTimestamp();

                await targetChannel.send({ content: '@everyone', embeds: [publicEmbed] });
            }

        } catch (error) {
            console.error("Erreur création évent :", error);
            await interaction.editReply({ content: `❌ Erreur lors de la création de l'événement. Vérifiez mes permissions.` });
        }
        animationManager.clearTempData(interactionId);
    },

    async handleVoiceChannelSelect(interaction) {}
};