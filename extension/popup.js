const contentEl = document.getElementById('content');
const btnRefresh = document.getElementById('btn-refresh');
const btnOptions = document.getElementById('btn-options');

let settings = null;
let state = { lights: {}, scenes: {}, sensors: {}, error: true };
let brightnessTimers = {};  // entityId → timeout id

btnOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
btnRefresh.addEventListener('click', () => loadAndRender(true));

init();

async function init() {
    settings = await chrome.storage.sync.get({
        entities: '', scenes: '', sensors: '', brightnessStep: 1
    });

    // Быстрый первый рендер из кэша, затем — свежий опрос.
    const cached = await chrome.storage.local.get('haState');
    if (cached.haState) { state = cached.haState; render(); }

    loadAndRender(true);

    // Пока popup открыт, обновляем состояние живее, чем фоновый alarm.
    setInterval(() => loadAndRender(false), 4000);
}

function loadAndRender(spin) {
    if (spin) btnRefresh.classList.add('spinning');
    chrome.runtime.sendMessage({ type: 'pollNow' }, (resp) => {
        btnRefresh.classList.remove('spinning');
        if (resp && resp.ok && resp.state) {
            state = resp.state;
            render();
        }
    });
}

function entityIds() { return parseIds(settings.entities); }
function sceneIds() { return parseIds(settings.scenes); }
function sensorIds() { return parseIds(settings.sensors); }

function callService(service, entityId, extraData) {
    chrome.runtime.sendMessage({ type: 'callService', service, entityId, extraData });
}

function callServiceAll(service) {
    chrome.runtime.sendMessage({ type: 'callServiceAll', service });
}

function render() {
    const ids = entityIds();
    contentEl.innerHTML = '';

    if (!ids.length) {
        contentEl.innerHTML = '<div class="empty-msg">Нет объектов — откройте настройки</div>';
        return;
    }
    if (state.error && Object.keys(state.lights).length === 0) {
        contentEl.innerHTML = '<div class="error-msg">HA недоступен</div>';
        return;
    }

    const sensorMap = matchSensors(ids, sensorIds());
    const devicesSection = document.createElement('div');
    devicesSection.className = 'section';

    for (const id of ids) {
        const light = state.lights[id];
        if (!light) continue;
        devicesSection.appendChild(renderDevice(id, light, sensorMap.get(id) || []));
    }
    contentEl.appendChild(devicesSection);

    if (ids.length > 1) {
        const row = document.createElement('div');
        row.className = 'btn-row';
        row.innerHTML = `<button id="all-on">Включить все</button><button id="all-off">Выключить все</button>`;
        contentEl.appendChild(row);
        row.querySelector('#all-on').addEventListener('click', () => callServiceAll('turn_on'));
        row.querySelector('#all-off').addEventListener('click', () => callServiceAll('turn_off'));
    }

    const scenesWithData = sceneIds().filter(id => state.scenes[id]);
    if (scenesWithData.length) {
        const section = document.createElement('div');
        section.className = 'section';
        section.innerHTML = '<div class="section-title">Сцены</div>';
        for (const id of scenesWithData) {
            const btn = document.createElement('button');
            btn.className = 'scene-item';
            btn.textContent = state.scenes[id].name;
            btn.addEventListener('click', () => callService('turn_on', id));
            section.appendChild(btn);
        }
        contentEl.appendChild(section);
    }

    const unmatched = (sensorMap.get('') || []).filter(sid => state.sensors[sid]);
    if (unmatched.length) {
        const section = document.createElement('div');
        section.className = 'section';
        section.innerHTML = '<div class="section-title">Датчики</div>';
        for (const sid of unmatched) {
            section.appendChild(renderSensorRow(state.sensors[sid]));
        }
        contentEl.appendChild(section);
    }
}

function renderDevice(id, light, attachedSensorIds) {
    const wrap = document.createElement('div');
    wrap.className = 'device';

    const isOn = light.state === 'on';
    const row = document.createElement('div');
    row.className = 'device-row';
    row.innerHTML = `
        <span class="device-name" title="${light.name}">${light.name}</span>
        <label class="switch">
            <input type="checkbox" ${isOn ? 'checked' : ''}>
            <span class="slider"></span>
        </label>`;
    row.querySelector('input').addEventListener('change', (e) => {
        callService(e.target.checked ? 'turn_on' : 'turn_off', id);
    });
    wrap.appendChild(row);

    if (id.startsWith('light.') && light.supportsBrightness) {
        const initPct = light.brightness != null ? Math.round(light.brightness / 255 * 100) : 100;
        const step = settings.brightnessStep || 1;
        const b = document.createElement('div');
        b.className = 'brightness';
        b.innerHTML = `
            <input type="range" min="0" max="100" step="${step}" value="${initPct}">
            <span class="brightness-pct">${initPct}%</span>`;
        const input = b.querySelector('input');
        const label = b.querySelector('.brightness-pct');
        input.addEventListener('input', () => { label.textContent = `${input.value}%`; });
        input.addEventListener('change', () => {
            if (brightnessTimers[id]) clearTimeout(brightnessTimers[id]);
            brightnessTimers[id] = setTimeout(() => {
                callService('turn_on', id, { brightness_pct: Number(input.value) });
            }, 300);
        });
        wrap.appendChild(b);
    }

    if (attachedSensorIds.length) {
        const s = document.createElement('div');
        s.className = 'device-sensors';
        s.textContent = attachedSensorIds
            .map(sid => state.sensors[sid])
            .filter(Boolean)
            .map(formatSensor)
            .join(' · ');
        wrap.appendChild(s);
    }

    return wrap;
}

function renderSensorRow(sensor) {
    const row = document.createElement('div');
    row.className = 'sensor-item';
    row.innerHTML = `<span class="name">${sensor.name}</span><span class="val">${formatSensor(sensor)}</span>`;
    return row;
}

function formatSensor(sensor) {
    const val = parseFloat(sensor.state);
    const disp = isNaN(val) ? sensor.state : val.toFixed(1);
    return `${disp}${sensor.unit ? ' ' + sensor.unit : ''}`;
}
