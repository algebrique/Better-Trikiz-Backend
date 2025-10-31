const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const functions = require("../../../structs/functions.js");

module.exports = {
    commandInfo: {
        name: "create",
        description: "Creates an account on Better Trikiz Backend.",
        options: [
            { name: "email", description: "Your email.", required: true, type: 3 },
            { name: "username", description: "Your username.", required: true, type: 3 },
            { name: "password", description: "Your password.", required: true, type: 3 }
        ],
    },

    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });
        const { options, user } = interaction;
        const discordId = user.id;
        const email = options.get("email").value;
        const username = options.get("username").value;
        const password = options.get("password").value;

        const sendEmbed = async (title, description, color = "#FF5555") => {
            const embed = new MessageEmbed()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setThumbnail("https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg")
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed], ephemeral: true });
        };

        const existingEmail = await User.findOne({ email });
        const existingUser = await User.findOne({ username });
        const emailFilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

        if (!emailFilter.test(email)) return sendEmbed("❌ Invalid Email", "You did not provide a valid email address.");
        if (existingEmail) return sendEmbed("⚠️ Email Already Used", "That email is already linked to another account.");
        if (existingUser) return sendEmbed("⚠️ Username Taken", "Please choose a different username.");
        if (username.length > 25) return sendEmbed("⚠️ Username Too Long", "Your username must be less than 25 characters long.");
        if (username.length < 3) return sendEmbed("⚠️ Username Too Short", "Your username must be at least 3 characters long.");
        if (password.length > 128) return sendEmbed("⚠️ Password Too Long", "Your password must be less than 128 characters.");
        if (password.length < 4) return sendEmbed("⚠️ Password Too Short", "Your password must be at least 4 characters long.");

        const resp = await functions.registerUser(discordId, username, email, password);
        const success = resp.status < 400;

        if (!success) return sendEmbed("❌ Account Creation Failed", "An unexpected error occurred while creating your account.");

        const createdEmbed = new MessageEmbed()
            .setColor("#00FF88")
            .setTitle("✅ Account Created Successfully")
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setDescription(`Welcome to **Better Trikiz Backend**, ${user.globalName || user.username}!`)
            .addFields(
                { name: "👤 Username", value: username, inline: true },
                { name: "💬 Discord", value: user.globalName || user.username, inline: true }
            )
            .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
            .setTimestamp();

        const securityEmbed = new MessageEmbed()
            .setColor("#FFCC00")
            .setTitle("⚠️ Security")
            .setDescription("These credentials are **confidential**. Do not share them with anyone.")
            .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
            .setTimestamp();

        if (interaction.channel) {
            interaction.channel.send({ embeds: [createdEmbed, securityEmbed] });
        } else {
            interaction.user.send({ embeds: [createdEmbed, securityEmbed] });
        }

        await sendEmbed("🎉 Account Created", "Your account was successfully created. Welcome aboard!", "#00FF88");
    }
};
