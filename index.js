const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const path = require("path");
const readline = require('readline');
const axios = require('axios');
const kv = require("./structs/kv.js");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());
const WebSocket = require('ws');
const https = require("https");

const log = require("./structs/log.js");
const error = require("./structs/error.js");
const functions = require("./structs/functions.js");
const CheckForUpdate = require("./structs/checkforupdate.js");
const AutoBackendRestart = require("./structs/autobackendrestart.js");

const WEBHOOK_URLS = (config.webhooks && Array.isArray(config.webhooks.urls)) ? config.webhooks.urls.filter(Boolean) : [];

let currentWebhookIndex = 0;
let webhookQueue = [];
let isProcessingQueue = false;

async function sendToWebhook(message, color = 3447003) {
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

    try {
        if (WEBHOOK_URLS.length === 0) {
            isProcessingQueue = false;
            return;
        }
        const webhookUrl = WEBHOOK_URLS[currentWebhookIndex];
        await axios.post(webhookUrl, {
            embeds: [{
                description: message,
                color: color,
                timestamp: new Date().toISOString()
            }]
        });

        currentWebhookIndex = (currentWebhookIndex + 1) % WEBHOOK_URLS.length;
        
        setTimeout(() => processWebhookQueue(), 100);
    } catch (err) {
        if (err.response && err.response.status === 429) {
            const retryAfter = err.response.data?.retry_after || 1000;
            console.error(`Webhook rate limited, retrying after ${retryAfter}ms`);
            webhookQueue.unshift({ message, color });
            setTimeout(() => processWebhookQueue(), retryAfter);
        } else {
            console.error("Failed to send webhook:", err.message);
            setTimeout(() => processWebhookQueue(), 100);
        }
    }
}

const app = express();

if (!fs.existsSync("./ClientSettings")) fs.mkdirSync("./ClientSettings");

global.JWT_SECRET = functions.MakeID();
const PORT = config.port;
const WEBSITEPORT = config.Website.websiteport;

let httpsServer;

if (config.bEnableHTTPS) {
    const httpsOptions = {
        cert: fs.readFileSync(config.ssl.cert),
        ca: fs.existsSync(config.ssl.ca) ? fs.readFileSync(config.ssl.ca) : undefined,
        key: fs.readFileSync(config.ssl.key)
    };

    httpsServer = https.createServer(httpsOptions, app);
}

if (!fs.existsSync("./ClientSettings")) fs.mkdirSync("./ClientSettings");

global.JWT_SECRET = functions.MakeID();

console.log('Welcome to Better Trikiz Backend\n');

const tokens = JSON.parse(fs.readFileSync("./tokenManager/tokens.json").toString());

for (let tokenType in tokens) {
    for (let tokenIndex in tokens[tokenType]) {
        let decodedToken = jwt.decode(tokens[tokenType][tokenIndex].token.replace("eg1~", ""));

        if (DateAddHours(new Date(decodedToken.creation_date), decodedToken.hours_expire).getTime() <= new Date().getTime()) {
            tokens[tokenType].splice(Number(tokenIndex), 1);
        }
    }
}

fs.writeFileSync("./tokenManager/tokens.json", JSON.stringify(tokens, null, 2));

global.accessTokens = tokens.accessTokens;
global.refreshTokens = tokens.refreshTokens;
global.clientTokens = tokens.clientTokens;
global.kv = kv;

global.exchangeCodes = [];

let updateFound = false;

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "./package.json")).toString());
if (!packageJson) throw new Error("Failed to parse package.json");
const version = packageJson.version;

const checkUpdates = async () => {
    if (updateFound) return;

    try {
        const updateAvailable = await CheckForUpdate.checkForUpdate(version);
        if (updateAvailable) {
            updateFound = true;
        }
    } catch (err) {
        log.error("Failed to check for updates");
    }
};

checkUpdates();

setInterval(checkUpdates, 60000);

async function askForIpAddress() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const configPath = path.join(__dirname, 'Config', 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const currentIP = currentConfig.matchmakerIP.split(':')[0];

    return new Promise((resolve) => {
        rl.question(`Enter your IP address (press Enter to keep current IP: ${currentIP}): `, (ip) => {
            rl.close();
            if (!ip.trim()) {
                console.log(`Keeping current IP: ${currentIP}`);
                resolve(currentIP);
            } else {
                resolve(ip.trim());
            }
        });
    });
}

