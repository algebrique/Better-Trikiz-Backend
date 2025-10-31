const { MessageEmbed } = require("discord.js");
const Users = require('../../../model/user.js');
const functions = require("../../../structs/functions.js");

function maskEmail(email) {
    if (!email) return "Unknown";
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const visible = Math.max(1, Math.min(3, local.length));
    return `${local.slice(0, visible)}${"*".repeat(Math.max(3, local.length - visible))}@${domain}`;
}

module.exports = {
    commandInfo: {
        name: "change-email",
        description: "Allows you to change your email",
        options: [
            {
                name: "email",
                description: "Your desired email.",
                required: true,
                type: 3
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const user = await Users.findOne({ discordId: interaction.user.id });
            if (!user) {
                return interaction.editReply({ content: "You are not registered!", ephemeral: true });
            }

            const plainEmail = (interaction.options.getString('email') || "").trim();
            const emailFilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,})+$/;

            if (!plainEmail) {
                return interaction.editReply({ content: "No email provided.", ephemeral: true });
            }

            if (plainEmail.length > 254) {
                return interaction.editReply({ content: "Provided email is too long.", ephemeral: true });
            }

            if (!emailFilter.test(plainEmail)) {
                return interaction.editReply({ content: "You did not provide a valid email address!", ephemeral: true });
            }

            if (user.email && user.email.toLowerCase() === plainEmail.toLowerCase()) {
                return interaction.editReply({ content: "This is already your current email.", ephemeral: true });
            }

            const COOLDOWN_MS = 24 * 60 * 60 * 1000;
            if (user.lastEmailChange && (Date.now() - new Date(user.lastEmailChange).getTime()) < COOLDOWN_MS) {
                const remaining = COOLDOWN_MS - (Date.now() - new Date(user.lastEmailChange).getTime());
                const hours = Math.ceil(remaining / (60 * 60 * 1000));
                return interaction.editReply({ content: `You can change your email again in ${hours} hour(s).`, ephemeral: true });
            }

            const existingUser = await Users.findOne({ email: plainEmail });
            if (existingUser && existingUser.discordId !== user.discordId) {
                return interaction.editReply({ content: "Email is already in use, please choose another one.", ephemeral: true });
            }

            await user.updateOne({ $set: { email: plainEmail, lastEmailChange: new Date() } });

            const refreshTokenIndex = global.refreshTokens ? global.refreshTokens.findIndex(i => i.accountId == user.accountId) : -1;
            if (refreshTokenIndex != -1) global.refreshTokens.splice(refreshTokenIndex, 1);

            const accessTokenIndex = global.accessTokens ? global.accessTokens.findIndex(i => i.accountId == user.accountId) : -1;
            if (accessTokenIndex != -1) {
                global.accessTokens.splice(accessTokenIndex, 1);
                const xmppClient = global.Clients ? global.Clients.find(client => client.accountId == user.accountId) : null;
                if (xmppClient && xmppClient.client) {
                    try { xmppClient.client.close(); } catch (e) { }
                }
            }

            if ((accessTokenIndex != -1 || refreshTokenIndex != -1) && typeof functions.UpdateTokens === 'function') {
                try { await functions.UpdateTokens(); } catch (e) { }
            }

            const embed = new MessageEmbed()
                .setColor("#00C2A8")
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTitle("✅ Email Updated")
                .setDescription("Your account email was successfully updated.")
                .addFields(
                    { name: "👤 Account", value: `\`${user.accountId || "Unknown"}\``, inline: true },
                    { name: "🔒 Previous Email", value: maskEmail(user.email || ""), inline: true },
                    { name: "📧 New Email", value: plainEmail, inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.editReply({ content: "An error occurred while changing your email. Please try again later.", ephemeral: true });
        }
    }
};