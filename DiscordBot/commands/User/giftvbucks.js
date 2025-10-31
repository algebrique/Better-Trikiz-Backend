const { MessageEmbed } = require("discord.js");
const Users = require("../../../model/user.js");
const Profiles = require("../../../model/profiles.js");
const log = require("../../../structs/log.js");
const uuid = require("uuid");

const cooldowns = new Map();

module.exports = {
    commandInfo: {
        name: "giftvbucks",
        description: "Send another user your V-Bucks",
        options: [
            {
                name: 'user',
                type: 6,
                description: 'The user you want to gift V-Bucks to',
                required: true,
            },
            {
                name: 'vbucks',
                type: 3,
                description: 'The amount of V-Bucks you want to gift',
                required: true,
            },
        ],
    },

    async execute(interaction) {
        const senderDiscordId = interaction.user.id;
        const receiverUser = interaction.options.getUser("user");
        const rawAmount = interaction.options.getString("vbucks");

        try {
            const cooldownKey = senderDiscordId;
            const now = Date.now();
            const COOLDOWN_MS = 30 * 1000;

            if (cooldowns.has(cooldownKey)) {
                const last = cooldowns.get(cooldownKey);
                const diff = now - last;
                if (diff < COOLDOWN_MS) {
                    const left = ((COOLDOWN_MS - diff) / 1000).toFixed(1);
                    return interaction.reply({ content: `You're sending gifts too quickly. Wait ${left}s.`, ephemeral: true });
                }
            }

            await interaction.deferReply({ ephemeral: true });

            if (!receiverUser) {
                return interaction.editReply({ content: "Invalid recipient.", ephemeral: true });
            }

            const sender = await Users.findOne({ discordId: senderDiscordId });
            const receiver = await Users.findOne({ discordId: receiverUser.id });

            if (!sender) return interaction.editReply({ content: "You do not have an account.", ephemeral: true });
            if (!receiver) return interaction.editReply({ content: "Recipient does not have an account.", ephemeral: true });
            if (receiver.id === sender.id) return interaction.editReply({ content: "You cannot gift yourself.", ephemeral: true });

            const amount = parseInt(rawAmount, 10);
            if (Number.isNaN(amount) || amount <= 0) return interaction.editReply({ content: "Please provide a valid positive number of V‑Bucks to gift.", ephemeral: true });

            const senderProfile = await Profiles.findOne({ accountId: sender.accountId }).lean();
            const receiverProfile = await Profiles.findOne({ accountId: receiver.accountId }).lean();

            if (!senderProfile || !receiverProfile) return interaction.editReply({ content: "Profile error. Try again later.", ephemeral: true });

            const senderCommonQty = senderProfile.profiles?.common_core?.items?.['Currency:MtxPurchased']?.quantity ?? 0;
            const senderProfile0Qty = senderProfile.profiles?.profile0?.items?.['Currency:MtxPurchased']?.quantity ?? 0;

            if (senderCommonQty + senderProfile0Qty < amount) return interaction.editReply({ content: "You do not have enough V‑Bucks.", ephemeral: true });

            const purchaseId = uuid.v4();
            const lootList = [{
                "itemType": "Currency:MtxGiveaway",
                "itemGuid": "Currency:MtxGiveaway",
                "quantity": amount
            }];

            const giftBox = {
                templateId: `GiftBox:GB_MakeGood`,
                attributes: {
                    fromAccountId: sender.accountId,
                    lootList,
                    params: { userMessage: `You received a gift from ${sender.username || "Unknown"}!` },
                    giftedOn: new Date().toISOString()
                },
                quantity: 1
            };

            const senderUpdates = {
                $inc: {
                    'profiles.common_core.items.Currency:MtxPurchased.quantity': -amount,
                    'profiles.profile0.items.Currency:MtxPurchased.quantity': -amount,
                    'profiles.common_core.rvn': 1,
                    'profiles.common_core.commandRevision': 1
                }
            };

            const receiverUpdates = {
                $inc: {
                    'profiles.common_core.items.Currency:MtxPurchased.quantity': amount,
                    'profiles.profile0.items.Currency:MtxPurchased.quantity': amount,
                    'profiles.common_core.rvn': 1,
                    'profiles.common_core.commandRevision': 1
                },
                $set: {}
            };
            receiverUpdates.$set[`profiles.common_core.items.${purchaseId}`] = giftBox;

            await Promise.all([
                Profiles.updateOne({ accountId: sender.accountId }, senderUpdates),
                Profiles.updateOne({ accountId: receiver.accountId }, receiverUpdates)
            ]);

            const updatedSenderProfile = await Profiles.findOne({ accountId: sender.accountId }).lean();
            const updatedReceiverProfile = await Profiles.findOne({ accountId: receiver.accountId }).lean();

            const newSenderQty = updatedSenderProfile.profiles?.common_core?.items?.['Currency:MtxPurchased']?.quantity ?? 0;
            const newReceiverQty = updatedReceiverProfile.profiles?.common_core?.items?.['Currency:MtxPurchased']?.quantity ?? 0;

            const embed = new MessageEmbed()
                .setTitle("V‑Bucks Gift Sent")
                .setDescription(`You gifted **${amount.toLocaleString()} V‑Bucks** to **${receiver.username}**`)
                .addFields(
                    { name: "Amount", value: `${amount.toLocaleString()} V‑Bucks`, inline: true },
                    { name: "Your new balance", value: `${newSenderQty.toLocaleString()} V‑Bucks`, inline: true }
                )
                .setColor("#00C2A8")
                .setThumbnail("https://i.imgur.com/yLbihQa.png")
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });

            cooldowns.set(cooldownKey, now);

            return {
                profileRevision: updatedReceiverProfile.profiles?.common_core?.rvn ?? 0,
                profileCommandRevision: updatedReceiverProfile.profiles?.common_core?.commandRevision ?? 0,
                profileChanges: [
                    { changeType: "itemQuantityChanged", itemId: "Currency:MtxPurchased", quantity: newReceiverQty },
                    { changeType: "itemAdded", itemId: purchaseId, templateId: "GiftBox:GB_MakeGood" }
                ],
                newQuantityCommonCore: newReceiverQty,
                newQuantityProfile0: updatedReceiverProfile.profiles?.profile0?.items?.['Currency:MtxPurchased']?.quantity ?? 0
            };
        } catch (error) {
            log.error(error);
            try { await interaction.editReply({ content: "An error occurred while sending the gift. Try again later.", ephemeral: true }); } catch (e) { }
        }
    },
};