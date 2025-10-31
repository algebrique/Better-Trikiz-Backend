const { MessageEmbed } = require('discord.js');
const Users = require('../../../model/user');
const Profiles = require('../../../model/profiles');
const config = require('../../../Config/config.json');
const log = require('../../../structs/log.js');

module.exports = {
    commandInfo: {
        name: "removevbucks",
        description: "Remove V-Bucks from a user",
        options: [
            {
                name: "user",
                description: "The user to remove V-Bucks from",
                required: true,
                type: 6
            },
            {
                name: "vbucks",
                description: "The amount of V-Bucks to remove",
                required: true,
                type: 4
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

        const selectedUser = interaction.options.getUser('user');
        const vbucks = interaction.options.getInteger('vbucks');

        if (!selectedUser) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Input")
                .setDescription("Please provide a valid Discord user.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        if (typeof vbucks !== "number" || !Number.isInteger(vbucks) || vbucks <= 0) {
            const embed = new MessageEmbed()
                .setColor("#FFAA33")
                .setTitle("Invalid Amount")
                .setDescription("Please provide a valid positive integer amount of V‑Bucks to remove.");
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        try {
            const user = await Users.findOne({ discordId: selectedUser.id }).lean();
            if (!user) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Account Not Found")
                    .setDescription(`**${selectedUser.tag}** does not own an account.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const profile = await Profiles.findOne({ accountId: user.accountId }).lean();
            if (!profile || !profile.profiles) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Profile Not Found")
                    .setDescription("That user does not have a profile.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const commonCoreQty = Number(profile.profiles?.common_core?.items?.["Currency:MtxPurchased"]?.quantity || 0);
            const profile0Qty = Number(profile.profiles?.profile0?.items?.["Currency:MtxPurchased"]?.quantity || 0);

            const newCommon = commonCoreQty - vbucks;
            const newProfile0 = profile0Qty - vbucks;

            if (newCommon < 0 || newProfile0 < 0) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Insufficient Balance")
                    .setDescription(`**${selectedUser.tag}** does not have enough V‑Bucks. Current balance: **${commonCoreQty.toLocaleString()} V‑Bucks**.`);
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const MAX_BALANCE = 1000000;
            if (newCommon >= MAX_BALANCE || newProfile0 >= MAX_BALANCE) {
                const embed = new MessageEmbed()
                    .setColor("#FF5555")
                    .setTitle("Invalid Operation")
                    .setDescription("Resulting V‑Bucks balance would exceed allowed maximum.");
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const update = {
                $inc: {
                    'profiles.common_core.items.Currency:MtxPurchased.quantity': -vbucks,
                    'profiles.profile0.items.Currency:MtxPurchased.quantity': -vbucks,
                    'profiles.common_core.rvn': 1,
                    'profiles.common_core.commandRevision': 1
                }
            };

            await Profiles.updateOne({ accountId: user.accountId }, update);

            const updatedProfile = await Profiles.findOne({ accountId: user.accountId }).lean();
            const updatedCommon = Number(updatedProfile.profiles?.common_core?.items?.["Currency:MtxPurchased"]?.quantity || 0);

            const embed = new MessageEmbed()
                .setTitle("V‑Bucks Removed")
                .setDescription(`Removed **${vbucks.toLocaleString()} V‑Bucks** from **${selectedUser.tag}**`)
                .setColor("#FF5555")
                .addFields(
                    { name: "Amount Removed", value: `${vbucks.toLocaleString()} V‑Bucks`, inline: true },
                    { name: "New Balance", value: `${updatedCommon.toLocaleString()} V‑Bucks`, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();

            log.backend(`Removed ${vbucks} V-Bucks from ${user.username} by ${interaction.user.tag}`);

            await interaction.editReply({ embeds: [embed], ephemeral: true });

            return {
                profileRevision: updatedProfile.profiles.common_core.rvn,
                profileCommandRevision: updatedProfile.profiles.common_core.commandRevision,
                newQuantityCommonCore: updatedCommon,
                newQuantityProfile0: Number(updatedProfile.profiles?.profile0?.items?.["Currency:MtxPurchased"]?.quantity || 0)
            };
        } catch (err) {
            log.error("Error in removevbucks command:", err);
            const embed = new MessageEmbed()
                .setTitle("Error")
                .setDescription("An error occurred while removing V‑Bucks. Please try again later.")
                .setColor("#FF5555")
                .setFooter({ text: "Better Trikiz Backend" })
                .setTimestamp();
            try {
                await interaction.editReply({ embeds: [embed], ephemeral: true });
            } catch (e) {}
        }
    }
};