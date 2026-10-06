# WorkMeter Privacy Policy

**Version 1.0.0**  
**Last updated: 3 October 2026**

WorkMeter is an unofficial browser extension that displays ChatGPT Work and Codex usage limits, reset times, local session usage and optional usage warnings.

WorkMeter is designed to work without a WorkMeter account, analytics service or external WorkMeter server.

## Data WorkMeter handles

WorkMeter stores only the following information in the browser's local extension storage when it is available from ChatGPT:

- normalized usage percentages;
- usage-window reset timestamps;
- the number of available full resets;
- a positive credits balance or unlimited-credit status, when exposed by ChatGPT;
- the last successful update time;
- local notification preferences and warning state;
- a local session baseline used to calculate usage consumed during the current browser session;
- the last local error state needed to explain why usage data could not be refreshed.

This information stays in the browser profile unless the user removes the extension, clears its local data, or the browser removes extension storage.

## ChatGPT authentication and session data

WorkMeter uses the ChatGPT session that is already active in the browser.

On ChatGPT pages, WorkMeter requests usage metadata from ChatGPT's own backend. Depending on the ChatGPT page state, the request can use either:

- the browser's existing same-origin ChatGPT session credentials; or
- an access token exposed by ChatGPT in its page bootstrap data.

If an access token is temporarily available, WorkMeter uses it only in memory for the usage request. WorkMeter does **not** write that token to extension storage and does **not** transmit it to any WorkMeter-operated server.

WorkMeter does not ask for, read or store the user's ChatGPT password. It does not intentionally read or store browser cookie values.

## Network communication

WorkMeter communicates only with ChatGPT/OpenAI pages required to retrieve usage information or open the official usage page:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

The current usage request uses ChatGPT's `/backend-api/wham/usage` interface. This is an undocumented backend interface and can change without notice.

WorkMeter does not send usage data to an external WorkMeter server.

## Browser permissions

WorkMeter requests only the permissions needed for its features:

- **storage**: stores normalized usage values, settings, warning state and the session baseline locally;
- **notifications**: shows optional warnings at configured usage thresholds;
- **alarms**: schedules periodic refresh attempts;
- **tabs**: finds an open ChatGPT tab, sends a refresh request to it, and opens the official ChatGPT usage page when requested;
- **host access to ChatGPT domains**: allows the extension to run its content script only on supported ChatGPT pages and retrieve usage metadata from ChatGPT.

WorkMeter does not use these permissions to read general browsing history or content from unrelated websites.

## Analytics, advertising and sale of data

WorkMeter does not include:

- analytics or behavioural tracking;
- advertising;
- third-party tracking pixels;
- sale of user data;
- transfer of usage data to data brokers;
- a WorkMeter cloud account.

## Notifications

If usage warnings are enabled, WorkMeter can generate local browser notifications when a supported usage window reaches 25%, 10% or 0% remaining. Warning state is stored locally to avoid repeated notifications during the same usage cycle.

## Clearing local data

The WorkMeter popup includes a **Clear local data** action. This removes cached usage values, warning state and local connection/error state from the extension's storage and resets the local session baseline.

Removing the extension through the browser also removes its extension storage according to the browser's normal extension-removal behaviour.

## Data retention

WorkMeter keeps local usage information only for as long as it remains in the browser's extension storage. WorkMeter has no external database containing this information.

## Third-party service

ChatGPT and OpenAI are third-party services operated by OpenAI. Their own privacy terms and data practices apply independently of WorkMeter.

## Changes to this policy

If WorkMeter's data handling changes, this privacy policy must be updated before the changed version is publicly released.

## Unofficial project notice

WorkMeter is unofficial and is not affiliated with, endorsed by, or sponsored by OpenAI.

ChatGPT, Codex and OpenAI are trademarks or product names of their respective owner.
