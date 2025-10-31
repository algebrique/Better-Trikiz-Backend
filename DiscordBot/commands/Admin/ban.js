const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const functions = require("../../../structs/functions.js");
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

module.exports = {
    commandInfo: {
        name: "ban",
        description: "Ban a user from the backend by their username.",
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

        const mods = Array.isArray(config.moderators) ? config.moderators : [];
        if (!mods.includes(interaction.user.id)) {
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Permission Denied")
                .setDescription("You do not have moderator permissions.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        try {
            const usernameRaw = interaction.options.getString("username") || "";
            const usernameLower = usernameRaw.trim().toLowerCase();
            if (!usernameLower) {
                const embed = new MessageEmbed()
                    .setColor("#FFAA33")
                    .setTitle("Invalid Usage")
                    .setDescription("Please provide a valid username.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const targetUser = await User.findOne({ username_lower: usernameLower });
            if (!targetUser) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Not Found")
                    .setDescription("The account username you entered does not exist.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            if (targetUser.banned) {
                const embed = new MessageEmbed()
                    .setColor("#FFD166")
                    .setTitle("Already Banned")
                    .setDescription(`${targetUser.username} is already banned.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            await targetUser.updateOne({ $set: { banned: true } });

            let refreshRemoved = 0;
            if (Array.isArray(global.refreshTokens)) {
                const before = global.refreshTokens.length;
                global.refreshTokens = global.refreshTokens.filter(i => i.accountId != targetUser.accountId);
                refreshRemoved = before - global.refreshTokens.length;
            }

            let accessRemoved = 0;
            if (Array.isArray(global.accessTokens)) {
                const before = global.accessTokens.length;
                global.accessTokens = global.accessTokens.filter(i => i.accountId != targetUser.accountId);
                accessRemoved = before - global.accessTokens.length;
            }

            let xmppClosed = false;
            if (Array.isArray(global.Clients)) {
                const idx = global.Clients.findIndex(c => c.accountId == targetUser.accountId);
                if (idx !== -1) {
                    const client = global.Clients[idx];
                    try { if (client && client.client && typeof client.client.close === "function") client.client.close(); } catch (e) {}
                    global.Clients.splice(idx, 1);
                    xmppClosed = true;
                }
            }

            try { if (typeof functions.UpdateTokens === "function") await functions.UpdateTokens(); } catch (e) {}

            const embed = new MessageEmbed()
                .setColor("#E74C3C")
                .setTitle("User Banned")
                .setDescription(`Successfully banned **${targetUser.username}**`)
                .addFields(
                    { name: "Account ID", value: `\`${targetUser.accountId}\``, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            try { console.error(err); } catch(e) {}
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Error")
                .setDescription("An error occurred while attempting to ban the user.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
    }
}