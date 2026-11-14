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
const VOLUME_KEY = "mnl:volume";

const quickRail = document.getElementById("quickRail");
const videoShell = document.getElementById("videoShell");
const poster = document.getElementById("poster");
const clock = document.getElementById("clock");
const volumeControl = document.getElementById("volumeControl");
const volumeBtn = document.getElementById("volumeBtn");
const volumeSlider = document.getElementById("volumeSlider");

let activeIndex = loadLastIndex();
let player = null; // YouTube IFrame API player (null until first play / fallback)
let playerReady = false; // volume/setVolume calls need onReady to have fired
let isPlaying = false;
let consecutiveErrors = 0;
let volume = 100; // 0–100, as persisted
let muted = false;
let volumeBeforeSilence = 100; // restores when unmuting from zero

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
        rel: "0",
        // Strip YouTube's own player chrome — the app provides the
        // play/pause control, keyboard shortcuts stay on Space/K and the
        // channel arrows.
        controls: "0",
        disablekb: "1",
        fs: "0",
        iv_load_policy: "3"
    });
    if (forApi) {
        params.set("enablejsapi", "1");
        params.set("origin", window.location.origin);
    }
    return `https://www.youtube.com/embed/live_stream?channel=${channel.channelId}&${params}`;
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

/* ── Volume (YouTube IFrame API only — the fallback iframe exposes no
   volume control, so the UI stays hidden in that mode) ── */

function loadVolumeState() {
    try {
        const saved = JSON.parse(localStorage.getItem(VOLUME_KEY));
        if (saved && Number.isFinite(saved.volume)) {
            volume = Math.min(100, Math.max(0, Math.round(saved.volume)));
        }
        muted = saved?.muted === true;
    } catch {
        /* unreadable/no storage — keep defaults */
    }
}

function persistVolume() {
    try {
        localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume, muted }));
    } catch {
        /* storage unavailable — ignore */
    }
}

function applyVolume() {
    if (!player || !playerReady) return;
    // Keep the player's internal level at `volume` and drive silence via
    // the mute flag, so unmuting restores exactly what was set before.
    player.setVolume(volume);
    if (muted) {
        player.mute();
    } else {
        player.unMute();
    }
}

function setVolumeLevel(value) {
    volume = Math.min(100, Math.max(0, Math.round(value)));
    if (volume > 0) {
        muted = false; // dragging the slider while muted unmutes
        volumeBeforeSilence = volume;
    }
    applyVolume();
    persistVolume();
    updateVolumeUI();
}

function toggleMute() {
    if (muted || volume === 0) {
        muted = false;
        if (volume === 0) volume = Math.max(volumeBeforeSilence, 40);
    } else {
        volumeBeforeSilence = volume;
        muted = true;
    }
    applyVolume();
    persistVolume();
    updateVolumeUI();
}

