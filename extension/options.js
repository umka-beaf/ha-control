const DEFAULTS = {
    haUrl: 'http://homeassistant.local:8123',
    haToken: '',
    entities: '',
    scenes: '',
    sensors: '',
    brightnessStep: 1,
    badgeInterval: 1
};

const fields = ['haUrl', 'haToken', 'entities', 'scenes', 'sensors', 'brightnessStep', 'badgeInterval'];
const statusEl = document.getElementById('status');

init();

async function init() {
    const s = await chrome.storage.sync.get(DEFAULTS);
    for (const id of fields) document.getElementById(id).value = s[id];
    document.getElementById('btn-save').addEventListener('click', save);
}

function originPattern(urlStr) {
    try {
        const u = new URL(urlStr);
        return `${u.protocol}//${u.host}/*`;
    } catch (e) {
        return null;
    }
}

async function save() {
    const values = {};
    for (const id of fields) values[id] = document.getElementById(id).value.trim();
    values.brightnessStep = Number(values.brightnessStep) || 1;
    values.badgeInterval = Number(values.badgeInterval) || 1;

    const pattern = originPattern(values.haUrl);
    if (!pattern) return showStatus('Некорректный URL', false);

    try {
        const granted = await chrome.permissions.request({ origins: [pattern] });
        if (!granted) return showStatus('Доступ к домену не выдан — сохранение отменено', false);
    } catch (e) {
        return showStatus(`Ошибка запроса разрешения: ${e}`, false);
    }

    await chrome.storage.sync.set(values);
    showStatus('✓ Сохранено', true);
}

function showStatus(text, ok) {
    statusEl.textContent = text;
    statusEl.className = `show ${ok ? 'ok' : 'err'}`;
    setTimeout(() => { statusEl.className = ''; }, 2500);
}
