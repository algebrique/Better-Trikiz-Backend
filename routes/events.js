const express = require("express");
const app = express.Router();
const { verifyToken } = require("../tokenManager/tokenVerify.js");
const log = require("../structs/log.js");
const fs = require("fs");
const path = require("path");
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../Config/config.json"), "utf8"));
const Arena = require("../model/arena.js");

const ARENA_SEASON = 12;
const HYPE_KEY = `Hype_S${ARENA_SEASON}_P`;

async function getOrInitArena(accountId) {
    let doc = await Arena.findOne({ accountId, season: ARENA_SEASON }).lean();
    if (!doc) {
        doc = { accountId, season: ARENA_SEASON, hype: 0, division: 1 };
        await Arena.create(doc);
    }
    return doc;
}

app.get("/events/api/v1/players/:gameId/:accountId", verifyToken, async (req, res) => {
    const { gameId, accountId } = req.params;
    log.debug(`GET /events/api/v1/players/${gameId}/${accountId} called`);

    const arena = await getOrInitArena(accountId);
    res.json({
        gameId: gameId,
        accountId: accountId,
        tokens: [`Arena_S${ARENA_SEASON}_Division${arena.division}`],
        teams: {},
        pendingPayouts: [],
        pendingPenalties: {},
        persistentScores: { [HYPE_KEY]: arena.hype },
        groupIdentity: {}
    });
});

app.get("/events/api/v1/players/:gameId/tokens", verifyToken, async (req, res) => {
    const { gameId } = req.params;
    const teamAccountIds = (req.query.teamAccountIds || "").split(",").filter(Boolean);
    log.debug(`GET /events/api/v1/players/${gameId}/tokens called for ${teamAccountIds.length} account(s)`);

    const accounts = [];
    for (const id of teamAccountIds) {
        const arena = await getOrInitArena(id);
        accounts.push({ accountId: id, tokens: [`Arena_S${ARENA_SEASON}_Division${arena.division}`] });
    }
    res.json({ accounts });
});

app.get("/events/api/v1/events/:gameId/download/:accountId", verifyToken, async (req, res) => {
    const { gameId, accountId } = req.params;
    log.debug(`GET /events/api/v1/events/${gameId}/download/${accountId} called`);

    res.json({
        events: [],
        templates: [],
        leaderboardDefs: [],
        scoringRuleSets: {},
        payoutTables: {},
        scores: [],
        resolvedWindowLocations: {}
    });
});

app.get("/events/api/v1/events/:gameId/data/:accountId", verifyToken, async (req, res) => {
    const { gameId, accountId } = req.params;
    log.debug(`GET /events/api/v1/events/${gameId}/data/${accountId} called`);

    const arena = await getOrInitArena(accountId);
    res.json({
        player: {
            gameId: gameId,
            accountId: accountId,
            tokens: [`Arena_S${ARENA_SEASON}_Division${arena.division}`],
            teams: {},
            pendingPayouts: [],
            pendingPenalties: {},
            persistentScores: { [HYPE_KEY]: arena.hype },
            groupIdentity: {}
        },
        events: [],
        templates: [],
        leaderboardDefs: [],
        scoringRuleSets: {},
        payoutTables: {},
        scores: [],
        resolvedWindowLocations: {}
    });
});

app.get("/btz/arena/:accountId", async (req, res) => {
    const arena = await getOrInitArena(req.params.accountId);
    res.json({ accountId: arena.accountId, season: arena.season, hype: arena.hype, division: arena.division });
});

app.post("/btz/arena/:accountId", async (req, res) => {
    const apiKey = req.headers["x-api-key"]; 
    if (!apiKey || apiKey !== config.Api.bApiKey) return res.status(403).json({ error: "Forbidden" });

    const { hype, division } = req.body || {};
    const update = {};
    if (typeof hype === "number" && hype >= 0) update.hype = Math.floor(hype);
    if (typeof division === "number" && division >= 1) update.division = Math.floor(division);
    update.updatedAt = new Date();

    let doc = await Arena.findOneAndUpdate({ accountId: req.params.accountId, season: ARENA_SEASON }, { $set: update }, { new: true, upsert: true });
    res.json({ accountId: doc.accountId, season: doc.season, hype: doc.hype, division: doc.division });
});

module.exports = app;
