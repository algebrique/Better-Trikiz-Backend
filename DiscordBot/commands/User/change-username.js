const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const Badwords = require("bad-words");
const functions = require("../../../structs/functions.js");

const badwords = new Badwords();

module.exports = {
    commandInfo: {
        name: "change-username",
        description: "Change your username.",
        options: [
            {
                name: "username",
                description: "Your new username.",
                required: true,
                type: 3
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            if (!user) return interaction.editReply({ content: "You are not registered!", ephemeral: true });

            const username = (interaction.options.getString('username') || "").trim();
            if (!username) return interaction.editReply({ content: "No username provided.", ephemeral: true });

            if (badwords.isProfane(username)) return interaction.editReply({ content: "Invalid username. Username must not contain inappropriate language.", ephemeral: true });

            if (username.length >= 25) return interaction.editReply({ content: "Your username must be less than 25 characters long.", ephemeral: true });
            if (username.length < 3) return interaction.editReply({ content: "Your username must be at least 3 characters long.", ephemeral: true });

            const existingUser = await User.findOne({ username: username });
            if (existingUser && existingUser.discordId !== user.discordId) return interaction.editReply({ content: "Username already exists. Please choose a different one.", ephemeral: true });

            const COOLDOWN_MS = 24 * 60 * 60 * 1000;
            if (user.lastUsernameChange && (Date.now() - new Date(user.lastUsernameChange).getTime()) < COOLDOWN_MS) {
                const remaining = COOLDOWN_MS - (Date.now() - new Date(user.lastUsernameChange).getTime());
                const hours = Math.ceil(remaining / (60 * 60 * 1000));
                return interaction.editReply({ content: `You can change your username again in ${hours} hour(s).`, ephemeral: true });
            }

            const prevUsername = user.username;

            await user.updateOne({
                $set: {
                    username: username,
                    username_lower: username.toLowerCase(),
                    lastUsernameChange: new Date()
                },
                $addToSet: {
                    usernameHistory: prevUsername
                }
            });

            if (Array.isArray(global.refreshTokens)) {
                const idx = global.refreshTokens.findIndex(i => i.accountId == user.accountId);
                if (idx !== -1) global.refreshTokens.splice(idx, 1);
            }

            if (Array.isArray(global.accessTokens)) {
                const idx2 = global.accessTokens.findIndex(i => i.accountId == user.accountId);
                if (idx2 !== -1) {
                    global.accessTokens.splice(idx2, 1);
                    const xmppClient = Array.isArray(global.Clients) ? global.Clients.find(c => c.accountId == user.accountId) : null;
                    if (xmppClient && xmppClient.client) {
                        try { xmppClient.client.close(); } catch (e) { }
                    }
                }
            }

            if (typeof functions.UpdateTokens === "function") {
                try { await functions.UpdateTokens(); } catch (e) { }
            }

            const embed = new MessageEmbed()
                .setColor("#00A3C4")
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTitle("✅ Username Updated")
                .setDescription("Your account username has been successfully updated on Better Trikiz Backend.")
                .addFields(
                    { name: "👤 Account ID", value: `\`${user.accountId || "Unknown"}\``, inline: true },
                    { name: "🔁 Previous Username", value: prevUsername || "Unknown", inline: true },
                    { name: "🆕 New Username", value: username, inline: true },
                    { name: "⏱ Cooldown", value: "24 hours", inline: true },
                    { name: "📚 History", value: (Array.isArray(user.usernameHistory) && user.usernameHistory.length) ? user.usernameHistory.slice(-5).reverse().join("\n") : "No previous usernames", inline: false }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.editReply({ content: "An error occurred while changing your username. Please try again later.", ephemeral: true });
        }
    }
};