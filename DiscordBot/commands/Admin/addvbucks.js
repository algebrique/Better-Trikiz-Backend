const Users = require('../../../model/user');
const Profiles = require('../../../model/profiles');
const config = require('../../../Config/config.json');
const uuid = require("uuid");
const { MessageEmbed } = require("discord.js");

module.exports = {
    commandInfo: {
        name: "addvbucks",
        description: "Lets you change a user's amount of V-Bucks",
        options: [
            {
                name: "user",
                description: "The user you want to change the V-Bucks of",
                required: true,
                type: 6
            },
            {
                name: "vbucks",
                description: "The amount of V-Bucks you want to give (Can be negative to deduct V-Bucks)",
                required: true,
                type: 4
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!Array.isArray(config.moderators) || !config.moderators.includes(interaction.user.id)) {
            return interaction.editReply({ content: "You do not have moderator permissions.", ephemeral: true });
        }

        const selectedUser = interaction.options.getUser('user');
        const vbucks = interaction.options.getInteger('vbucks');

        if (!selectedUser) {
            return interaction.editReply({ content: "Invalid user specified.", ephemeral: true });
        }

        if (typeof vbucks !== "number" || !Number.isInteger(vbucks) || vbucks === 0) {
            return interaction.editReply({ content: "Please provide a valid non-zero integer amount of V‑Bucks.", ephemeral: true });
        }

        try {
            const user = await Users.findOne({ discordId: selectedUser.id }).lean();
            if (!user) {
                return interaction.editReply({ content: "That user does not own an account.", ephemeral: true });
            }

            const profile = await Profiles.findOne({ accountId: user.accountId }).lean();
            if (!profile || !profile.profiles) {
                return interaction.editReply({ content: "That user does not have a profile.", ephemeral: true });
            }

            const commonCoreQty = Number(profile.profiles?.common_core?.items?.["Currency:MtxPurchased"]?.quantity || 0);
            const profile0Qty = Number(profile.profiles?.profile0?.items?.["Currency:MtxPurchased"]?.quantity || 0);

            const newCommon = commonCoreQty + vbucks;
            const newProfile0 = profile0Qty + vbucks;

            if (newCommon < 0 || newProfile0 < 0) {
                return interaction.editReply({ content: "Operation would result in negative V‑Bucks balance. Aborted.", ephemeral: true });
            }

            const MAX_BALANCE = 1000000;
            if (newCommon > MAX_BALANCE || newProfile0 > MAX_BALANCE) {
                return interaction.editReply({ content: "Resulting V‑Bucks balance would exceed allowed maximum.", ephemeral: true });
            }

            const purchaseId = uuid.v4();
            const lootList = [{
                itemType: "Currency:MtxGiveaway",
                itemGuid: "Currency:MtxGiveaway",
                quantity: Math.abs(vbucks)
            }];

            const giftBox = {
                templateId: "GiftBox:GB_MakeGood",
                attributes: {
                    fromAccountId: "[Administrator]",
                    lootList,
                    params: { userMessage: `Adjustment performed by ${interaction.user.username}` },
                    giftedOn: new Date().toISOString()
                },
                quantity: 1
            };

            const setObj = {};
            setObj[`profiles.common_core.items.${purchaseId}`] = giftBox;

            const update = {
                $inc: {
                    'profiles.common_core.items.Currency:MtxPurchased.quantity': vbucks,
                    'profiles.profile0.items.Currency:MtxPurchased.quantity': vbucks,
                    'profiles.common_core.rvn': 1,
                    'profiles.common_core.commandRevision': 1
                },
                $set: setObj
            };

            await Profiles.updateOne({ accountId: user.accountId }, update);

            const updatedProfile = await Profiles.findOne({ accountId: user.accountId }).lean();
            const updatedCommon = Number(updatedProfile.profiles?.common_core?.items?.["Currency:MtxPurchased"]?.quantity || 0);

            const embed = new MessageEmbed()
                .setTitle("V‑Bucks Updated")
                .setDescription(`${vbucks > 0 ? "Added" : "Removed"} **${Math.abs(vbucks).toLocaleString()} V‑Bucks** ${vbucks > 0 ? "to" : "from"} **${selectedUser.tag}**`)
                .setColor(vbucks > 0 ? "#2ECC71" : "#FF5555")
                .addFields(
                    { name: "New common balance", value: `${updatedCommon.toLocaleString()} V‑Bucks`, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });

            return {
                profileRevision: updatedProfile.profiles.common_core.rvn,
                profileCommandRevision: updatedProfile.profiles.common_core.commandRevision,
                profileChanges: [
                    { changeType: "itemQuantityChanged", itemId: "Currency:MtxPurchased", quantity: updatedCommon },
                    { changeType: "itemAdded", itemId: purchaseId, templateId: "GiftBox:GB_MakeGood" }
                ],
                newQuantityCommonCore: updatedCommon,
                newQuantityProfile0: Number(updatedProfile.profiles?.profile0?.items?.["Currency:MtxPurchased"]?.quantity || 0)
            };
        } catch (err) {
            try { console.error(err); } catch (e) {}
            const embed = new MessageEmbed()
                .setTitle("Error")
                .setDescription("An error occurred while updating V‑Bucks. Please try again later.")
                .setColor("#FF5555")
                .setFooter({ text: "Better Trikiz Backend" })
                .setTimestamp();
            try { await interaction.editReply({ embeds: [embed], ephemeral: true }); } catch (e) {}
        }
    }
};