async function updateConfigFiles(ipAddress) {
    const configPath = path.join(__dirname, 'Config', 'config.json');
    let configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const currentIP = configContent.matchmakerIP.split(':')[0];

    if (currentIP === ipAddress) {
        console.log('\nUsing existing IP configuration');
        return;
    }

    const enginePath = path.join(__dirname, 'CloudStorage', 'DefaultEngine.ini');
    let engineContent = fs.readFileSync(enginePath, 'utf8');
    
    engineContent = engineContent.replace(
        /ServerAddr="ws:\/\/[^"]+"/g, 
        `ServerAddr="ws://${ipAddress}"`
    );
    
    fs.writeFileSync(enginePath, engineContent, 'utf8');

    configContent.matchmakerIP = `${ipAddress}:80`;
    configContent.gameServerIP = [`${ipAddress}:7777:playlist_defaultsolo`];
    
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2), 'utf8');

    console.log('\nConfiguration files updated successfully!');
}

async function killPortIfNeeded(port) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
            const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
            if (stdout) {
                const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && !isNaN(pid)) {
                        log.backend(`Killing process ${pid} using port ${port}...`);
                        await execPromise(`taskkill /F /PID ${pid}`);
                    }
                }
            }
        } else {
            const { stdout } = await execPromise(`lsof -ti:${port}`);
            if (stdout.trim()) {
                const pids = stdout.trim().split('\n');
                for (const pid of pids) {
                    if (pid && !isNaN(pid)) {
                        log.backend(`Killing process ${pid} using port ${port}...`);
                        await execPromise(`kill -9 ${pid}`);
                    }
                }
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
        
    }
}

