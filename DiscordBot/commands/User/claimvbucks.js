const { MessageEmbed } = require("discord.js");
const Users = require('../../../model/user.js');
const Profiles = require('../../../model/profiles.js');
const log = require("../../../structs/log.js");

module.exports = {
    commandInfo: {
        name: "claimvbucks",
        description: "Claim your daily 500 V-Bucks"
    },
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const user = await Users.findOne({ discordId: interaction.user.id });
            if (!user) {
                return interaction.editReply({ content: "You are not registered.", ephemeral: true });
            }

            const profile = await Profiles.findOne({ accountId: user.accountId }).lean();
            if (!profile) {
                return interaction.editReply({ content: "Profile not found. Contact an administrator.", ephemeral: true });
            }

            const lastClaimed = profile?.profiles?.lastVbucksClaim;
            const DAY_MS = 24 * 60 * 60 * 1000;
            if (lastClaimed && (Date.now() - new Date(lastClaimed).getTime() < DAY_MS)) {
                const remainingMs = DAY_MS - (Date.now() - new Date(lastClaimed).getTime());
                const hours = Math.floor(remainingMs / (1000 * 60 * 60));
                const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                return interaction.editReply({
                    content: `You have already claimed your daily V-Bucks. Please wait ${hours}h ${minutes}m.`,
                    ephemeral: true
                });
            }

            const VBUCKS_AMOUNT = 500;

            const updated = await Profiles.findOneAndUpdate(
                { accountId: user.accountId },
                {
                    $inc: {
                        'profiles.common_core.items.Currency:MtxPurchased.quantity': VBUCKS_AMOUNT,
                        'profiles.profile0.items.Currency:MtxPurchased.quantity': VBUCKS_AMOUNT,
                        'profiles.common_core.rvn': 1,
                        'profiles.common_core.commandRevision': 1
                    },
                    $set: { 'profiles.lastVbucksClaim': Date.now() }
                },
                { new: true }
            ).lean();

            if (!updated) {
                return interaction.editReply({ content: "Failed to update profile. Try again later.", ephemeral: true });
            }

            const commonCore = updated.profiles?.common_core;
            const profile0 = updated.profiles?.profile0;

            const newCommon = commonCore?.items?.['Currency:MtxPurchased']?.quantity ?? 0;
            const newProfile0 = profile0?.items?.['Currency:MtxPurchased']?.quantity ?? 0;
            const rvn = commonCore?.rvn ?? 0;
            const cmdRev = commonCore?.commandRevision ?? 0;

            const embed = new MessageEmbed()
                .setTitle("Daily V‑Bucks Claimed")
                .setDescription(`You claimed **${VBUCKS_AMOUNT.toLocaleString()} V‑Bucks** for today.`)
                .setColor("#1EFF00")
                .setThumbnail("https://i.imgur.com/yLbihQa.png")
                .addFields(
                    { name: "👤 Account", value: `\`${user.accountId || "Unknown"}\``, inline: true }
                )
                .setFooter({ text: "Better Trikiz Backend", iconURL: "https://i.pinimg.com/1200x/3e/4c/d1/3e4cd1c39e0151910a5d5b956911b3c0.jpg" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });

            return {
                profileRevision: rvn,
                profileCommandRevision: cmdRev,
                newQuantityCommonCore: newCommon,
                newQuantityProfile0: newProfile0
            };
        } catch (error) {
            log.error(error);
            try {
                await interaction.editReply({ content: "An error occurred while claiming V‑Bucks. Please try again later.", ephemeral: true });
            } catch (e) { /* ignore */ }
        }
    }
};