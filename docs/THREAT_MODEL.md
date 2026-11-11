# Threat model v0

| Boundary | Data and handling |
| --- | --- |
| YouTube page → content script | URL, Watch capability markers and live media time. The host page can change these values. Verify route identity and capability on each action. |
| Content script → clipboard | Canonical YouTube link after a trusted click. Clipboard failure exposes the same text for manual copy. |
| Content script and popup → extension storage | Two local booleans. No history or timestamps. Browser removal clears local extension storage. |
| Extension → network | No fetch, remote assets, bridge or backend in this slice. |

Missing or ambiguous capability should leave the page native. Review navigation races, stale native media, host-injected DOM and interactions with other extensions before release.
