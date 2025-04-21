const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../Config/config.json');
const log = require("./log.js");

const webhook = config.bItemShopWebhook; 
const fortniteapi = "https://fortnite-api.com/v2/cosmetics/br";
const catalogcfg = path.join(__dirname, "..", 'Config', 'catalog_config.json');

const chapterlimit = config.bChapterlimit; 
const seasonlimit = config.bSeasonlimit; 
const dailyItemsCount = config.bDailyItemsAmount;
const featuredItemsCount = config.bFeaturedItemsAmount;

const prices = {
    characters: {
        common: 800,
        uncommon: 800,
        rare: 1200,
        epic: 1500,
        legendary: 2000,
        dark: 1200,
        dc: 1500,
        gaminglegends: 1500,
        frozen: 1200,
        lava: 1200,
        marvel: 1500,
        starwars: 2000,
        slurp: 1800,
        shadow: 1200,
        icon: 1500
    },
    pickaxes: {
        common: 500,
        uncommon: 500,
        rare: 800,
        epic: 1200,
        legendary: 1500,
        icon: 500,
        dark: 1200,
        gaminglegends: 800,
        frozen: 1000,
        slurp: 1500,
        starwars: 1000,
        shadow: 1000,
        marvel: 1000,
        dc: 800,
        lava: 1200
    },
    gliders: {
        common: 300,
        uncommon: 500,
        rare: 800,
        epic: 1200,
        legendary: 1500,
        icon: 500,
        dc: 1200,
        dark: 500,
        frozen: 1000,
        shadow: 1000,
        slurp: 1000,
        starwars: 1000,
        marvel: 1000,
        lava: 1200
    },
    wraps: {
        common: 300,
        uncommon: 300,
        rare: 500,
        epic: 700,
        legendary: 1000,
        icon: 700,
        dc: 1000,
        dark: 700,
        shadow: 700,
        slurp: 700,
        frozen: 500,
        starwars: 500,
        marvel: 500,
        lava: 700
    },
    dances: {
        common: 200,
        uncommon: 200,
        rare: 500,
        epic: 800,
        legendary: 800,
        icon: 500,
        marvel: 500,
        starwars: 500,
        dc: 300,
        dark: 800,
        slurp: 750,
        frozen: 800,
        shadow: 500,
        lava: 800
    },
    contrails: {
        common: 300,
        uncommon: 300,
        rare: 500,
        epic: 500,
        legendary: 750,
        icon: 750,
        dc: 1000,
        dark: 750,
        shadow: 750,
        frozen: 1000,
        starwars: 1000,
        slurp: 750,
        marvel: 1000,
        lava: 750
    },
    backpacks: {
        common: 400,
        uncommon: 400,
        rare: 600,
        epic: 800,
        legendary: 1000,
        starwars: 1500,
        gaminglegends: 800,
        marvel: 1200,
        dc: 1200,
        dark: 800,
        slurp: 1000,
        shadow: 1000,
        frozen: 1200,
        lava: 800
    },
    musicPacks: {
        common: 200,
        uncommon: 200,
        rare: 300,
        epic: 500,
        legendary: 750,
        icon: 750,
        dc: 1000,
        dark: 750,
        slurp: 500,
        frozen: 1000,
        starwars: 1000,
        marvel: 1000,
        lava: 750
    }
};

async function fetchitems() {
    try {
        const response = await axios.get(fortniteapi);
        const cosmetics = response.data.data || [];
        const excludedItems = config.bExcludedItems || [];

        return cosmetics.filter(item => {
            const { id, introduction, rarity } = item;
            const chapter = introduction?.chapter ? parseInt(introduction.chapter, 10) : null;
            const season = introduction?.season ? introduction.season.toString() : null;
            const itemRarity = rarity?.displayValue?.toLowerCase();

            if (!chapter || !season) return false;
            if (excludedItems.includes(id)) return false;

            const maxChapter = parseInt(chapterlimit, 10);
            const maxSeason = seasonlimit.toString();

            if (maxSeason === "OG") {
                return chapter >= 1 && chapter <= maxChapter && itemRarity !== "common";
            }

            if (
                chapter < 1 || chapter > maxChapter ||
                (chapter === maxChapter && (season === "X" || parseInt(season, 10) > parseInt(maxSeason, 10)))
            ) {
                return false;
            }

            return itemRarity !== "common";
        });
    } catch (error) {
        log.error('Error fetching cosmetics:', error.message || error);
        return [];
    }
}