function updateVolumeUI() {
    const shown = muted ? 0 : volume;
    const silent = muted || volume === 0;
    volumeSlider.value = String(shown);
    volumeSlider.style.setProperty("--fill", `${shown}%`);
    volumeControl.classList.toggle("is-muted", silent);
    volumeBtn.setAttribute("aria-label", silent ? "Unmute stream" : "Mute stream");
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
    playerReady = false;
    player = new YT.Player("yt-player", {
        events: {
            onReady: event => {
                playerReady = true;
                applyVolume(); // fresh embed starts unmuted at 100 — restore preference
                event.target.playVideo();
            },
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
    updatePlayState();
}

function onPlayerError() {
    // Stream unavailable (embedding disabled, offline, etc.) — move on.
    consecutiveErrors += 1;
    if (consecutiveErrors >= channels.length) {
        consecutiveErrors = 0;
        isPlaying = false;
        updatePlayState();
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

    renderRail();
    poster.classList.add("hidden");

    const YT = await ytApiPromise;
    if (YT) {
        // Channel-live embeds can't use loadVideoById — recreate instead.
        if (player) {
            player.destroy();
            player = null;
            playerReady = false;
        }
        videoShell.querySelector("iframe")?.remove();
        createPlayer(channel);
        isPlaying = true; // confirmed by onStateChange
    } else {
        fallbackPlay(channel);
    }

    updatePlayState();

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
    updatePlayState();
}

function goNext() {
    playChannel((activeIndex + 1) % channels.length, false);
}

function goPrev() {
    playChannel((activeIndex - 1 + channels.length) % channels.length, false);
}

/* ── UI ── */

function renderRail() {
    const track = quickRail.querySelector(".rail-track");
    const scrollLeft = track.scrollLeft;
    track.innerHTML = channels.map((channel, index) => `
        <button class="chip ${channel.channelId === activeChannel().channelId ? "active" : ""}" type="button" data-index="${index}" data-name="${channel.display}">
            <img class="chip-logo" src="https://unavatar.io/youtube/${channel.handle}" alt="" loading="lazy" referrerpolicy="no-referrer">
            <span class="chip-name">${channel.display}</span>
        </button>
    `).join("");
    track.querySelectorAll(".chip").forEach((chip, index) => {
        const logo = chip.querySelector(".chip-logo");
        logo.addEventListener("error", () => {
            const fallback = document.createElement("span");
            fallback.className = "chip-logo-fallback";
            fallback.textContent = channels[index].display.charAt(0);
            logo.replaceWith(fallback);
        }, { once: true });
    });
    track.scrollLeft = scrollLeft;
    updateRailFades();
}

/* Desktop floating rail: fade an edge while more chips are hidden in
   that direction. */
function updateRailFades() {
    const track = quickRail.querySelector(".rail-track");
    if (!track) return;
    const hidden = track.scrollWidth - track.clientWidth;
    quickRail.classList.toggle("can-scroll-left", track.scrollLeft > 2);
    quickRail.classList.toggle("can-scroll-right", track.scrollLeft < hidden - 2);
}

/* Desktop stage: when the window is wider than 16:9, the video docks to
   the left edge at its native ratio and the leftover strip becomes the
   channel dock — logos only when the strip is narrow. */
function updateStageLayout() {
    const leftover = window.innerWidth - window.innerHeight * (16 / 9);
    document.body.classList.toggle("stage-side", leftover >= 76);
    document.body.classList.toggle("stage-wide", leftover >= 208);
    // Side dock too thin for a slider — collapse volume to a mute button.
    document.body.classList.toggle("dock-narrow", leftover < 128);
}

function updatePlayState() {
    document.querySelectorAll(".play-toggle").forEach(btn => {
        btn.classList.toggle("is-playing", isPlaying);
        btn.setAttribute("aria-label", isPlaying ? "Pause stream" : "Play stream");
    });
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

volumeBtn.addEventListener("click", toggleMute);
volumeSlider.addEventListener("input", () => setVolumeLevel(Number(volumeSlider.value)));

document.addEventListener("scroll", updateRailFades, { capture: true, passive: true });
window.addEventListener("resize", updateRailFades);
window.addEventListener("resize", updateStageLayout);

document.querySelectorAll(".play-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
        triggerRipple(btn);
        togglePlayback();
    });
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
            goPrev();
            break;
        case "ArrowRight":
            event.preventDefault();
            goNext();
            break;
        case "ArrowUp":
            event.preventDefault();
            setVolumeLevel(volume + 5);
            break;
        case "ArrowDown":
            event.preventDefault();
            setVolumeLevel(volume - 5);
            break;
        case "m":
        case "M":
            toggleMute();
            break;
    }
});

/* ── Init ── */

renderRail();
updateClock();
setInterval(updateClock, 30000);
updatePlayState();
loadVolumeState();
updateVolumeUI();
updateStageLayout();
// Volume needs the IFrame API — keep it hidden in fallback mode.
ytApiPromise.then(YT => document.body.classList.toggle("api-ready", Boolean(YT)));
if (document.fonts?.ready) {
    document.fonts.ready.then(updateRailFades); // chip widths settle after the font swap
}
