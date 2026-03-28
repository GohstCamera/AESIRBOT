const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database');
const { generateBookPage } = require('./livre');
const { shopItems } = require('./crewboutique');

module.exports = {
    async handleInteraction(interaction) {
        try {
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'create_crew_modal') {
                    await handleCreateCrewModalSubmit(interaction);
                    return;
                }
            } else if (interaction.isButton() && interaction.customId === 'crew_create_menu') {
                await handleShowCreateCrewModal(interaction);
                return;
            } else {
                await interaction.deferUpdate({ ephemeral: true });
            }

            if (interaction.isStringSelectMenu() && interaction.customId === 'crew_shop_select') {
                const itemId = interaction.values[0];
                await handleShopPurchase(interaction, itemId);
            } else if (interaction.isButton() && interaction.customId === 'crew_notifications') {
                await handleShowNotifications(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('book_')) {
                await handleBookNavigation(interaction);
            } else if (interaction.isButton() && (interaction.customId.startsWith('invite_accept_') || interaction.customId.startsWith('invite_reject_'))) {
                await handleInviteResponse(interaction);
            }

        } catch (error) {
            console.error('❌ ERREUR dans crew/index.js:', error);
            await interaction.followUp({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => {});
        }
    }
};

async function handleShowCreateCrewModal(interaction) {
    const modal = new ModalBuilder().setCustomId('create_crew_modal').setTitle('Créer ton Clan');
    const nameInput = new TextInputBuilder().setCustomId('crewNameInput').setLabel('Nom du Clan').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20);
    const emojiInput = new TextInputBuilder().setCustomId('crewEmojiInput').setLabel('Émoji du Clan').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(5);
    const descriptionInput = new TextInputBuilder().setCustomId('crewDescriptionInput').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(200);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(emojiInput),
        new ActionRowBuilder().addComponents(descriptionInput)
    );
    await interaction.showModal(modal);
}

async function handleCreateCrewModalSubmit(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.fields.getTextInputValue('crewNameInput');
    const emoji = interaction.fields.getTextInputValue('crewEmojiInput') || '⚔️';
    const description = interaction.fields.getTextInputValue('crewDescriptionInput');
    const COST = 1500;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [userRows] = await connection.execute('SELECT balance, crewId FROM User WHERE id = ? FOR UPDATE', [interaction.user.id]);
        const user = userRows[0];

        if (user?.crewId) {
            await connection.rollback();
            return interaction.editReply({ content: '❌ Tu es déjà dans un clan !' });
        }
        if ((user?.balance || 0) < COST) {
            await connection.rollback();
            return interaction.editReply({ content: `❌ Tu n'as pas assez d'argent (${COST}€ requis).` });
        }

        const [crewExists] = await db.execute('SELECT id FROM Crew WHERE name = ?', [name]);
        if (crewExists.length > 0) {
            await connection.rollback();
            return interaction.editReply({ content: `❌ Le nom **${name}** est déjà pris.` });
        }

        const crewId = require('crypto').randomBytes(8).toString('hex');
        await connection.execute(
            'INSERT INTO Crew (id, name, emoji, description, ownerId) VALUES (?, ?, ?, ?, ?)',
            [crewId, name, emoji, description, interaction.user.id]
        );

        await connection.execute(
            'UPDATE User SET balance = balance - ?, crewId = ?, crewRole = \'CAPTAIN\' WHERE id = ?',
            [COST, crewId, interaction.user.id]
        );

        await connection.commit();
        await interaction.editReply({ content: `✅ Clan **${name}** créé avec succès !` });
    } catch (e) {
        await connection.rollback();
        console.error(e);
        await interaction.editReply({ content: '❌ Erreur lors de la création.' });
    } finally {
        connection.release();
    }
}

