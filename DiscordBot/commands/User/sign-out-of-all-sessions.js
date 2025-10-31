const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const functions = require("../../../structs/functions.js");

module.exports = {
    commandInfo: {
        name: "sign-out-of-all-sessions",
        description: "Signs you out if you have an active session."
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const targetUser = await User.findOne({ discordId: interaction.user.id }).lean();
            if (!targetUser) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("No Account Found")
                    .setDescription("You do not have a registered account.")
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

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
                const clientIndex = global.Clients.findIndex(c => c.accountId == targetUser.accountId);
                if (clientIndex !== -1) {
                    const xmppClient = global.Clients[clientIndex];
                    try {
                        if (xmppClient && xmppClient.client && typeof xmppClient.client.close === "function") {
                            xmppClient.client.close();
                        }
                    } catch (e) { }
                    global.Clients.splice(clientIndex, 1);
                    xmppClosed = true;
                }
            }

            if ((refreshRemoved > 0) || (accessRemoved > 0) || xmppClosed) {
                try { if (typeof functions.UpdateTokens === "function") await functions.UpdateTokens(); } catch (e) { }

                const embed = new MessageEmbed()
                    .setColor("#00C2A8")
                    .setTitle("Signed Out")
                    .setDescription("All active sessions linked to your account have been signed out.")
                    .setFooter({ text: "Better Trikiz Backend" })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed], ephemeral: true });
            } else {
                const embed = new MessageEmbed()
                    .setColor("#FFD166")
                    .setTitle("No Active Sessions")
                    .setDescription("No active sessions were found for your account.")
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }
        } catch (err) {
            try { if (typeof console !== "undefined") console.error(err); } catch (e) { }
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Error")
                .setDescription("An error occurred while signing out of sessions. Please try again later.")
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
    }
};