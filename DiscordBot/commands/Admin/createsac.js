const { MessageEmbed } = require("discord.js");
const functions = require("../../../structs/functions.js");
const config = require("../../../Config/config.json");

module.exports = {
    commandInfo: {
        name: "createsac",
        description: "Creates a Support A Creator Code.",
        options: [
            {
                name: "code",
                description: "The Support A Creator Code.",
                required: true,
                type: 3
            },            
            {
                name: "ingame-username",
                description: "In-Game Name of the codes owner.",
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
        const username = (interaction.options.getString("ingame-username") || "").trim();
        const creator = interaction.user.id;

        if (!code || code.length < 3 || code.length > 16) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Code")
                .setDescription("SAC code must be between 3 and 16 characters.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        if (!username || username.length < 3) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Username")
                .setDescription("Please provide a valid in-game username.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        try {
            const resp = await functions.createSAC(code, username, creator);

            if (!resp || !resp.message) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Error")
                    .setDescription("There was an unknown error while creating the SAC code.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            if (resp.status >= 400) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("SAC Creation Failed")
                    .setDescription(resp.message);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const embed = new MessageEmbed()
                .setColor("#2ECC71")
                .setTitle("SAC Code Created")
                .setDescription("Support-A-Creator code has been successfully created.")
                .addFields(
                    { name: "Code", value: `\`${code}\``, inline: true },
                    { name: "Owner", value: username, inline: true },
                    { name: "Created By", value: `<@${creator}>`, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Error")
                .setDescription("An error occurred while creating the SAC code.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
    }
}