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

const ENTITY_PICK_DOMAINS = ['light', 'switch', 'fan', 'input_boolean', 'cover', 'lock'];
const PICKERS = [
    ['pick-entities', 'entities', s => ENTITY_PICK_DOMAINS.includes(s.entity_id.split('.')[0])],
    ['pick-scenes', 'scenes', s => s.entity_id.startsWith('scene.')],
    ['pick-sensors', 'sensors', s => s.entity_id.startsWith('sensor.')]
];

init();

async function init() {
    const s = await chrome.storage.sync.get(DEFAULTS);
    for (const id of fields) document.getElementById(id).value = s[id];
    document.getElementById('btn-save').addEventListener('click', save);
    document.getElementById('btn-load-entities').addEventListener('click', loadEntities);

    for (const [pickId, fieldId] of PICKERS) {
        document.getElementById(pickId).addEventListener('change', (e) => {
            const val = e.target.value;
            if (!val) return;
            const field = document.getElementById(fieldId);
            const ids = parseIds(field.value);
            if (!ids.includes(val)) ids.push(val);
            field.value = ids.join(',');
            e.target.value = '';
        });
    }
}

async function loadEntities() {
    const loadStatus = document.getElementById('load-status');
    const haUrl = document.getElementById('haUrl').value.trim();
    const haToken = document.getElementById('haToken').value.trim();
    if (!haUrl || !haToken) {
        loadStatus.textContent = 'Укажите URL и токен, сохраните настройки';
        return;
    }

    loadStatus.textContent = 'Загрузка…';
    try {
        const states = await haGet(haUrl, haToken, '/api/states');
        for (const [pickId, , filterFn] of PICKERS) fillPicker(pickId, states.filter(filterFn));
        loadStatus.textContent = `✓ Загружено ${states.length} объектов`;
    } catch (e) {
        loadStatus.textContent = `Ошибка загрузки: ${e}`;
    }
}

function fillPicker(selectId, states) {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    const placeholder = new Option('— выбрать —', '');
    select.appendChild(placeholder);
    for (const s of states) {
        select.appendChild(new Option(`${s.attributes.friendly_name || s.entity_id} (${s.entity_id})`, s.entity_id));
    }
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
