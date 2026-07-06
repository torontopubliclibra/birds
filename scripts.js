const FEED_URL = "https://danateagle.com/data/feed.json";
const FEED_SOURCES = [
    {
        label: "direct",
        url: FEED_URL,
    },
    {
        label: "allorigins",
        url: `https://api.allorigins.win/raw?url=${encodeURIComponent(FEED_URL)}`,
    },
];
const exclusionList = [
    "289", "132"
]
const LOCAL_BIRD_IMAGES = Array.from({ length: 5 }, (_, index) => ({
    url: `/assets/birds-${index + 1}.png`,
    alt: "A photo of (a) bird(s).",
}));

function looksLikeImage(url) {
    return /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(url || "");
}

function shouldExcludeImage(url) {
    const normalizedUrl = String(url || "");
    return exclusionList.some((id) => normalizedUrl.includes(String(id)));
}

function shuffleArray(items) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
}

function appendBirdImage(container, imageUrl, altText) {
    const section = document.createElement("section");
    const image = document.createElement("img");

    image.alt = altText || "A photo of (a) bird(s).";
    image.className = "bird-pic";
    image.loading = "lazy";

    image.addEventListener("load", () => {
        const isPortrait = image.naturalHeight > image.naturalWidth;
        image.classList.toggle("bird-pic--portrait", isPortrait);
        image.classList.toggle("bird-pic--landscape", !isPortrait);
    });

    image.src = imageUrl;

    section.appendChild(image);
    container.appendChild(section);
}

async function parseJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.toLowerCase().includes("application/json")) {
        return response.json();
    }

    const text = await response.text();
    return JSON.parse(text);
}

async function fetchFeedJson() {
    let lastError = null;

    for (const source of FEED_SOURCES) {
        try {
            const response = await fetch(source.url, { cache: "no-store" });

            if (!response.ok) {
                throw new Error(`Failed to fetch feed from ${source.label}: ${response.status}`);
            }

            const data = await parseJsonResponse(response);

            if (source.label !== "direct") {
                console.info(`Loaded feed via ${source.label} fallback.`);
            }

            return data;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Unable to fetch feed from all configured sources.");
}

async function appendBirdImagesFromFeed() {
    const container = document.querySelector(".horizontal-scroll-container");

    if (!container) {
        return;
    }

    container.replaceChildren();

    let feedImages = [];

    try {
        const data = await fetchFeedJson();
        const items = Array.isArray(data?.items) ? data.items : [];

        const birdItems = items.filter((item) => {
            const tags = Array.isArray(item?.tags) ? item.tags : [];
            return tags.some((tag) => String(tag).toLowerCase() === "birds");
        });

        feedImages = birdItems.map((item) => {
            const primaryUrl = item?.url ? new URL(item.url, FEED_URL).href : "";
            const thumbnailUrl = item?.thumbnail ? new URL(item.thumbnail, FEED_URL).href : "";
            const imageUrl = looksLikeImage(primaryUrl) ? primaryUrl : thumbnailUrl;

            return {
                url: imageUrl,
                alt: item?.alt || "A photo of (a) bird(s).",
            };
        }).filter((item) => item.url && looksLikeImage(item.url) && !shouldExcludeImage(item.url));
    } catch (error) {
        console.error("Unable to append bird images from feed.", error);
    }

    const imageMap = new Map();

    [...LOCAL_BIRD_IMAGES, ...feedImages].forEach((item) => {
        if (!item?.url) {
            return;
        }

        if (shouldExcludeImage(item.url)) {
            return;
        }

        if (!imageMap.has(item.url)) {
            imageMap.set(item.url, item.alt || "A photo of (a) bird(s).");
        }
    });

    const shuffledImages = shuffleArray(
        Array.from(imageMap.entries(), ([url, alt]) => ({ url, alt }))
    );

    shuffledImages.forEach((item) => {
        appendBirdImage(container, item.url, item.alt);
    });
}

appendBirdImagesFromFeed();
