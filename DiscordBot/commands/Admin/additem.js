const Users = require('../../../model/user.js');
const Profiles = require('../../../model/profiles.js');
const fs = require('fs');
const path = require('path');
const destr = require('destr');
const config = require('../../../Config/config.json');
const uuid = require("uuid");
const log = require("../../../structs/log.js");
const { MessageEmbed } = require('discord.js');
const axios = require('axios');

module.exports = {
    commandInfo: {
        name: "additem",
        description: "Give a user any cosmetic",
        options: [
            { name: "user", description: "The user to give the cosmetic to", required: true, type: 6 },
            { name: "cosmeticname", description: "Name of the cosmetic", required: true, type: 3 }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!Array.isArray(config.moderators) || !config.moderators.includes(interaction.user.id)) {
            return interaction.editReply({ content: "You do not have moderator permissions.", ephemeral: true });
        }

        const selectedUser = interaction.options.getUser('user');
        const cosmeticname = (interaction.options.getString('cosmeticname') || "").trim();
        if (!selectedUser || !cosmeticname) {
            return interaction.editReply({ content: "Invalid arguments.", ephemeral: true });
        }

        try {
            const user = await Users.findOne({ discordId: selectedUser.id });
            if (!user) return interaction.editReply({ content: "That user does not own an account.", ephemeral: true });

            const profile = await Profiles.findOne({ accountId: user.accountId });
            if (!profile) return interaction.editReply({ content: "That user does not have a profile.", ephemeral: true });

            const apiRes = await axios.get(`https://fortnite-api.com/v2/cosmetics/br/search`, { params: { name: cosmeticname } });
            const cosmeticFromAPI = apiRes?.data?.data;
            if (!cosmeticFromAPI) return interaction.editReply({ content: "Could not find the cosmetic on the API.", ephemeral: true });

            const filePath = path.join(__dirname, "../../../Config/DefaultProfiles/allathena.json");
            if (!fs.existsSync(filePath)) return interaction.editReply({ content: "allathena.json not found on disk.", ephemeral: true });

            const fileRaw = fs.readFileSync(filePath, 'utf8');
            const jsonFile = destr(fileRaw);
            const items = jsonFile.items || {};

            let foundKey = null;
            let cosmeticTemplate = null;
            for (const key of Object.keys(items)) {
                const parts = key.split(":");
                const id = parts[1];
                if (id === cosmeticFromAPI.id) {
                    foundKey = key;
                    cosmeticTemplate = items[key];
                    break;
                }
            }

            if (!foundKey || !cosmeticTemplate) {
                return interaction.editReply({ content: `Could not find the cosmetic "${cosmeticname}" in the default profiles.`, ephemeral: true });
            }

            if (profile.profiles?.athena?.items && profile.profiles.athena.items[foundKey]) {
                return interaction.editReply({ content: "That user already has that cosmetic.", ephemeral: true });
            }

            const purchaseId = uuid.v4();
            const lootList = [{ itemType: cosmeticTemplate.templateId, itemGuid: cosmeticTemplate.templateId, quantity: 1 }];

            const common_core = profile.profiles.common_core || {};
            const athena = profile.profiles.athena || {};

            if (!common_core.items) common_core.items = {};
            if (!athena.items) athena.items = {};

            common_core.items[purchaseId] = {
                templateId: "GiftBox:GB_MakeGood",
                attributes: {
                    fromAccountId: `[${interaction.user.username}]`,
                    lootList,
                    params: { userMessage: `You received a gift from ${interaction.user.username}` },
                    giftedOn: new Date().toISOString()
                },
                quantity: 1
            };

            athena.items[foundKey] = cosmeticTemplate;

            common_core.rvn = (common_core.rvn || 0) + 1;
            common_core.commandRevision = (common_core.commandRevision || 0) + 1;
            common_core.updated = new Date().toISOString();

            athena.rvn = (athena.rvn || 0) + 1;
            athena.commandRevision = (athena.commandRevision || 0) + 1;
            athena.updated = new Date().toISOString();

            await Profiles.updateOne(
                { accountId: user.accountId },
                { $set: { 'profiles.common_core': common_core, 'profiles.athena': athena } }
            );

            const embed = new MessageEmbed()
                .setTitle("Cosmetic Delivered")
                .setDescription(`Gave **${cosmeticFromAPI.name}** to **${selectedUser.tag}**`)
                .setThumbnail(cosmeticFromAPI.images?.icon || null)
                .setColor("GREEN")
                .addFields(
                    { name: "User", value: selectedUser.tag, inline: true },
                    { name: "Account ID", value: `\`${user.accountId}\``, inline: true },
                    { name: "Cosmetic", value: cosmeticFromAPI.name, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });

            return {
                profileRevision: common_core.rvn,
                profileCommandRevision: common_core.commandRevision,
                profileChanges: [
                    { changeType: "itemAdded", itemId: foundKey, templateId: cosmeticTemplate.templateId },
                    { changeType: "itemAdded", itemId: purchaseId, templateId: "GiftBox:GB_MakeGood" }
                ]
            };
        } catch (err) {
            log.error(err);
            try { await interaction.editReply({ content: "An unexpected error occurred.", ephemeral: true }); } catch (e) {}
        }
    }
};
