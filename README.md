# Malayalam News Live Dashboard

A modern, high-performance web dashboard containing top Malayalam news channels streaming live on YouTube.

## Features
- **In-App Playback**: Stream channels directly inside a responsive video modal overlay without leaving the page.
- **Glassmorphic UI**: Sleek, immersive dark mode design featuring smooth micro-animations.
- **Live Search**: Instant keyword filtering across channel names and stream descriptions.
- **Auto-Mute Bypass**: Prevents modern browsers from blocking playback by starting muted (unmute with a single click inside the player).

## How to Run
To prevent browser security policies from blocking local YouTube iframe embeds (Error 153), host the dashboard on a local port:

1. Open your terminal in this directory.
2. Run the launcher script:
   ```bash
   python3 start_dashboard.py
   ```
3. The dashboard will automatically launch at `http://localhost:8000/index.html`.
