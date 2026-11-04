# SONORA — your music, another era ✳

A nostalgic, responsive music room with five animated retro players: **iPod Classic**, **Cassette Walkman**, **CD Discman**, **Vinyl Turntable** and **Retro Boombox**. Choose Pearl, Midnight, Blush, Mint or Orange.

## Music sources

| Source | Actual function |
| --- | --- |
| [Audius](https://audius.co/) | Search independent full songs and play streamable tracks through Audius official API. |\n| [Radio Browser](https://docs.radio-browser.info/) | Stream worldwide HTTPS live radio stations. Browser compatibility and station uptime vary. |
| Local audio files | Play your own MP3, WAV, M4A and other browser-supported audio directly on your device. Nothing is uploaded. |
| [Spotify official embeds](https://developer.spotify.com/documentation/embeds) | Paste a Spotify URL and listen through Spotify's own embedded player. Provider restrictions apply. |
| [YouTube official embeds](https://developers.google.com/youtube/iframe_api_reference) | Paste a video/playlist link. Playback stays inside YouTube's player. |
| [SoundCloud widget](https://developers.soundcloud.com/docs/api/html5-widget) | Paste a SoundCloud track link. Playback stays in its widget. |
| [Apple iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html) | Discover artists, songs and artwork, with official store links. **No copyrighted streaming or preview playback.** |

**Licensing:** Apple restricts promotional previews from use as a general music player. Audius tracks offer full playback when available and streamable. External provider embeds have their own controls and may require account access. The retro physical controls work with live radio and local files only. No scraping or DRM bypass.

## Start locally

Requires Node.js 20+. No dependencies, API keys or database.

- Start: **npm run dev**
- Open: http://localhost:4173
- Syntax check: **npm run check**
- Unit tests: **npm test**

The tiny local server implements the same public API routes as Vercel. API endpoints: /api/audius?q=, /api/radio?q=, /api/catalog?q= and /api/health.

## Deploy

Import this repository into Vercel using the **Other** framework preset and no build command. Static files are served from the root, and the api/ directory contains serverless endpoints. Designed for the free Hobby tier.

## Controls and privacy

On iPod, use MENU, turn the wheel to scroll/seek/adjust volume, and press the center to select a queued song. Other vintage players have their own working media buttons. Space toggles play, left/right switch tracks, M opens iPod menu and / focuses search.

Shuffle, repeat, queue management, favorites and recently played stations are included. Device/skin and radio favorites are stored locally in your browser; imported audio files last only for the active tab session. External embeds can set provider cookies. Not affiliated with Apple, Spotify or other providers.

Created for [Rishikeshsanin](https://github.com/Rishikeshsanin).
