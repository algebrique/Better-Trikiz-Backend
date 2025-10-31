const { MessageEmbed } = require("discord.js");
const Users = require('../../../model/user.js');
const Profiles = require('../../../model/profiles.js');
const fs = require('fs');
const path = require('path');
const destr = require('destr');
const log = require("../../../structs/log.js");
const config = require('../../../Config/config.json');
const axios = require('axios');

module.exports = {
    commandInfo: {
        name: "removeitem",
        description: "Remove a cosmetic from a user",
        options: [
            {
                name: "user",
                description: "The user to remove the cosmetic from",
                required: true,
                type: 6
            },
            {
                name: "cosmeticname",
                description: "The name of the cosmetic to remove",
                required: true,
                type: 3
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!Array.isArray(config.moderators) || !config.moderators.includes(interaction.user.id)) {
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Permission Denied")
                .setDescription("You do not have moderator permissions.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const selectedUser = interaction.options.getUser('user');
        const cosmeticname = (interaction.options.getString('cosmeticname') || "").trim();

        if (!selectedUser) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Input")
                .setDescription("Please provide a valid Discord user.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        if (!cosmeticname) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Input")
                .setDescription("Please provide a cosmetic name.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        try {
            const user = await Users.findOne({ discordId: selectedUser.id });
            if (!user) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Account Not Found")
                    .setDescription(`**${selectedUser.tag}** does not own an account.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const profile = await Profiles.findOne({ accountId: user.accountId });
            if (!profile) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Profile Not Found")
                    .setDescription("That user does not have a profile.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const apiRes = await axios.get(`https://fortnite-api.com/v2/cosmetics/br/search`, { params: { name: cosmeticname } });
            const cosmeticFromAPI = apiRes?.data?.data;

            if (!cosmeticFromAPI) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Cosmetic Not Found")
                    .setDescription(`Could not find cosmetic **${cosmeticname}** on the API.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const filePath = path.join(__dirname, "../../../Config/DefaultProfiles/allathena.json");
            if (!fs.existsSync(filePath)) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("File Not Found")
                    .setDescription("allathena.json not found on disk.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const fileRaw = fs.readFileSync(filePath, 'utf8');
            const jsonFile = destr(fileRaw);
            const items = jsonFile.items || {};

            let foundKey = null;
            for (const key of Object.keys(items)) {
                const parts = key.split(":");
                const id = parts[1];
                if (id === cosmeticFromAPI.id) {
                    foundKey = key;
                    break;
                }
            }

            if (!foundKey) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Cosmetic Not Found")
                    .setDescription(`Could not find **${cosmeticFromAPI.name}** in the default profiles.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            if (!profile.profiles?.athena?.items?.[foundKey]) {
                const embed = new MessageEmbed()
                    .setColor("#FFD166")
                    .setTitle("Cosmetic Not Owned")
                    .setDescription(`**${selectedUser.tag}** does not own **${cosmeticFromAPI.name}**.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const update = { $unset: {} };
            update.$unset[`profiles.athena.items.${foundKey}`] = "";

            const updated = await Profiles.findOneAndUpdate(
                { accountId: user.accountId },
                update,
                { new: true }
            );

            if (!updated) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Update Failed")
                    .setDescription("An error occurred while removing the cosmetic.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const embed = new MessageEmbed()
                .setTitle("Cosmetic Removed")
                .setDescription(`Successfully removed **${cosmeticFromAPI.name}** from **${selectedUser.tag}**`)
                .setThumbnail(cosmeticFromAPI.images?.icon || null)
                .setColor("#FF5555")
                .addFields(
                    { name: "User", value: selectedUser.tag, inline: true },
                    { name: "Account ID", value: `\`${user.accountId}\``, inline: true },
                    { name: "Cosmetic", value: cosmeticFromAPI.name, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();

            log.backend(`Cosmetic removed: ${cosmeticFromAPI.name} from ${user.username} by ${interaction.user.tag}`);

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            log.error("Error in removeitem command:", err);
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Error")
                .setDescription("An error occurred while removing the cosmetic. Please try again later.");
            try {
                await interaction.editReply({ embeds: [embed], ephemeral: true });
            } catch (e) {}
        }
    }
};