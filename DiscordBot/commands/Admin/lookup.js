const { MessageEmbed } = require("discord.js");
const Users = require("../../../model/user.js");
const config = require("../../../Config/config.json");

module.exports = {
    commandInfo: {
        name: "lookup",
        description: "Search for a Discord user's ID by providing their in-game username.",
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

        const user = await Users.findOne({ username_lower: username.toLowerCase() }).lean();
        if (!user) {
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("User Not Found")
                .setDescription(`No account found with username **${username}**.`);
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const onlineStatus = Array.isArray(global.Clients) && global.Clients.some(i => i.accountId == user.accountId);
        const bannedStatus = !!user.banned;

        let discordUser = null;
        try {
            if (user.discordId) {
                discordUser = await interaction.client.users.fetch(user.discordId);
            }
        } catch (e) {}

        const embed = new MessageEmbed()
            .setColor(bannedStatus ? "#FF5555" : onlineStatus ? "#2ECC71" : "#00A3C4")
            .setTitle("User Lookup")
            .setDescription(`Account information for **${user.username}**`)
            .addFields(
                { name: "Username", value: user.username, inline: true },
                { name: "Account ID", value: `\`${user.accountId}\``, inline: true },
                { name: "Email", value: user.email || "Unknown", inline: true },
                { name: "Discord User", value: discordUser ? `${discordUser.tag}` : `<@${user.discordId}>`, inline: true },
                { name: "Discord ID", value: `\`${user.discordId || "Unknown"}\``, inline: true },
                { name: "Status", value: onlineStatus ? "🟢 Online" : "⚫ Offline", inline: true },
                { name: "Banned", value: bannedStatus ? "🔴 Yes" : "🟢 No", inline: true },
                { name: "Account Created", value: user.created ? `<t:${Math.floor(new Date(user.created).getTime() / 1000)}:R>` : "Unknown", inline: true }
            )
            .setThumbnail(discordUser ? discordUser.displayAvatarURL({ dynamic: true }) : null)
            .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed], ephemeral: true });
    }
}