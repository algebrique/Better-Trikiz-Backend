const { MessageEmbed } = require("discord.js");
const path = require("path");
const fs = require("fs");
const Users = require('../../../model/user.js');
const Profiles = require('../../../model/profiles.js');
const log = require("../../../structs/log.js");
const destr = require("destr");
const config = require('../../../Config/config.json');

module.exports = {
    commandInfo: {
        name: "addall",
        description: "Give a user all cosmetics (resets locker to default)",
        options: [
            {
                name: "user",
                description: "The user to give cosmetics to",
                required: true,
                type: 6
            }
        ]
    },
    execute: async (interaction) => {
        if (!config.moderators || !Array.isArray(config.moderators) || !config.moderators.includes(interaction.user.id)) {
            return interaction.reply({ content: "You do not have moderator permissions.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetDiscordUser = interaction.options.getUser('user');
        if (!targetDiscordUser) {
            return interaction.editReply({ content: "Invalid user specified.", ephemeral: true });
        }

        try {
            const targetUser = await Users.findOne({ discordId: targetDiscordUser.id }).lean();
            if (!targetUser) {
                return interaction.editReply({ content: "That user does not own an account.", ephemeral: true });
            }

            const profile = await Profiles.findOne({ accountId: targetUser.accountId }).lean();
            if (!profile) {
                return interaction.editReply({ content: "That user does not have a profile.", ephemeral: true });
            }

            const filePath = path.join(__dirname, "../../../Config/DefaultProfiles/allathena.json");
            if (!fs.existsSync(filePath)) {
                return interaction.editReply({ content: "allathena.json not found on disk.", ephemeral: true });
            }

            const fileRaw = fs.readFileSync(filePath, 'utf8');
            const allItems = destr(fileRaw);
            if (!allItems || !allItems.items) {
                return interaction.editReply({ content: "Failed to parse allathena.json or missing items.", ephemeral: true });
            }

            const updated = await Profiles.findOneAndUpdate(
                { accountId: targetUser.accountId },
                { $set: { "profiles.athena.items": allItems.items } },
                { new: true }
            ).lean();

            if (!updated) {
                return interaction.editReply({ content: "Failed to update the profile.", ephemeral: true });
            }

            const embed = new MessageEmbed()
                .setTitle("Full Locker Applied")
                .setDescription(`All cosmetics have been applied to **${targetDiscordUser.tag}**.`)
                .setColor("#00C2A8")
                .addFields(
                    { name: "Account ID", value: `\`${targetUser.accountId}\``, inline: true },
                    { name: "Result", value: "Locker successfully updated", inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            log.error("addall command error:", error);
            try { await interaction.editReply({ content: "An error occurred while processing the request.", ephemeral: true }); } catch (e) { }
        }
    }
};