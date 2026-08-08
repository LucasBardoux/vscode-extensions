# Changelog

## 0.0.3

- Fixed captured `http`/`https` request URLs missing the port (shown as `localhost` instead of `localhost:3000`) in both the panel list and "Copy as cURL", caused by Node's `ClientRequest.host` not including the port; the port is now read from the `Host` header instead.
- Redesigned the activity bar icon to match the extension's logo (monitor with a heartbeat/pulse trace).

## 0.0.2

- Version bump only; no functional changes recorded in this history.

## 0.0.1

- Initial version: capture outgoing `fetch`/`http`/`https` traffic via a preload tracer or CDP attach, view method/headers/bodies in a sidebar panel.
- Fixed the preload tracer hanging `npm run <script>` entirely by skipping instrumentation of the package manager's own internal Node processes.
- Fixed `--require`/`--import` injection reliability on Windows (path escaping, terminal shell-integration timing).
- Added a "Node Network Monitor" terminal profile and an output log (`Node Network Monitor: Show Log`) for diagnostics.
- Reworked the panel UI: JSON pretty-print with syntax highlighting, inline image preview for binary responses, per-section copy buttons, "Copy as cURL", content-type/duration columns, and a resizable list/detail split.
- Body capture is now content-type aware — binary bodies (images, fonts, etc.) are preserved as base64 instead of being corrupted by a forced UTF-8 decode.
