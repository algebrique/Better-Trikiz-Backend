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
        name: "removeall",
        description: "Remove all cosmetics from a user (resets locker to default)",
        options: [
            {
                name: "user",
                description: "The user to remove cosmetics from",
                required: true,
                type: 6
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
        if (!selectedUser) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Input")
                .setDescription("Please provide a valid Discord user.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        try {
            const targetUser = await Users.findOne({ discordId: selectedUser.id }).lean();
            if (!targetUser) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Account Not Found")
                    .setDescription(`**${selectedUser.tag}** does not own an account.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const profile = await Profiles.findOne({ accountId: targetUser.accountId }).lean();
            if (!profile) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Profile Not Found")
                    .setDescription("That user does not have a profile.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const filePath = path.join(__dirname, "../../../Config/DefaultProfiles/athena.json");
            if (!fs.existsSync(filePath)) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("File Not Found")
                    .setDescription("athena.json not found on disk.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const fileRaw = fs.readFileSync(filePath, 'utf8');
            const defaultItems = destr(fileRaw);
            
            if (!defaultItems || !defaultItems.items) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Parse Error")
                    .setDescription("Failed to parse athena.json or missing items.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const updated = await Profiles.findOneAndUpdate(
                { accountId: targetUser.accountId },
                { $set: { "profiles.athena.items": defaultItems.items } },
                { new: true }
            ).lean();

            if (!updated) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Update Failed")
                    .setDescription("Failed to update the profile.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const embed = new MessageEmbed()
                .setTitle("Locker Reset")
                .setDescription(`Successfully reset locker for **${selectedUser.tag}** to default cosmetics.`)
                .setColor("#FF9500")
                .addFields(
                    { name: "User", value: selectedUser.tag, inline: true },
                    { name: "Account ID", value: `\`${targetUser.accountId}\``, inline: true },
                    { name: "Result", value: "Locker reset to default", inline: true }
                )
                .setThumbnail(selectedUser.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();

            log.backend(`Locker reset for ${targetUser.username} by ${interaction.user.tag}`);

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            log.error("Error in removeall command:", error);
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Error")
                .setDescription("An error occurred while processing the request.");
            try {
                await interaction.editReply({ embeds: [embed], ephemeral: true });
            } catch (e) {}
        }
    }
};