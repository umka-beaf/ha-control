# 🏠 HA Control

🇷🇺 Русский · [🇬🇧 English](README.en.md)

![version](https://img.shields.io/badge/version-1.0.0-blue)
![Chrome](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)
![Brave](https://img.shields.io/badge/Brave-supported-FB542B?logo=brave&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)
[![Release](https://github.com/umka-beaf/ha-control/actions/workflows/release.yml/badge.svg)](https://github.com/umka-beaf/ha-control/actions/workflows/release.yml)

Расширение для **Chrome и Brave** (MV3) для управления устройствами Home Assistant
(свет, розетки, чайники и т.п.) и отображения показаний датчиков.
Браузерный аналог моего же Cinnamon-апплета `ha-control@beaf` (не публикуется —
живёт в приватном монорепо вместе с остальными аплетами рабочего стола).

## 📋 Требования

- Home Assistant, доступный по HTTPS/HTTP из браузера
- Long-Lived Access Token (Профиль → Безопасность → Токены долгосрочного доступа)

## 🚀 Установка

### Из релиза

1. Скачать `ha-control.zip` со страницы [Releases](../../releases) и распаковать.
2. `chrome://extensions` (в Brave — `brave://extensions`) → включить «Режим
   разработчика» → «Загрузить распакованное расширение» → выбрать распакованную
   папку.

### Из исходников (dev)

1. Склонировать репозиторий.
2. `chrome://extensions` (в Brave — `brave://extensions`) → включить «Режим
   разработчика» → «Загрузить распакованное расширение» → выбрать эту папку.

### Настройка

1. Открыть настройки расширения (значок ⚙ в popup, либо через `chrome://extensions`).
2. Заполнить:
   - **URL** — например, `https://ha.example.com`;
   - **Token** — Long-Lived Access Token из HA;
   - **Entity IDs** — управляемые объекты через запятую;
   - **Сцены**, **Датчики** — опционально.
3. При сохранении браузер запросит разрешение на доступ к указанному домену —
   подтвердить.

## 🧩 Устройство

- `background.js` — service worker: опрашивает HA по `chrome.alarms` (раз в N минут, обновляет значок панели: зелёный «on» / без значка «off» / красный «!» при ошибке), выполняет вызовы сервисов
- `popup.html/js` — список устройств с тумблерами и слайдером яркости, кнопки «включить/выключить всё», сцены, датчики; пока popup открыт — опрашивает HA каждые 4 сек для отзывчивости
- `options.html/js` — настройки, запрос `optional_host_permissions` под введённый URL
- `ha-api.js` — общая логика REST-запросов и матчинга датчиков к устройствам, подключается и в background, и в popup

## 🔗 Матчинг датчиков

Как и в апплете: entity_id датчика и устройства сравниваются по частям
(разделённым `_`) от начала; при совпадении ≥ 3 частей датчик считается
привязанным к устройству и показывается прямо под ним. Непривязанные
датчики — отдельным списком внизу.

## 🔄 Отличия от Cinnamon-апплета

| | Апплет | Расширение |
|---|---|---|
| HTTP | `Soup.Session` (GLib event loop) | `fetch` |
| Опрос вживую | таймер `GLib.timeout_add` каждые N мс | popup: `setInterval` пока открыт; фон: `chrome.alarms` (мин. интервал 1 мин) |
| Индикация состояния | 3 иконки (on/off/error) | одна иконка + цветной badge |
| Настройки | Cinnamon `AppletSettings` | `chrome.storage.sync` + options-страница |

## 🛠 Релизы

Собственная разработка, версионность с `1.0.0`. Релизы собираются автоматически
([GitHub Actions](.github/workflows/release.yml)): по тегу `vX.Y.Z` (версия должна
совпадать с `manifest.json`) собирается `ha-control.zip` и публикуется как GitHub
Release.

## 📄 Лицензия

[MIT](LICENSE).
