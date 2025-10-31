const { MessageEmbed } = require("discord.js");
const config = require("../../../Config/config.json");
const SACCodes = require("../../../model/saccodes.js");
const log = require("../../../structs/log.js");

module.exports = {
    commandInfo: {
        name: "deletesac",
        description: "Deletes a Support A Creator Code.",
        options: [
            {
                name: "code",
                description: "The Support A Creator Code to delete.",
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

        const code = (interaction.options.getString("code") || "").trim().toUpperCase();

        if (!code || code.length < 3) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Input")
                .setDescription("Please provide a valid SAC code.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        try {
            const sacCode = await SACCodes.findOne({ code_lower: code.toLowerCase() });

            if (!sacCode) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("SAC Code Not Found")
                    .setDescription(`No Support-A-Creator code found for **${code}**.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const ownerUsername = sacCode.ownerusername || "Unknown";
            const ownerAccountId = sacCode.owneraccountId || "Unknown";

            await SACCodes.deleteOne({ _id: sacCode._id });

            const embed = new MessageEmbed()
                .setColor("#E74C3C")
                .setTitle("SAC Code Deleted")
                .setDescription(`Successfully deleted Support-A-Creator code **${code}**`)
                .addFields(
                    { name: "Code", value: `\`${code}\``, inline: true },
                    { name: "Owner", value: ownerUsername, inline: true },
                    { name: "Account ID", value: `\`${ownerAccountId}\``, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();

            log.backend(`SAC code deleted: ${code} by ${interaction.user.tag}`);

            return interaction.editReply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            log.error("Error deleting SAC code:", error);
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Error")
                .setDescription("An error occurred while deleting the SAC code. Please try again later.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
    }
}