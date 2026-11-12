# Malayalam News Live Dashboard

A modern, high-performance web dashboard containing top Malayalam news channels streaming live on YouTube.

## Features
- **In-App Playback**: Stream channels directly inside a responsive player card without leaving the page, powered by the YouTube IFrame Player API.
- **Never Goes Stale**: Channels are keyed on their stable YouTube channel ID; the player embeds whatever stream is live right now via `live_stream?channel=` — no more dead video IDs when a channel restarts its stream.
- **Real Play/Pause**: The transport bar reflects actual player state — pause holds your position instead of tearing the stream down.
- **Glassmorphic UI**: Sleek, immersive dark mode design featuring smooth micro-animations.
- **Floating Transport Bar**: Prev/next/play-pause controls always in reach, with the active channel name and a quick link to the channel's live page on YouTube.
- **Auto-Skip Broken Streams**: If a channel's embed is unavailable (embedding disabled, stream down), playback hops to the next channel automatically.
- **Remembers Your Channel**: The last watched channel is restored on the next visit.
- **Keyboard Shortcuts**: `Space`/`K` toggles playback, `←`/`→` switch channels.

## How to Run
To prevent browser security policies from blocking local YouTube iframe embeds (Error 153), host the dashboard on a local port:

1. Open your terminal in this directory.
2. Run the launcher script:
   ```bash
   python3 start_dashboard.py
   ```
3. The dashboard will automatically launch at `http://localhost:8000/index.html`.

## Project Structure
- `index.html` — page markup
- `style.css` — styles
- `app.js` — playback logic, loaded as a native ES module (no build step, no dependencies)
