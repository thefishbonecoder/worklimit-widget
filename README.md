# WorkMeter

[![Release](https://img.shields.io/github/v/release/thefishbonecoder/worklimit-widget?display_name=tag)](https://github.com/thefishbonecoder/worklimit-widget/releases/latest)
[![License](https://img.shields.io/github/license/thefishbonecoder/worklimit-widget)](LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)

**WorkMeter keeps your ChatGPT Work and Codex usage limits visible directly in the browser, so you do not have to repeatedly open the usage settings page.**

WorkMeter is a lightweight, privacy-focused browser extension for Chromium-based browsers. It runs without its own server and stores only normalized usage values, settings and warning state locally in the browser extension storage.

> **Unofficial project:** WorkMeter is not affiliated with, endorsed by, or sponsored by OpenAI.

## Download

**[Download WorkMeter v1.0.0](https://github.com/thefishbonecoder/worklimit-widget/releases/download/v1.0.0/WorkMeter-Chromium-v1.0.0-release.zip)**

[View the latest release and release notes](https://github.com/thefishbonecoder/worklimit-widget/releases/latest)

## What WorkMeter shows

- Live display of the 5-hour and weekly usage limits
- Remaining percentage directly on the browser toolbar badge
- Reset countdown and local reset time
- Usage consumed during the current browser session
- Optional browser notifications at 25%, 10% and 0% remaining
- Available full resets and positive credits balance when ChatGPT exposes those values
- German and English popup and notification text

## Why WorkMeter

ChatGPT usage limits can matter during longer Work or Codex sessions. WorkMeter keeps the relevant information visible without requiring repeated navigation through ChatGPT settings.

The extension is intentionally small: no WorkMeter account, no advertising, no analytics and no external WorkMeter backend.

## Installation on Chrome, Edge and other Chromium browsers

1. Download the latest WorkMeter ZIP from the release link above.
2. Extract the ZIP file.
3. Open your browser's extensions page.
4. Enable **Developer mode**.
5. Choose **Load unpacked**.
6. Select the extracted WorkMeter folder.
7. Pin WorkMeter to the browser toolbar.
8. Open ChatGPT in the same browser and click the WorkMeter icon.

Common extension pages:

- Chrome: `chrome://extensions`
- Microsoft Edge: `edge://extensions`
- Brave: `brave://extensions`
- Opera: `opera://extensions`
- Vivaldi: `vivaldi://extensions`

## Supported browsers

| Browser | Status |
| --- | --- |
| Google Chrome | Supported via Chromium build |
| Microsoft Edge | Supported via Chromium build |
| Brave | Supported via Chromium build |
| Opera | Supported via Chromium build |
| Vivaldi | Supported via Chromium build |
| Firefox | Separate package not included yet |
| Safari | Packaging and signing not included |

## Privacy

WorkMeter is designed to work without its own server.

- No analytics
- No advertising
- No WorkMeter user account
- No password access
- No browser-history access
- No storage of ChatGPT session tokens or browser-cookie values
- Usage values and extension settings remain in local extension storage

For the complete privacy notice, see [PRIVACY.md](PRIVACY.md).

## How usage retrieval works

WorkMeter uses the ChatGPT session that is already active in the browser. A content script running only on ChatGPT pages requests usage data from ChatGPT and sends the normalized result to the extension background process.

If ChatGPT exposes an access token in its page bootstrap data, WorkMeter can use it for the request, but the token is never written to extension storage. If no token is exposed, the browser may attach the existing ChatGPT session credentials to the same-origin request automatically. WorkMeter never reads or stores the cookie values themselves.

The current usage interface is an undocumented ChatGPT backend endpoint and can change without notice. WorkMeter treats missing or changed data as unavailable instead of inventing values.

## Refresh behaviour

- Automatic refresh every 5 minutes while at least one ChatGPT tab is available
- Returning to a ChatGPT tab after a while can trigger another refresh
- Reconnecting to the network can trigger a refresh
- The **Refresh** button in the popup requests a fresh reading immediately
- If ChatGPT is not open, WorkMeter keeps the most recent valid reading instead of replacing it with an error

## Notifications

Notifications are optional and can be disabled in the WorkMeter popup.

For each usage cycle, WorkMeter can notify at:

- 25% remaining
- 10% remaining
- 0% remaining

Warning state is tracked locally to avoid repeated notifications for the same threshold in the same cycle.

## Technical details

- Manifest V3
- Chromium background service worker
- Local storage for normalized usage values, warning state, session baseline and settings
- Current usage endpoint: `/backend-api/wham/usage`
- Toolbar badge prioritizes the 5-hour window, then the longer available usage window
- Source code available in this repository
- MIT License

## Bugs and feature requests

Found a bug or have an idea for WorkMeter?

[Open a GitHub Issue](https://github.com/thefishbonecoder/worklimit-widget/issues/new)

When reporting a bug, include your browser, WorkMeter version and a short description of what happened. Do not post session tokens, cookies or other account credentials.

## Releases

The current public version is **v1.0.0**.

See [GitHub Releases](https://github.com/thefishbonecoder/worklimit-widget/releases) for downloads and version history.

## License

WorkMeter is released under the [MIT License](LICENSE).

## Disclaimer

WorkMeter is an unofficial independent project and is not affiliated with, endorsed by, or sponsored by OpenAI.

ChatGPT, Codex and OpenAI are trademarks or product names of their respective owner.
