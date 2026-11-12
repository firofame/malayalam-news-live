/* Malayalam News Live — app.js (ES module) */

/* Channels are keyed on the stable channel ID (UC…). The embed resolves
   whatever stream is live right now via live_stream?channel=, so playback
   keeps working when a channel restarts its live stream and the video ID
   changes. */
const channels = [
    { display: "REPORTER LIVE", channelId: "UCFx1nseXKTc1Culiu3neeSQ", handle: "reporterlive" },
    { display: "Asianet News", channelId: "UCf8w5m0YsRa8MHQ5bwSGmbw", handle: "asianetnews" },
    { display: "24 News", channelId: "UCup3etEdjyF1L3sRbU-rKLw", handle: "24OnLive" },
    { display: "BIG TV", channelId: "UClFe5TPbW1MVrOPpbNHTDoQ", handle: "bigtv24x7live" },
    { display: "News Malayalam 24x7", channelId: "UCXp6JTdq7-WwBK09S7SzmxQ", handle: "newsmalayalamtv" },
    { display: "Manorama News", channelId: "UCP0uG-mcMImgKnJz-VjJZmQ", handle: "manoramanews" },
    { display: "Mathrubhumi News", channelId: "UCwXrBBZnIh2ER4lal6WbAHw", handle: "TVMathrubhumi" },
    { display: "Kairali News", channelId: "UCnEvxaWfVL91XIYuyQRO5QA", handle: "kairalinews" },
    { display: "MediaOne TV", channelId: "UC-f7r46JhYv78q5pGrO6ivA", handle: "MediaoneTVLive" },
    { display: "Janam TV", channelId: "UCNVkxRPqsBNejO6B9thG9Xw", handle: "tvjanam" },
    { display: "News18 Kerala", channelId: "UC-mMi78WJST4N5o8_i1FoXw", handle: "News18Kerala" }
];

const STORAGE_KEY = "mnl:lastChannelId";

const quickRail = document.getElementById("quickRail");
const videoShell = document.getElementById("videoShell");
const poster = document.getElementById("poster");
const clock = document.getElementById("clock");
const fabExternal = document.getElementById("fabExternal");
const fabBtn = document.getElementById("fabPlayPause");
const fabPrev = document.getElementById("fabPrev");
const fabNext = document.getElementById("fabNext");
const fabChannelName = document.getElementById("fabChannelName");

let activeIndex = loadLastIndex();
let player = null; // YouTube IFrame API player (null until first play / fallback)
let isPlaying = false;
let consecutiveErrors = 0;

/* ── YouTube IFrame API loading ──
   Resolves with `window.YT` once ready, or null if the API can't load
   (e.g. offline) — in that case we fall back to plain iframe swapping. */
const ytApiPromise = new Promise(resolve => {
    if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return;
    }
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
    // Settle anyway if the API never signals readiness.
    setTimeout(() => resolve(window.YT && window.YT.Player ? window.YT : null), 8000);
});

/* ── URL helpers ── */

function youtubeEmbedUrl(channel, forApi = false) {
    const params = new URLSearchParams({
        autoplay: "1",
        playsinline: "1",
        rel: "0"
    });
    if (forApi) {
        params.set("enablejsapi", "1");
        params.set("origin", window.location.origin);
    }
    return `https://www.youtube.com/embed/live_stream?channel=${channel.channelId}&${params}`;
}

function channelLiveUrl(channel) {
    return `https://www.youtube.com/@${channel.handle}/live`;
}

function activeChannel() {
    return channels[activeIndex];
}

function loadLastIndex() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const index = channels.findIndex(channel => channel.channelId === saved);
    return index >= 0 ? index : 0;
}

function saveLastIndex() {
    try {
        localStorage.setItem(STORAGE_KEY, channels[activeIndex].channelId);
    } catch {
        /* storage unavailable (private mode etc.) — ignore */
    }
}

function updatePosterThumb(videoId) {
    if (!videoId) return;
    poster.style.backgroundImage =
        `linear-gradient(135deg, rgba(255, 75, 62, 0.78), rgba(9, 14, 24, 0.5)), ` +
        `url("https://i.ytimg.com/vi/${videoId}/hqdefault.jpg")`;
}

/* ── Player (YouTube IFrame API) ── */

