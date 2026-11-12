/* Malayalam News Live — app.js (ES module) */

const channels = [
    { display: "REPORTER LIVE", videoId: "nObUcHKZEGY" },
    { display: "Asianet News", videoId: "s0LLVQeMmtU" },
    { display: "24 News", videoId: "1wECsnGZcfc" },
    { display: "BIG TV", videoId: "HRvY9DoJ_qI" },
    { display: "News Malayalam 24x7", videoId: "P9MITjM250c" },
    { display: "Manorama News", videoId: "tgBTspqA5nY" },
    { display: "Mathrubhumi News", videoId: "RbxEftGN584" },
    { display: "Kairali News", videoId: "yiiqRHY1Bl8" },
    { display: "MediaOne TV", videoId: "-8d8-c0yvyU" },
    { display: "Janam TV", videoId: "T9Ol2JHqKlM" },
    { display: "News18 Kerala", videoId: "7Y-MMzEcjeA" }
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

/* ── Helpers ── */

function youtubeWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

function activeChannel() {
    return channels[activeIndex];
}

function loadLastIndex() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const index = channels.findIndex(channel => channel.videoId === saved);
    return index >= 0 ? index : 0;
}

function saveLastIndex() {
    try {
        localStorage.setItem(STORAGE_KEY, channels[activeIndex].videoId);
    } catch {
        /* storage unavailable (private mode etc.) — ignore */
    }
}

function updatePosterThumb(channel) {
    poster.style.backgroundImage =
        `linear-gradient(135deg, rgba(255, 75, 62, 0.78), rgba(9, 14, 24, 0.5)), ` +
        `url("https://i.ytimg.com/vi/${channel.videoId}/hqdefault.jpg")`;
}

/* ── Player (YouTube IFrame API) ── */

async function ensurePlayer(channel) {
    if (player) return player;
    const YT = await ytApiPromise;
    if (!YT) return null;

    const mount = document.createElement("div");
    mount.id = "yt-player";
    videoShell.appendChild(mount);

    player = new YT.Player("yt-player", {
        videoId: channel.videoId,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
            onReady: event => event.target.playVideo(),
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });
    return player;
}

function onPlayerStateChange(event) {
    switch (event.data) {
        case window.YT.PlayerState.PLAYING:
            isPlaying = true;
            consecutiveErrors = 0;
            poster.classList.add("hidden");
            break;
        case window.YT.PlayerState.PAUSED:
            isPlaying = false;
            break;
        case window.YT.PlayerState.ENDED:
            goNext(); // stream/VOD ended — hop to the next channel
            break;
    }
    updateFabState();
}

function onPlayerError() {
    // Video unavailable (embedding disabled, stream down, etc.) — move on.
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
    iframe.src = `https://www.youtube.com/embed/${channel.videoId}?autoplay=1&playsinline=1&rel=0`;
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

    fabExternal.href = youtubeWatchUrl(channel.videoId);
    updatePosterThumb(channel);
    renderRail();

    if (player) {
        poster.classList.add("hidden");
        player.loadVideoById(channel.videoId);
        isPlaying = true; // confirmed by onStateChange
    } else if (await ensurePlayer(channel)) {
        poster.classList.add("hidden");
        isPlaying = true;
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
        <button class="chip ${channel.videoId === activeChannel().videoId ? "active" : ""}" type="button" data-index="${channels.indexOf(channel)}">
            ${channel.display}
        </button>
    `).join("");
}

function updateFabState() {
    fabBtn.classList.toggle("is-playing", isPlaying);
    fabBtn.setAttribute("aria-label", isPlaying ? "Pause stream" : "Play stream");
    fabChannelName.textContent = activeChannel().display;
    fabExternal.href = youtubeWatchUrl(activeChannel().videoId);
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
