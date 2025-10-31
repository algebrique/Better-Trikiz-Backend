const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const functions = require("../../../structs/functions.js");
const config = require("../../../Config/config.json");
const log = require("../../../structs/log.js");

module.exports = {
    commandInfo: {
        name: "kick",
        description: "Kick someone out of their current session by their username.",
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
    
        const username = (interaction.options.getString("username") || "").trim();
        if (!username) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Input")
                .setDescription("Please provide a valid username.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const targetUser = await User.findOne({ username_lower: username.toLowerCase() });
    
        if (!targetUser) {
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("User Not Found")
                .setDescription(`No account found with username **${username}**.`);
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        let refreshRemoved = 0;
        let accessRemoved = 0;
        let xmppClosed = false;

        if (Array.isArray(global.refreshTokens)) {
            const refreshIndex = global.refreshTokens.findIndex(i => i.accountId == targetUser.accountId);
            if (refreshIndex !== -1) {
                global.refreshTokens.splice(refreshIndex, 1);
                refreshRemoved = 1;
            }
        }

        if (Array.isArray(global.accessTokens)) {
            const accessIndex = global.accessTokens.findIndex(i => i.accountId == targetUser.accountId);
            if (accessIndex !== -1) {
                global.accessTokens.splice(accessIndex, 1);
                accessRemoved = 1;

                if (Array.isArray(global.Clients)) {
                    const xmppClient = global.Clients.find(client => client.accountId == targetUser.accountId);
                    if (xmppClient && xmppClient.client) {
                        try {
                            xmppClient.client.close();
                            xmppClosed = true;
                        } catch (e) {
                            log.error("Error closing XMPP client:", e);
                        }
                    }
                }
            }
        }

        if (accessRemoved > 0 || refreshRemoved > 0) {
            try {
                if (typeof functions.UpdateTokens === "function") {
                    await functions.UpdateTokens();
                }
            } catch (e) {
                log.error("Error updating tokens:", e);
            }

            const embed = new MessageEmbed()
                .setColor("#FF9500")
                .setTitle("User Kicked")
                .setDescription(`Successfully kicked **${targetUser.username}** from their active session.`)
                .addFields(
                    { name: "Username", value: targetUser.username, inline: true },
                    { name: "Account ID", value: `\`${targetUser.accountId}\``, inline: true },
                    { name: "Tokens Revoked", value: `${refreshRemoved + accessRemoved}`, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();

            log.backend(`User kicked: ${targetUser.username} by ${interaction.user.tag}`);
            
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
        
        const embed = new MessageEmbed()
            .setColor("#FFD166")
            .setTitle("No Active Sessions")
            .setDescription(`**${targetUser.username}** has no active sessions to kick.`)
            .addFields(
                { name: "Username", value: targetUser.username, inline: true },
                { name: "Account ID", value: `\`${targetUser.accountId}\``, inline: true }
            )
            .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed], ephemeral: true });
    }
}