const { MessageEmbed } = require("discord.js");
const fs = require("fs");
const path = require("path");
const Users = require('../../../model/user.js');
const Profiles = require('../../../model/profiles.js');
const SACCodes = require('../../../model/saccodes.js');
const Friends = require('../../../model/friends.js');
const log = require("../../../structs/log.js");
const config = require('../../../Config/config.json');

module.exports = {
    commandInfo: {
        name: "delete",
        description: "Deletes a user's account",
        options: [
            {
                name: "username",
                description: "Target username.",
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

        const username = (interaction.options.getString('username') || "").trim();
        if (!username) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Input")
                .setDescription("Please provide a valid username.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const deleteAccount = await Users.findOne({ username: username });
        if (!deleteAccount) {
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Account Not Found")
                .setDescription(`No account found with username **${username}**.`);
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const accountId = deleteAccount.accountId;
        const discordId = deleteAccount.discordId;
        const deletionResults = {
            user: false,
            profile: false,
            friends: false,
            sac: false,
            settings: false
        };

        try {
            const userResult = await Users.deleteOne({ username: username });
            deletionResults.user = userResult.deletedCount > 0;
        } catch (error) {
            log.error('Error deleting from Users:', error);
        }

        try {
            const profileResult = await Profiles.deleteOne({ accountId: accountId });
            deletionResults.profile = profileResult.deletedCount > 0;
        } catch (error) {
            log.error('Error deleting from Profiles:', error);
        }

        try {
            const friendsResult = await Friends.deleteOne({ accountId: accountId });
            deletionResults.friends = friendsResult.deletedCount > 0;
        } catch (error) {
            log.error('Error deleting from Friends:', error);
        }

        try {
            const sacResult = await SACCodes.deleteOne({ owneraccountId: accountId });
            deletionResults.sac = sacResult.deletedCount > 0;
        } catch (error) {
            log.error('Error deleting from SACCodes:', error);
        }

        const clientSettingsPath = path.join(__dirname, '../../../ClientSettings', accountId);
        if (fs.existsSync(clientSettingsPath)) {
            try {
                fs.rmSync(clientSettingsPath, { recursive: true, force: true });
                deletionResults.settings = true;
            } catch (error) {
                log.error('Error deleting ClientSettings:', error);
            }
        }

        const somethingDeleted = Object.values(deletionResults).some(v => v === true);
        if (!somethingDeleted) {
            const embed = new MessageEmbed()
                .setColor("#FFD166")
                .setTitle("No Data Deleted")
                .setDescription(`No data found to delete for **${username}**.`);
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const deletedItems = [];
        if (deletionResults.user) deletedItems.push("User account");
        if (deletionResults.profile) deletedItems.push("Profile data");
        if (deletionResults.friends) deletedItems.push("Friends list");
        if (deletionResults.sac) deletedItems.push("SAC codes");
        if (deletionResults.settings) deletedItems.push("Client settings");

        const embed = new MessageEmbed()
            .setTitle("Account Deleted")
            .setDescription(`Successfully deleted account for **${username}**`)
            .setColor("#E74C3C")
            .addFields(
                { name: "Username", value: username, inline: true },
                { name: "Account ID", value: `\`${accountId}\``, inline: true },
                { name: "Deleted Items", value: deletedItems.join("\n") || "None", inline: false }
            )
            .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });

        if (discordId) {
            try {
                const user = await interaction.client.users.fetch(discordId);
                if (user) {
                    const dmEmbed = new MessageEmbed()
                        .setColor("#E74C3C")
                        .setTitle("Account Deleted")
                        .setDescription(`Your Better Trikiz Backend account has been deleted by a moderator.`)
                        .addFields(
                            { name: "Deleted By", value: `${interaction.user.tag}`, inline: true },
                            { name: "Username", value: username, inline: true }
                        )
                        .setTimestamp();
                    await user.send({ embeds: [dmEmbed] });
                }
            } catch (error) {
                log.error('Could not send DM to deleted user:', error);
            }
        }
    }
};