function pickRandomItems(items, count) {
    const itemTypePriority = {
        outfit: { min: 2, max: 3 },
        emote: { min: 1, max: 2 },
        backpack: { min: 1, max: 1 },
        glider: { min: 1, max: 1 },
        pickaxe: { min: 1, max: 2 },
        wrap: { min: 0, max: 1 },
        loadingscreen: { min: 0, max: 1 },
        music: { min: 0, max: 1 }
    };

    const selectedItems = new Set();
    const itemsByType = new Map();


    items.forEach(item => {
        const type = item.type?.value?.toLowerCase();
        if (!itemsByType.has(type)) {
            itemsByType.set(type, []);
        }
        itemsByType.get(type).push(item);
    });

    for (const [type, priority] of Object.entries(itemTypePriority)) {
        const typeItems = itemsByType.get(type) || [];
        const typeItemsToSelect = Math.min(
            Math.floor(Math.random() * (priority.max - priority.min + 1)) + priority.min,
            typeItems.length
        );

        const shuffled = typeItems.sort(() => 0.5 - Math.random());
        for (let i = 0; i < typeItemsToSelect && selectedItems.size < count; i++) {
            selectedItems.add(shuffled[i]);
        }
    }

    const remainingItems = items.filter(item => !selectedItems.has(item));
    while (selectedItems.size < count && remainingItems.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingItems.length);
        selectedItems.add(remainingItems.splice(randomIndex, 1)[0]);
    }

    return Array.from(selectedItems);
}

function formatitemgrantsyk(item) {
    const { id, backendValue, type } = item;
    let itemType;

    switch (type.value.toLowerCase()) {
        case "outfit":
            itemType = "AthenaCharacter";  
            break;
        case "emote":
            itemType = "AthenaDance";  
            break;
        default:
            itemType = backendValue || `Athena${capitalizeomg(type.value)}`;
            break;
    }

    return [`${itemType}:${id}`];
}

