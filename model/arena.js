const mongoose = require("mongoose");

const ArenaSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true, index: true },
    season: { type: Number, required: true, index: true },
    hype: { type: Number, required: true, default: 0 },
    division: { type: Number, required: true, default: 1 },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    collection: "arena",
  }
);

ArenaSchema.index({ accountId: 1, season: 1 }, { unique: true });

module.exports = mongoose.model("Arena", ArenaSchema);
