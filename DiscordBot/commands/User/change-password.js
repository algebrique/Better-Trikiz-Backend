const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const bcrypt = require("bcrypt");
const functions = require("../../../structs/functions.js");

module.exports = {
    commandInfo: {
        name: "change-password",
        description: "Change your password.",
        options: [
            {
                name: "password",
                description: "Your new password.",
                required: true,
                type: 3
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            if (!user) return interaction.editReply({ content: "You do not have a registered account!", ephemeral: true });

            const plainPassword = (interaction.options.getString("password") || "").trim();

            const MAX_LEN = 128;
            const MIN_LEN = 8;
            const COOLDOWN_MS = 60 * 60 * 1000;

            if (!plainPassword) return interaction.editReply({ content: "No password provided.", ephemeral: true });
            if (plainPassword.length > MAX_LEN) return interaction.editReply({ content: `Your password must be less than ${MAX_LEN} characters long.`, ephemeral: true });
            if (plainPassword.length < MIN_LEN) return interaction.editReply({ content: `Your password must be at least ${MIN_LEN} characters long.`, ephemeral: true });

            const complexity = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
            if (!complexity.test(plainPassword)) {
                return interaction.editReply({ content: "Password must include at least one lowercase letter, one uppercase letter and one number.", ephemeral: true });
            }

            if (user.lastPasswordChange && (Date.now() - new Date(user.lastPasswordChange).getTime()) < COOLDOWN_MS) {
                const remaining = COOLDOWN_MS - (Date.now() - new Date(user.lastPasswordChange).getTime());
                const minutes = Math.ceil(remaining / (60 * 1000));
                return interaction.editReply({ content: `You can change your password again in ${minutes} minute(s).`, ephemeral: true });
            }

            const isSame = await bcrypt.compare(plainPassword, user.password);
            if (isSame) return interaction.editReply({ content: "New password cannot be the same as your current password.", ephemeral: true });

            const hashedPassword = await bcrypt.hash(plainPassword, 10);
            await user.updateOne({ $set: { password: hashedPassword, lastPasswordChange: new Date() } });

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
                .setTitle("✅ Password Updated")
                .setDescription("Your account password has been successfully updated.")
                .setColor("#2ECC71")
                .addFields(
                    { name: "👤 Account", value: `\`${user.accountId || "Unknown"}\``, inline: true },
                    { name: "🔒 Password Length", value: `${plainPassword.length} characters`, inline: true },
                    { name: "⏱ Cooldown", value: "1 hour", inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.editReply({ content: "An error occurred while changing your password. Please try again later.", ephemeral: true });
        }
    }
};
