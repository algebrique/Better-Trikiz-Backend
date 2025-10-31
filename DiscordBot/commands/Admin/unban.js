const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const config = require("../../../Config/config.json");
const log = require("../../../structs/log.js");

module.exports = {
    commandInfo: {
        name: "unban",
        description: "Unban a user from the backend by their username.",
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

        try {
            const targetUser = await User.findOne({ username_lower: username.toLowerCase() });
    
            if (!targetUser) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("User Not Found")
                    .setDescription(`No account found with username **${username}**.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            if (!targetUser.banned) {
                const embed = new MessageEmbed()
                    .setColor("#FFD166")
                    .setTitle("Already Unbanned")
                    .setDescription(`**${targetUser.username}** is not currently banned.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            await targetUser.updateOne({ $set: { banned: false } });

            const embed = new MessageEmbed()
                .setColor("#2ECC71")
                .setTitle("User Unbanned")
                .setDescription(`Successfully unbanned **${targetUser.username}**`)
                .addFields(
                    { name: "Username", value: targetUser.username, inline: true },
                    { name: "Account ID", value: `\`${targetUser.accountId}\``, inline: true },
                    { name: "Status", value: "🟢 Unbanned", inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();

            log.backend(`User unbanned: ${targetUser.username} by ${interaction.user.tag}`);
        
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            log.error("Error in unban command:", err);
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Error")
                .setDescription("An error occurred while attempting to unban the user.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
    }
}