function capitalizeomg(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function notproperpricegen(item) {
    const rarity = item.rarity?.displayValue?.toLowerCase() || 'common';
    const type = item.type?.value?.toLowerCase();
    const series = item.series?.value?.toLowerCase();
    
    const priceCategory = {
        outfit: 'characters',
        pickaxe: 'pickaxes',
        glider: 'gliders',
        wrap: 'wraps',
        emote: 'dances',
        backpack: 'backpacks',
        contrail: 'contrails',
        music: 'musicPacks'
    }[type];

    if (!priceCategory || !prices[priceCategory]) {
        log.error(`Invalid price category for item type: ${type}`);
        return 999999;
    }

    if (series) {
        const cleanedSeries = series
            .replace(' series', '')
            .replace(/\s+/g, '')
            .toLowerCase();

        if (prices[priceCategory][cleanedSeries]) {
            return prices[priceCategory][cleanedSeries];
        }

        if (cleanedSeries === 'gaminglegendsseries' && prices[priceCategory]['gaminglegends']) {
            return prices[priceCategory]['gaminglegends'];
        }
    }

    if (prices[priceCategory][rarity]) {
        return prices[priceCategory][rarity];
    }

    log.error(`No price found for rarity/series: ${series || rarity} in category: ${priceCategory}`);
    return prices[priceCategory]['rare'] || prices[priceCategory]['common'] || 999999;
}

function updatecfgomg(dailyItems, featuredItems) {
    const catalogConfig = { "//": "BR Item Shop Config" };

    dailyItems.forEach((item, index) => {
        catalogConfig[`daily${index + 1}`] = {
            itemGrants: formatitemgrantsyk(item),
            price: notproperpricegen(item)
        };
    });

    featuredItems.forEach((item, index) => {
        catalogConfig[`featured${index + 1}`] = {
            itemGrants: formatitemgrantsyk(item),
            price: notproperpricegen(item)
        };
    });

    fs.writeFileSync(catalogcfg, JSON.stringify(catalogConfig, null, 2), 'utf-8');
    log.AutoRotation("The item shop has rotated!");
}

async function fetchItemIcon(itemName) {
    try {
        const response = await axios.get(`https://fortnite-api.com/v2/cosmetics/br/search?name=${encodeURIComponent(itemName)}`);
        if (response.data && response.data.data && response.data.data.images && response.data.data.images.smallIcon) {
            return response.data.data.images.smallIcon;
        } else {
            log.error(`No small icon found for ${itemName}`);
            return null;
        }
    } catch (error) {
        log.error(`Error fetching icon for ${itemName}:`, error.message || error);
        return null;
    }
}

async function discordpost(itemShop) {
    const embeds = [];

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    async function formatItemEmbed(item, authorTitle = null) {
        const itemName = `**${capitalizeFirstLetter(item.name || "Unknown Item")}**`;
        const itemRarity = `Rarity: **${capitalizeFirstLetter(item.rarity?.displayValue || "Unknown")}**`;
        const itemPrice = `Price: **${notproperpricegen(item)} V-Bucks**`;
        const itemIcon = await fetchItemIcon(item.name);

        const embed = {
            title: itemName,
            color: 0x00FF7F,
            description: `${itemRarity}\n${itemPrice}`,
            thumbnail: {
                url: itemIcon || 'https://via.placeholder.com/150' // prevents crash with placeholder images
            }
        };

        if (authorTitle) {
            embed.author = { name: authorTitle };
        }

        return embed;
    }

    function getNextRotationTime() {
        const now = new Date();
        const [localHour, localMinute] = config.bRotateTime.split(':').map(Number);
        const nextRotation = new Date(now);

        nextRotation.setHours(localHour, localMinute, 0, 0);

        if (now >= nextRotation) {
            nextRotation.setDate(nextRotation.getDate() + 1);
        }

        return Math.floor(nextRotation.getTime() / 1000);
    }

    embeds.push({
        title: "Reload Item Shop",
        description: `These are the cosmetics for today!`,
        color: 0x00FF7F,
        fields: [],
    });

    if (itemShop.featured.length > 0) {
        for (const [index, item] of itemShop.featured.entries()) {
            const embed = await formatItemEmbed(item, index === 0 ? "Feature Item" : null);
            embeds.push(embed);
        }
    }

    if (itemShop.daily.length > 0) {
        for (const [index, item] of itemShop.daily.entries()) {
            const embed = await formatItemEmbed(item, index === 0 ? "Daily Item" : null);
            embeds.push(embed);
        }
    }

    const nextRotationTimestamp = getNextRotationTime();
    embeds.push({
        description: `The next shop will be updated at <t:${nextRotationTimestamp}:t>.`,
        color: 0x00FF7F
    });

    try {
        if (config.bEnableDiscordWebhook === true) {
            const chunkSize = 10;
            for (let i = 0; i < embeds.length; i += chunkSize) {
                const embedChunk = embeds.slice(i, i + chunkSize);
                const response = await axios.post(webhook, { embeds: embedChunk });
                log.AutoRotation(`Item shop posted successfully to Discord (chunk ${i / chunkSize + 1}):`, response.status);
            }
        }
    } catch (error) {
        log.error(`Error sending item shop to Discord: ${error.message}`);
        if (error.response && error.response.data) {
            log.error(`Discord API response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
}

function getItemsFromSet(items, setName) {
    return items.filter(item => {
        const itemSet = item.set?.value;
        return itemSet && itemSet.toLowerCase() === setName.toLowerCase();
    });
}

async function rotateshop() {
    try {
        const cosmetics = await fetchitems();
        if (cosmetics.length === 0) {
            log.error('No cosmetics found');
            return;
        }

        let dailyItems, featuredItems;

        const useSetSelection = Math.random() < 0.3;

        if (useSetSelection) {
            const sets = new Set(cosmetics.map(item => item.set?.value).filter(Boolean));
            const randomSet = Array.from(sets)[Math.floor(Math.random() * sets.size)];
            const setItems = getItemsFromSet(cosmetics, randomSet);
            
            featuredItems = pickRandomItems(setItems, featuredItemsCount);
            dailyItems = pickRandomItems(
                cosmetics.filter(item => !featuredItems.includes(item)), 
                dailyItemsCount
            );
        } else {
            dailyItems = pickRandomItems(cosmetics, dailyItemsCount);
            featuredItems = pickRandomItems(
                cosmetics.filter(item => !dailyItems.includes(item)), 
                featuredItemsCount
            );
        }

        updatecfgomg(dailyItems, featuredItems);
        await discordpost({ daily: dailyItems, featured: featuredItems });

        const nextRotationTime = milisecstillnextrotation();
        log.AutoRotation(`Next rotation in: ${nextRotationTime}ms`);
        
        setTimeout(rotateshop, nextRotationTime);
    } catch (error) {
        log.error('Error while rotating:', error.message || error);
    }
}

function getUTCTimeFromLocal(hour, minute) {
    const now = new Date();
    const localTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
    return new Date(localTime.toUTCString());
}

function milisecstillnextrotation() {
    const now = new Date();
    const [localHour, localMinute] = config.bRotateTime.toString().split(':').map(Number);
    const nextRotation = getUTCTimeFromLocal(localHour, localMinute);

    if (now.getTime() >= nextRotation.getTime()) {
        nextRotation.setUTCDate(nextRotation.getUTCDate() + 1);
    }

    const millisUntilNextRotation = nextRotation.getTime() - now.getTime();
    log.AutoRotation(`Current time: ${now.toUTCString()}`);
    log.AutoRotation(`Next rotation time (UTC): ${nextRotation.toUTCString()}`);
    log.AutoRotation(`Milliseconds until next rotation: ${millisUntilNextRotation}`);

    return millisUntilNextRotation;
}

setTimeout(rotateshop, milisecstillnextrotation());