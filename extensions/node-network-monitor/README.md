# Node Network Monitor

Capture outgoing `fetch`/`http`/`https` requests made by a Node.js backend and inspect method, URL, status, headers, and bodies in a sidebar panel — without changing your backend's source code.

## How it works

A completely unmodified, already-running Node.js process cannot be inspected retroactively (on Windows in particular, there is no equivalent of the Unix `SIGUSR1` trick to enable the inspector after the fact). This extension instead offers two ways to capture traffic, both of which involve (re-)starting the process through the extension:

1. **Preload hook (recommended).** The extension starts your backend with a small tracer module preloaded (via `NODE_OPTIONS=--require`/`--import`). The tracer patches global `fetch` and the `http`/`https` client APIs using Node's own function-wrapping mechanism — no experimental flags required, works on any reasonably recent Node version.
2. **CDP attach.** If your backend is already running with `--inspect --experimental-network-inspection`, use **Node Network Monitor: Attach to Running Process (CDP)** to connect via the Chrome DevTools Protocol Network domain instead.

## Usage

- **From a `launch.json` debug config:** add `"nodeNetworkMonitor": true` to any `node`/`pwa-node` configuration, then press F5. The extension injects the tracer and the required env vars automatically.
- **From a terminal command:** run **Node Network Monitor: Run Command with Monitor...** from the Command Palette, enter a command (e.g. `npm run dev`), and it runs in a new terminal with capturing enabled.
- **From the terminal panel's profile dropdown:** click the chevron next to the "+" in the Terminal panel and pick **Node Network Monitor** — this opens a plain, ready shell with monitoring env vars pre-injected (same as the built-in "JavaScript Debug Terminal"), and you type whatever command you want yourself.
- **Attach to an already-running `--inspect` process:** run **Node Network Monitor: Attach to Running Process (CDP)...** and enter `host:port`.

If a terminal opened via **Run Command with Monitor** doesn't seem to run anything, check **Node Network Monitor: Show Log** — it prints the resolved `NODE_OPTIONS`, every tracer connection, and every captured request/response, which is the fastest way to tell where things are getting stuck.

Captured requests appear in the **Node Network Monitor** view in the Activity Bar as soon as they complete. Click a row to see request/response headers and bodies. Use the toolbar to clear the list or pause/resume capturing.

## Panel features

- **JSON bodies** are pretty-printed and syntax-highlighted automatically (whenever a body parses as JSON, regardless of its `Content-Type`), with a **Raw** toggle to see exactly what was sent/received.
- **Image responses** (`Content-Type: image/*`) are decoded and shown inline, with dimensions and size — click an image to view it at full size.
- Other binary bodies are shown as a byte-size note with a **Copy base64** button rather than corrupted text.
- **Copy as cURL** on any entry reproduces the request (method, URL, headers) as a runnable `curl` command.
- Headers and bodies each have their own **Copy** button; the list shows method, status, content type, URL, duration, and time at a glance.
- Drag the divider between the list and the detail panel to resize them.
- `nodeNetworkMonitor.maxBodyBytes` defaults to 2 MB specifically so most images aren't truncated before they can be previewed; a body truncated past that limit shows a note instead of a broken preview.

## Settings

| Setting                            | Default                                                             | Description                                                                             |
| ----------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `nodeNetworkMonitor.captureBodies` | `true`                                                              | Capture request/response bodies in addition to headers.                                 |
| `nodeNetworkMonitor.maxBodyBytes`  | `2000000`                                                           | Bytes captured per body before truncation (kept high so images can still be previewed). |
| `nodeNetworkMonitor.maxEntries`    | `500`                                                               | Requests kept in the panel before the oldest are evicted.                               |
| `nodeNetworkMonitor.redactHeaders` | `authorization, cookie, set-cookie, proxy-authorization, x-api-key` | Header names masked as `[redacted]`.                                                    |

## Known limitations

- Cannot attach to a process that wasn't started (or restarted) through the extension — this is a platform constraint, not a missing feature.
- WebSocket traffic and HTTP/2 are not captured in this version.
- `fetch` bodies are only captured when passed as a `string`, `Uint8Array`/`Buffer`, or `URLSearchParams` — streamed, `Blob`, or `FormData` request bodies are not captured (the response side is unaffected).
- CDP mode depends on Node's `--experimental-network-inspection` flag, which is still experimental and may change between Node versions.
