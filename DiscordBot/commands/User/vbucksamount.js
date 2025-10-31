const { MessageEmbed } = require("discord.js");
const Profiles = require('../../../model/profiles.js');
const Users = require('../../../model/user.js');

module.exports = {
    commandInfo: {
        name: "vbucksamount",
        description: "Displays your current V-Bucks balance.",
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const currentUser = await Users.findOne({ discordId: interaction.user.id }).lean();
            if (!currentUser) {
                const embed = new MessageEmbed()
                    .setTitle("Account not found")
                    .setDescription("You do not have a registered account.")
                    .setColor("#FF5555")
                    .setTimestamp()
                    .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" });
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const profile = await Profiles.findOne({ accountId: currentUser.accountId }).lean();
            if (!profile) {
                const embed = new MessageEmbed()
                    .setTitle("Profile not found")
                    .setDescription("No profile was found for your account. Please contact an administrator.")
                    .setColor("#FFAA33")
                    .setTimestamp()
                    .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" });
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const commonQty = profile?.profiles?.common_core?.items?.["Currency:MtxPurchased"]?.quantity ?? 0;
            const profile0Qty = profile?.profiles?.profile0?.items?.["Currency:MtxPurchased"]?.quantity ?? 0;
            const total = (Number(commonQty) + Number(profile0Qty)) || 0;

            const embed = new MessageEmbed()
                .setTitle("V‑Bucks Balance")
                .setDescription(`You currently have **${total.toLocaleString()} V‑Bucks**.`)
                .setColor("#00C2A8")
                .setThumbnail("https://i.imgur.com/yLbihQa.png")
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            const embed = new MessageEmbed()
                .setTitle("Error")
                .setDescription("An error occurred while fetching your V‑Bucks. Please try again later.")
                .setColor("#FF5555")
                .setTimestamp()
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" });
            try { await interaction.editReply({ embeds: [embed], ephemeral: true }); } catch (e) { }
        }
    }
};