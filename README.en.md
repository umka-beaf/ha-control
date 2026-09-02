# 🏠 HA Control

[🇷🇺 Русский](README.md) · 🇬🇧 English

![version](https://img.shields.io/badge/version-1.0.0-blue)
![Chrome](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)
![Brave](https://img.shields.io/badge/Brave-supported-FB542B?logo=brave&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

A **Chrome/Brave** (MV3) extension to control Home Assistant devices (lights,
outlets, kettles, etc.) and display sensor readings.
A browser counterpart to my own Cinnamon applet `ha-control@beaf` (not published —
lives in a private monorepo alongside my other desktop applets).

## 📋 Requirements

- Home Assistant reachable over HTTPS/HTTP from the browser
- Long-Lived Access Token (Profile → Security → Long-Lived Access Tokens)

## 🚀 Install

### From a release

1. Download `ha-control.zip` from [Releases](../../releases) and unpack it.
2. `chrome://extensions` (`brave://extensions` on Brave) → enable "Developer mode" →
   "Load unpacked" → select the unpacked folder.

### From source (dev)

1. Clone the repo.
2. `chrome://extensions` (`brave://extensions` on Brave) → enable "Developer mode" →
   "Load unpacked" → select this folder.

### Setup

1. Open the extension's options (⚙ icon in the popup, or via `chrome://extensions`).
2. Fill in:
   - **URL** — e.g. `https://ha.example.com`;
   - **Token** — a Long-Lived Access Token from HA;
   - **Entity IDs** — controllable objects, comma-separated;
   - **Scenes**, **Sensors** — optional.
3. On save, the browser will ask for permission to access the given domain — grant it.

## 🧩 How it's built

- `background.js` — service worker: polls HA via `chrome.alarms` (every N minutes, updates the icon badge: green "on" / no badge "off" / red "!" on error), executes service calls
- `popup.html/js` — device list with toggles and a brightness slider, "turn all on/off" buttons, scenes, sensors; while the popup is open, polls HA every 4s for responsiveness
- `options.html/js` — settings, requests `optional_host_permissions` for the entered URL
- `ha-api.js` — shared REST-request and sensor-matching logic, used by both background and popup

## 🔗 Sensor matching

Same as the applet: a sensor's and a device's entity_id are compared part-by-part
(split on `_`) from the start; if ≥ 3 parts match, the sensor is considered
"attached" to the device and shown right under it. Unattached sensors are listed
separately at the bottom.

## 🔄 Differences from the Cinnamon applet

| | Applet | Extension |
|---|---|---|
| HTTP | `Soup.Session` (GLib event loop) | `fetch` |
| Live polling | `GLib.timeout_add` timer every N ms | popup: `setInterval` while open; background: `chrome.alarms` (min. interval 1 min) |
| Status indication | 3 icons (on/off/error) | one icon + colored badge |
| Settings | Cinnamon `AppletSettings` | `chrome.storage.sync` + options page |

## 🛠 Releases

Original work, versioning starts at `1.0.0`. Releases are built automatically
([GitHub Actions](.github/workflows/release.yml)): pushing a `vX.Y.Z` tag (must
match `manifest.json`) builds `ha-control.zip` and publishes it as a GitHub
Release.

## 📄 License

[MIT](LICENSE).