function createPlayer(channel) {
    const iframe = document.createElement("iframe");
    iframe.id = "yt-player";
    iframe.title = `${channel.display} live stream`;
    iframe.src = youtubeEmbedUrl(channel, true);
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    videoShell.appendChild(iframe);

    // The target element is an existing iframe, so the API attaches to it
    // instead of replacing it.
    player = new YT.Player("yt-player", {
        events: {
            onReady: event => event.target.playVideo(),
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });
}

function onPlayerStateChange(event) {
    switch (event.data) {
        case window.YT.PlayerState.PLAYING: {
            isPlaying = true;
            consecutiveErrors = 0;
            poster.classList.add("hidden");
            // live_stream embeds resolve to the current live video —
            // grab its ID for the poster thumbnail.
            const videoId = player?.getVideoData?.()?.video_id;
            updatePosterThumb(videoId);
            break;
        }
        case window.YT.PlayerState.PAUSED:
            isPlaying = false;
            break;
        case window.YT.PlayerState.ENDED:
            goNext(); // stream ended — hop to the next channel
            break;
    }
    updateFabState();
}

function onPlayerError() {
    // Stream unavailable (embedding disabled, offline, etc.) — move on.
    consecutiveErrors += 1;
    if (consecutiveErrors >= channels.length) {
        consecutiveErrors = 0;
        isPlaying = false;
        updateFabState();
        return;
    }
    goNext();
}

/* ── Fallback playback (no IFrame API — plain iframe swap) ── */

function fallbackPlay(channel) {
    videoShell.querySelector("iframe")?.remove();
    const iframe = document.createElement("iframe");
    iframe.title = `${channel.display} live stream`;
    iframe.src = youtubeEmbedUrl(channel);
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    videoShell.appendChild(iframe);
    poster.classList.add("hidden");
    isPlaying = true;
}

function fallbackPause() {
    videoShell.querySelector("iframe")?.remove();
    poster.classList.remove("hidden");
    isPlaying = false;
}

/* ── Playback control ── */

async function playChannel(index, shouldScroll = true) {
    if (index < 0 || index >= channels.length) return;

    activeIndex = index;
    const channel = activeChannel();
    saveLastIndex();

    fabExternal.href = channelLiveUrl(channel);
    renderRail();
    poster.classList.add("hidden");

    const YT = await ytApiPromise;
    if (YT) {
        // Channel-live embeds can't use loadVideoById — recreate instead.
        if (player) {
            player.destroy();
            player = null;
        }
        videoShell.querySelector("iframe")?.remove();
        createPlayer(channel);
        isPlaying = true; // confirmed by onStateChange
    } else {
        fallbackPlay(channel);
    }

    updateFabState();

    if (shouldScroll) {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function togglePlayback() {
    if (isPlaying) {
        if (player) {
            player.pauseVideo();
        } else {
            fallbackPause();
        }
        isPlaying = false;
    } else {
        playChannel(activeIndex, false);
    }
    updateFabState();
}

function goNext() {
    playChannel((activeIndex + 1) % channels.length, false);
}

function goPrev() {
    playChannel((activeIndex - 1 + channels.length) % channels.length, false);
}

/* ── UI ── */

function renderRail() {
    quickRail.innerHTML = channels.map(channel => `
        <button class="chip ${channel.channelId === activeChannel().channelId ? "active" : ""}" type="button" data-index="${channels.indexOf(channel)}">
            ${channel.display}
        </button>
    `).join("");
}

function updateFabState() {
    fabBtn.classList.toggle("is-playing", isPlaying);
    fabBtn.setAttribute("aria-label", isPlaying ? "Pause stream" : "Play stream");
    fabChannelName.textContent = activeChannel().display;
    fabExternal.href = channelLiveUrl(activeChannel());
}

function triggerRipple(btn) {
    const ripple = btn.querySelector(".fab-ripple");
    if (!ripple) return;
    ripple.classList.remove("animate");
    void ripple.offsetWidth;
    ripple.classList.add("animate");
}

function updateClock() {
    clock.textContent = new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(new Date());
}

/* ── Events ── */

quickRail.addEventListener("click", event => {
    const button = event.target.closest(".chip");
    if (!button) return;
    playChannel(Number(button.dataset.index));
});

poster.addEventListener("click", () => {
    playChannel(activeIndex, false);
});

fabBtn.addEventListener("click", () => {
    triggerRipple(fabBtn);
    togglePlayback();
});

fabPrev.addEventListener("click", () => {
    triggerRipple(fabPrev);
    goPrev();
});

fabNext.addEventListener("click", () => {
    triggerRipple(fabNext);
    goNext();
});

document.addEventListener("keydown", event => {
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A" || event.target.isContentEditable) return;

    switch (event.key) {
        case " ":
        case "k":
        case "K":
            event.preventDefault();
            togglePlayback();
            break;
        case "ArrowLeft":
            event.preventDefault();
            triggerRipple(fabPrev);
            goPrev();
            break;
        case "ArrowRight":
            event.preventDefault();
            triggerRipple(fabNext);
            goNext();
            break;
    }
});

/* ── Init ── */

renderRail();
updateClock();
setInterval(updateClock, 30000);
updateFabState();