async function handleShopPurchase(interaction, itemId) {
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return interaction.editReply({ content: "❌ Article non trouvé." });

    const isEuro = item.currency === 'euros' || !item.currency;
    const currencyField = isEuro ? 'balance' : 'diamants';

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [userRows] = await connection.execute(`SELECT *, ${currencyField} as budget FROM User WHERE id = ? FOR UPDATE`, [interaction.user.id]);
        const user = userRows[0];

        if (!user || !user.crewId) {
            await connection.rollback();
            return interaction.editReply({ content: "❌ Tu dois être dans un clan." });
        }
        if (user.budget < item.price) {
            await connection.rollback();
            return interaction.editReply({ content: "❌ Solde insuffisant." });
        }

        await connection.execute(`UPDATE User SET ${currencyField} = ${currencyField} - ?, notoriety = notoriety + ? WHERE id = ?`, [item.price, item.givesNotoriety || 0, user.id]);

        if (item.givesDiamants) {
            await connection.execute('UPDATE Crew SET diamants = diamants + ? WHERE id = ?', [item.givesDiamants, user.crewId]);
        }

        let msg = `✅ Achat de **${item.name}** réussi !`;
        if (item.type === 'boost_don') {
            const expiry = new Date(Date.now() + item.durationHours * 3600000);
            await connection.execute('UPDATE User SET donationBoostExpiresAt = ?, donationBoostValue = ? WHERE id = ?', [expiry, item.donationBonus, user.id]);
            msg += `\n🚀 Boost actif jusqu'au <t:${Math.floor(expiry/1000)}:f>`;
        }

        await connection.commit();
        await interaction.editReply({ content: msg, components: [] });
    } catch (e) {
        await connection.rollback();
        console.error(e);
        await interaction.editReply({ content: "❌ Erreur lors de l'achat." });
    } finally {
        connection.release();
    }
}

async function handleShowNotifications(interaction) {
    const [invites] = await db.execute(`
        SELECT ci.id, c.name as crewName
        FROM CrewInvite ci
        JOIN Crew c ON ci.crewId = c.id
        WHERE ci.recipientId = ? AND ci.status = 'PENDING'
    `, [interaction.user.id]);

    if (invites.length === 0) return interaction.editReply({ content: "Pas d'invitations en attente.", components: [] });

    const embed = new EmbedBuilder().setTitle("Vos Invitations").setColor("Blue");
    const rows = invites.map(inv => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`invite_accept_${inv.id}`).setLabel(`Accepter ${inv.crewName}`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`invite_reject_${inv.id}`).setLabel(`Refuser`).setStyle(ButtonStyle.Danger)
        );
    });

    await interaction.editReply({ embeds: [embed], components: rows });
}

async function handleInviteResponse(interaction) {
    const [,, action, inviteId] = interaction.customId.split('_');
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [invRows] = await db.execute('SELECT * FROM CrewInvite WHERE id = ? FOR UPDATE', [inviteId]);
        const invite = invRows[0];

        if (!invite || invite.status !== 'PENDING') {
            await connection.rollback();
            return interaction.editReply({ content: "Invitation invalide.", components: [] });
        }

        if (action === 'accept') {
            await connection.execute('UPDATE User SET crewId = ?, crewRole = \'MEMBER\' WHERE id = ?', [invite.crewId, interaction.user.id]);
            await connection.execute('UPDATE CrewInvite SET status = \'ACCEPTED\' WHERE id = ?', [inviteId]);
            await interaction.editReply({ content: "✅ Bienvenue dans le clan !", components: [] });
        } else {
            await connection.execute('UPDATE CrewInvite SET status = \'REJECTED\' WHERE id = ?', [inviteId]);
            await interaction.editReply({ content: "❌ Invitation refusée.", components: [] });
        }
        await connection.commit();
    } catch (e) {
        await connection.rollback();
        console.error(e);
    } finally {
        connection.release();
    }
}

async function handleBookNavigation(interaction) {
    const [,, action, currentIndex] = interaction.customId.split('_');
    let nextIndex = parseInt(currentIndex) + (action === 'next' ? 1 : -1);
    const { embed, attachment, totalPages } = await generateBookPage(interaction.user.id, nextIndex);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`book_prev_${nextIndex}`).setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(nextIndex === 0),
        new ButtonBuilder().setCustomId(`book_next_${nextIndex}`).setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled(nextIndex >= totalPages - 1)
    );

    await interaction.editReply({ embeds: [embed], components: [row], files: attachment ? [attachment] : [] });
}