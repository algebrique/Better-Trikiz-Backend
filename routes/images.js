const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/images/lightlobbybg.png", async (req, res) => {
    const imageUrl = "https://i.pinimg.com/736x/ce/1e/e8/ce1ee898f8e3b17e76d630cca45858c0.jpg";

    try {
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });

        res.setHeader("Content-Type", response.headers["content-type"]);
        res.setHeader("Content-Length", response.headers["content-length"]);

        console.log(`[${new Date().toLocaleString("en-US", { hour12: false })}] Reload Debug Log: GET /images/lightlobbybg.png - Image servie avec succès`);

        res.send(response.data);
    } catch (err) {
        console.error(`[${new Date().toLocaleString("en-US", { hour12: false })}] Reload Error Log: Erreur lors de la récupération de l'image : ${err.message}`);
        res.status(500).json({ error: "Impossible de récupérer l'image." });
    }
});

module.exports = router;