async function startServer() {
    try {
        const ipAddress = await askForIpAddress();
        await updateConfigFiles(ipAddress);
        
        await killPortIfNeeded(PORT);
        
        mongoose.set('strictQuery', true);

        mongoose.connect(config.mongodb.database, () => {
            log.backend("App successfully connected to MongoDB!");
        });

        mongoose.connection.on("error", err => {
            log.error("MongoDB failed to connect, please make sure you have MongoDB installed and running.");
            throw err;
        });

        app.use(rateLimit({ windowMs: 0.5 * 60 * 1000, max: 55 }));
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        fs.readdirSync("./routes").forEach(fileName => {
            try {
                app.use(require(`./routes/${fileName}`));
            } catch (err) {
                log.error(`Routes Error: Failed to load ${fileName}`)
            }
        });

        app.use(require("./routes/images.js"));

        fs.readdirSync("./Api").forEach(fileName => {
            try {
                app.use(require(`./Api/${fileName}`));
            } catch (err) {
                log.error(`Reload API Error: Failed to load ${fileName}`)
            }
        });

        app.get("/unknown", (req, res) => {
            log.debug('GET /unknown endpoint called');
            res.json({ msg: "Better Trikiz Backend - Made by Burlone" });
        });

        const serverOptions = {
            host: '0.0.0.0'
        };

        let server;
        if (config.bEnableHTTPS) {
            server = httpsServer.listen(PORT, serverOptions.host, () => {
                log.backend(`Backend started listening on port ${PORT} (SSL Enabled)`);
                sendToWebhook(`✅ **Backend Started**\nPort: ${PORT}\nSSL: Enabled`, 3066993);
                require("./xmpp/xmpp.js");
                if (config.discord.bUseDiscordBot === true) {
                    require("./DiscordBot");
                }
                if (config.bUseAutoRotate === true) {
                    require("./structs/autorotate.js");
                }
            }).on("error", async (err) => {
                if (err.code === "EADDRINUSE") {
                    log.error(`Port ${PORT} is already in use! Error details: ${err.message}`);
                    log.error(`System error code: ${err.syscall}, errno: ${err.errno}`);
                    sendToWebhook(`❌ **Backend Error**\nPort ${PORT} is already in use!\nError: ${err.message}`, 15158332);
                    await functions.sleep(3000);
                    process.exit(1);
                } else {
                    log.error(`Server error: ${err.code} - ${err.message}`);
                    throw err;
                }
            });
        } else {
            server = app.listen(PORT, serverOptions.host, () => {
                log.backend(`Backend started listening on port ${PORT} (SSL Disabled)`);
                sendToWebhook(`✅ **Backend Started**\nPort: ${PORT}\nSSL: Disabled`, 3066993);
                require("./xmpp/xmpp.js");
                if (config.discord.bUseDiscordBot === true) {
                    require("./DiscordBot");
                }
                if (config.bUseAutoRotate === true) {
                    require("./structs/autorotate.js");
                }
            }).on("error", async (err) => {
                if (err.code === "EADDRINUSE") {
                    log.error(`Port ${PORT} is already in use! Error details: ${err.message}`);
                    log.error(`System error code: ${err.syscall}, errno: ${err.errno}`);
                    sendToWebhook(`❌ **Backend Error**\nPort ${PORT} is already in use!\nError: ${err.message}`, 15158332);
                    await functions.sleep(3000);
                    process.exit(1);
                } else {
                    log.error(`Server error: ${err.code} - ${err.message}`);
                    throw err;
                }
            });
        }

        if (config.bEnableAutoBackendRestart === true) {
            AutoBackendRestart.scheduleRestart(config.bRestartTime);
        }

        if (config.bEnableCalderaService === true) {
            const createCalderaService = require('./CalderaService/calderaservice');
            const calderaService = createCalderaService();

            let calderaHttpsOptions;
            if (config.bEnableHTTPS) {
                calderaHttpsOptions = {
                    cert: fs.readFileSync(config.ssl.cert),
                    ca: fs.existsSync(config.ssl.ca) ? fs.readFileSync(config.ssl.ca) : undefined,
                    key: fs.readFileSync(config.ssl.key)
                };
            }

            if (config.bEnableHTTPS) {
                const calderaHttpsServer = https.createServer(calderaHttpsOptions, calderaService);
                
                if (!config.bGameVersion) {
                    log.calderaservice("Please define a version in the config!")
                    return;
                }

                calderaHttpsServer.listen(config.bCalderaServicePort, () => {
                    log.calderaservice(`Caldera Service started listening on port ${config.bCalderaServicePort} (SSL Enabled)`);
                }).on("error", async (err) => {
                    if (err.code === "EADDRINUSE") {
                        log.calderaservice(`Caldera Service port ${config.bCalderaServicePort} is already in use!\nClosing in 3 seconds...`);
                        await functions.sleep(3000);
                        process.exit(1);
                    } else {
                        throw err;
                    }
                });
            } else {
                if (!config.bGameVersion) {
                    log.calderaservice("Please define a version in the config!")
                    return;
                }

                calderaService.listen(config.bCalderaServicePort, () => {
                    log.calderaservice(`Caldera Service started listening on port ${config.bCalderaServicePort} (SSL Disabled)`);
                }).on("error", async (err) => {
                    if (err.code === "EADDRINUSE") {
                        log.calderaservice(`Caldera Service port ${config.bCalderaServicePort} is already in use!\nClosing in 3 seconds...`);
                        await functions.sleep(3000);
                        process.exit(1);
                    } else {
                        throw err;
                    }
                });
            }
        }



        if (config.Website.bUseWebsite === true) {
            const websiteApp = express();
            require('./Website/website')(websiteApp);

            let httpsOptions;
            if (config.bEnableHTTPS) {
                httpsOptions = {
                    cert: fs.readFileSync(config.ssl.cert),
                    ca: fs.existsSync(config.ssl.ca) ? fs.readFileSync(config.ssl.ca) : undefined,
                    key: fs.readFileSync(config.ssl.key)
                };
            }

            if (config.bEnableHTTPS) {
                const httpsServer = https.createServer(httpsOptions, websiteApp);
                httpsServer.listen(config.Website.websiteport, () => {
                    log.website(`Website started listening on port ${config.Website.websiteport} (SSL Enabled)`);
                }).on("error", async (err) => {
                    if (err.code === "EADDRINUSE") {
                        log.error(`Website port ${config.Website.websiteport} is already in use!\nClosing in 3 seconds...`);
                        await functions.sleep(3000);
                        process.exit(1);
                    } else {
                        throw err;
                    }
                });
            } else {
                websiteApp.listen(config.Website.websiteport, () => {
                    log.website(`Website started listening on port ${config.Website.websiteport} (SSL Disabled)`);
                }).on("error", async (err) => {
                    if (err.code === "EADDRINUSE") {
                        log.error(`Website port ${config.Website.websiteport} is already in use!\nClosing in 3 seconds...`);
                        await functions.sleep(3000);
                        process.exit(1);
                    } else {
                        throw err;
                    }
                });
            }
        }

        app.use((req, res, next) => {
            const url = req.originalUrl;
            log.debug(`Missing endpoint: ${req.method} ${url} request port ${req.socket.localPort}`);
            
            const missingEndpointMsg = `⚠️ **Missing Endpoint Detected**\n\`\`\`\n${req.method} ${url}\nPort: ${req.socket.localPort}\nHeaders: ${JSON.stringify(req.headers, null, 2)}\n\`\`\``;
            sendToWebhook(missingEndpointMsg, 16776960);
            
            if (req.url.includes("..")) {
                res.redirect("https://youtu.be/dQw4w9WgXcQ");
                return;
            }
            error.createError(
                "errors.com.epicgames.common.not_found", 
                "Sorry the resource you were trying to find could not be found", 
                undefined, 1004, undefined, 404, res
            );
        });

    } catch (error) {
        console.error('Error during server startup:', error);
        process.exit(1);
    }
}

function DateAddHours(pdate, number) {
    let date = pdate;
    date.setHours(date.getHours() + number);

    return date;
}

startServer();

module.exports = app;