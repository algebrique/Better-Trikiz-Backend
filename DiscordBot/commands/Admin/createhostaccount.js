const { MessageEmbed } = require("discord.js");
const functions = require("../../../structs/functions.js");
const User = require("../../../model/user.js");
const log = require("../../../structs/log.js");

function generateRandomPassword(length) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+<>?";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

module.exports = {
    commandInfo: {
        name: "createhostaccount",
        description: "Creates a host account for Better Trikiz Backend."
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const serverOwnerId = interaction.guild.ownerId;

        if (interaction.user.id !== serverOwnerId) {
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Permission Denied")
                .setDescription("Only the server owner can create host accounts.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const existingHostAccount = await User.findOne({ email: "hostaccount@bettertrikiz.com" });

        if (existingHostAccount) {
            const embed = new MessageEmbed()
                .setColor("#FFD166")
                .setTitle("Account Already Exists")
                .setDescription("A host account already exists for this backend.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        const username = "BetterTrikizHost";
        const email = "hostaccount@bettertrikiz.com";
        const password = generateRandomPassword(16);

        try {
            const newHostAccount = await functions.registerUser(email, username, password, username);

            if (!newHostAccount) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Creation Failed")
                    .setDescription("Failed to create the host account. Please try again.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            await User.updateOne(
                { accountId: newHostAccount.accountId },
                { $set: { isServer: true } }
            );

            const embed = new MessageEmbed()
                .setColor("#2ECC71")
                .setTitle("Host Account Created")
                .setDescription("The host account has been successfully created for Better Trikiz Backend.")
                .addFields(
                    { name: "Username", value: `\`${username}\``, inline: true },
                    { name: "Email", value: `\`${email}\``, inline: true },
                    { name: "Password", value: `||${password}||`, inline: false },
                    { name: "Account ID", value: `\`${newHostAccount.accountId}\``, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend • Keep these credentials safe" })
                .setTimestamp();

            log.backend(`Host account created: ${username} (${newHostAccount.accountId})`);

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            log.error("Error creating host account:", error);
            const embed = new MessageEmbed()
                .setColor("#FF5555")
                .setTitle("Error")
                .setDescription("An error occurred while creating the host account.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
    }
};