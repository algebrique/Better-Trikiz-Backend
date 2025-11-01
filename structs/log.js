const fs = require("fs");
const axios = require("axios");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

function getTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString('en-US');
    const time = now.toLocaleTimeString();
    
    return `${date} ${time}`; 
}

function formatLog(prefixColor, prefix, ...args) {
    let msg = args.join(" ");
    let formattedMessage = `${prefixColor}[${getTimestamp()}] ${prefix}\x1b[0m: ${msg}`;
    console.log(formattedMessage);
}

const WEBHOOK_URLS = (config.webhooks && Array.isArray(config.webhooks.urls)) ? config.webhooks.urls.filter(Boolean) : [];
let currentWebhookIndex = 0;
let webhookQueue = [];
let isProcessingQueue = false;

function queueWebhook(message, color = 3066993) {
    if (!config.bEnableDiscordWebhook || WEBHOOK_URLS.length === 0) return;
    webhookQueue.push({ message, color });
    if (!isProcessingQueue) processWebhookQueue();
}

async function processWebhookQueue() {
    if (webhookQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }
    isProcessingQueue = true;
    const { message, color } = webhookQueue.shift();
    if (WEBHOOK_URLS.length === 0) {
        isProcessingQueue = false;
        return;
    }
    const url = WEBHOOK_URLS[currentWebhookIndex];
    try {
        await axios.post(url, {
            embeds: [{ description: message, color, timestamp: new Date().toISOString() }]
        });
        currentWebhookIndex = (currentWebhookIndex + 1) % WEBHOOK_URLS.length;
        setTimeout(processWebhookQueue, 100);
    } catch (err) {
        if (err.response && err.response.status === 429) {
            const retryAfter = err.response.data?.retry_after ? Number(err.response.data.retry_after) : 1000;
            webhookQueue.unshift({ message, color });
            setTimeout(processWebhookQueue, retryAfter);
        } else {
            setTimeout(processWebhookQueue, 100);
        }
    }
}

function backend(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[32m", "Better Trikiz Backend Log", ...args);
    } else {
        console.log(`\x1b[32mBetter Trikiz Backend Log\x1b[0m: ${msg}`);
    }
}

function bot(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[33m", "Better Trikiz Bot Log", ...args);
    } else {
        console.log(`\x1b[33mBetter Trikiz Bot Log\x1b[0m: ${msg}`);
    }
}

function xmpp(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[34m", "Better Trikiz Xmpp Log", ...args);
    } else {
        console.log(`\x1b[34mBetter Trikiz Xmpp Log\x1b[0m: ${msg}`);
    }

    try {
        const hasPattern = msg.includes('ne correspond pas au format "PlayerXX"');
        const match = msg.match(/Utilisateur\s+"([^"]+)"/);
        if (hasPattern && match && match[1]) {
            const pseudo = match[1];
            queueWebhook(`joueur connecté : ${pseudo}`, 3066993);
        }
    } catch (_) { /* noop */ }

    try {
        const logoutMatch = msg.match(/An xmpp client with the displayName (\S+) has logged out\./);
        if (logoutMatch && logoutMatch[1]) {
            const pseudo = logoutMatch[1];
            queueWebhook(`joueur déconnecté : ${pseudo}`, 15158332);
        }
    } catch (_) { /* noop */ }
}

function error(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[31m", "Better Trikiz Error Log", ...args);
    } else {
        console.log(`\x1b[31mBetter Trikiz Error Log\x1b[0m: ${msg}`);
    }
}

function debug(...args) {
    if (config.bEnableDebugLogs) {
        let msg = args.join(" ");
        if (config.bEnableFormattedLogs) {
            formatLog("\x1b[35m", "Better Trikiz Debug Log", ...args);
        } else {
            console.log(`\x1b[35mBetter Trikiz Debug Log\x1b[0m: ${msg}`);
        }
    }
}

function website(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[36m", "Better Trikiz Website Log", ...args);
    } else {
        console.log(`\x1b[36mBetter Trikiz Website Log\x1b[0m: ${msg}`);
    }
}

function AutoRotation(...args) {
    if (config.bEnableAutoRotateDebugLogs) {
        let msg = args.join(" ");
        if (config.bEnableFormattedLogs) {
            formatLog("\x1b[36m", "Better Trikiz AutoRotation Debug Log", ...args);
        } else {
            console.log(`\x1b[36mBetter Trikiz AutoRotation Debug Log\x1b[0m: ${msg}`);
        }
    }
}

function checkforupdate(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[33m", "Better Trikiz Update Log", ...args);
    } else {
        console.log(`\x1b[33mBetter Trikiz Update Log\x1b[0m: ${msg}`);
    }
}

function autobackendrestart(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[92m", "Better Trikiz Auto Backend Restart Log", ...args);
    } else {
        console.log(`\x1b[92mBetter Trikiz Auto Backend Restart\x1b[0m: ${msg}`);
    }
}

function calderaservice(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[91m", "Caldera Service Log", ...args);
    } else {
        console.log(`\x1b[91mCaldera Service\x1b[0m: ${msg}`);
    }
}

module.exports = {
    backend,
    bot,
    xmpp,
    error,
    debug,
    website,
    AutoRotation,
    checkforupdate,
    autobackendrestart,
    calderaservice
};