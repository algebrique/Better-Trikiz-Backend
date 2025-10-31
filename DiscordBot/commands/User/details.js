const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const Profiles = require('../../../model/profiles.js');

module.exports = {
    commandInfo: {
        name: "details",
        description: "Retrieves your account info."
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const dbUser = await User.findOne({ discordId: interaction.user.id }).lean();
            if (!dbUser) return interaction.editReply({ content: "You do not have a registered account!", ephemeral: true });

            const profile = await Profiles.findOne({ accountId: dbUser.accountId }).lean();
            const currency = profile?.profiles?.common_core?.items?.["Currency:MtxPurchased"]?.quantity ?? 0;

            const onlineStatus = Array.isArray(global.Clients) && global.Clients.some(i => i.accountId == dbUser.accountId);
            const bannedStatus = !!dbUser.banned;

            const embed = new MessageEmbed()
                .setColor("#00C2A8")
                .setAuthor({
                    name: `${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTitle("Account Details")
                .setDescription("Here are the details for your Better Trikiz Backend account.")
                .addFields(
                    { name: "👤 Username", value: dbUser.username || "Unknown", inline: true },
                    { name: "✉️ Email", value: dbUser.email || "Unknown", inline: true },
                    { name: "🔌 Online", value: onlineStatus ? "Yes" : "No", inline: true },
                    { name: "⛔ Banned", value: bannedStatus ? "Yes" : "No", inline: true },
                    { name: "💰 V‑Bucks", value: `${Number(currency).toLocaleString()} V‑Bucks`, inline: true },
                    { name: "🆔 Account ID", value: `\`${dbUser.accountId || "Unknown"}\``, inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.editReply({ content: "An error occurred while fetching your details.", ephemeral: true });
        }
    }
};