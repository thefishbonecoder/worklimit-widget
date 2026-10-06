# WorkMeter

WorkMeter is an unofficial, privacy-focused browser extension that keeps ChatGPT Work and Codex usage limits visible without repeatedly opening the ChatGPT usage settings page.

## Version 1.0.0

WorkMeter focuses on five practical features:

1. Live display of the 5-hour and weekly usage limits.
2. Reset countdown plus the local reset clock time.
3. Optional browser notifications at 25%, 10% and 0% remaining.
4. The remaining short-window percentage shown directly on the browser toolbar badge.
5. Usage consumed during the current browser session.

When OpenAI exposes the values, WorkMeter also shows the number of available full resets and a positive credits balance.

## Privacy

WorkMeter is designed to work without its own server.

- No analytics.
- No advertising.
- No user account for WorkMeter.
- No password access.
- No browser-history access.
- No storage of ChatGPT session tokens or browser-cookie values.
- Usage values and extension settings stay in local extension storage.

See `PRIVACY.md` for the full privacy notice.

## How usage retrieval works

WorkMeter uses the ChatGPT session that is already active in the browser. A content script running only on ChatGPT pages requests the usage data from ChatGPT and sends the normalized result to the extension background process.

If ChatGPT exposes an access token in its page bootstrap data, WorkMeter can use it for the request, but the token is never written to extension storage. If no token is exposed, the browser may attach the existing ChatGPT session credentials to the same-origin request automatically. WorkMeter never reads or stores the cookie values themselves.

The current usage interface is an undocumented ChatGPT backend endpoint and can change without notice. WorkMeter therefore treats missing or changed data as unavailable instead of inventing values.

## Supported browsers

### Chromium build

The Chromium build is intended for:

- Google Chrome
- Microsoft Edge
- Brave
- Opera
- Vivaldi

### Firefox

A separate Firefox package is not included in this release. Firefox support can be prepared and tested in a later release before distribution through Mozilla Add-ons.

### Safari

The core code is written as a WebExtension, but Safari store packaging and signing require macOS and Xcode and are not included in this release.

## Install on Chromium browsers for local testing

1. Extract the WorkMeter Chromium package.
2. Open the browser extensions page.
3. Enable developer mode.
4. Choose **Load unpacked**.
5. Select the extracted WorkMeter folder.
6. Pin WorkMeter to the toolbar.
7. Open ChatGPT in the same browser.
8. Open WorkMeter. The extension reads the usage data from the existing ChatGPT session.

Common extension pages:

- Chrome: `chrome://extensions`
- Edge: `edge://extensions`
- Brave: `brave://extensions`
- Opera: `opera://extensions`
- Vivaldi: `vivaldi://extensions`

## Refresh behaviour

- WorkMeter refreshes automatically every 5 minutes while at least one ChatGPT tab is available.
- Returning to a ChatGPT tab after a while can trigger an additional refresh.
- Reconnecting to the network can trigger a refresh.
- Pressing **Refresh** in the popup requests a fresh reading immediately.
- If ChatGPT is not open, WorkMeter keeps the most recent valid reading instead of replacing it with an error.

## Notifications

Notifications are optional and can be disabled in the WorkMeter popup.

For each usage cycle, WorkMeter can notify at:

- 25% remaining
- 10% remaining
- 0% remaining

WorkMeter tracks warning state locally to avoid repeated notifications for the same threshold in the same cycle.

## Session usage

The **This session** value compares the current usage window with the baseline captured when the browser session starts. A real usage-window reset starts a new baseline for that specific window. Small changes in the reported reset timestamp are tolerated so they do not incorrectly reset the session counter.

## Technical notes

- Manifest V3.
- Chromium background service worker.
- Background service worker structured for future cross-browser adaptation.
- Local storage only for normalized usage values, warning state, session baseline and settings.
- Usage endpoint: `/backend-api/wham/usage`.
- Toolbar badge prioritizes the 5-hour window, then the longer available usage window.
- German and English popup/notification text.

## Disclaimer

WorkMeter is unofficial and is not affiliated with, endorsed by, or sponsored by OpenAI.

ChatGPT, Codex and OpenAI are trademarks or product names of their respective owner.
