// Общая логика работы с Home Assistant REST API.
// Классический (не ES-module) скрипт — подключается и в background.js
// (importScripts), и в popup.html (<script>), без дублирования кода.

function haBase(url) {
    return (url || '').replace(/\/$/, '');
}

async function haGet(baseUrl, token, path) {
    const res = await fetch(`${haBase(baseUrl)}${path}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function haPost(baseUrl, token, path, body) {
    const res = await fetch(`${haBase(baseUrl)}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    try { return await res.json(); } catch (e) { return null; }
}

function parseIds(str) {
    return (str || '').split(',').map(s => s.trim()).filter(Boolean);
}

// Разбиваем entity_id (без домена) по "_" и считаем число совпадающих частей
// от начала. Если ≥ 3 — датчик считается «связанным» с устройством.
// Каждый датчик привязывается только к первому подходящему устройству.
function matchSensors(entityIds, sensorIds) {
    const attached = new Set();
    const result = new Map();

    for (const eid of entityIds) {
        const parts = eid.split('.')[1].split('_');
        const matched = [];

        for (const sid of sensorIds) {
            if (attached.has(sid)) continue;
            const sparts = sid.split('.')[1].split('_');
            let common = 0;
            while (common < parts.length && common < sparts.length &&
                parts[common] === sparts[common]) common++;
            if (common >= 3) {
                matched.push(sid);
                attached.add(sid);
            }
        }
        result.set(eid, matched);
    }

    result.set('', sensorIds.filter(sid => !attached.has(sid)));
    return result;
}

async function fetchEntityState(baseUrl, token, id) {
    const data = await haGet(baseUrl, token, `/api/states/${id}`);
    const attrs = data.attributes || {};
    const NO_BRIGHTNESS = new Set(['onoff', 'unknown']);
    const modes = attrs.supported_color_modes || [];
    const supportsBrightness = modes.length > 0 &&
        modes.some(m => !NO_BRIGHTNESS.has(m));
    return {
        name: attrs.friendly_name || id,
        state: data.state || 'unavailable',
        brightness: attrs.brightness || null,
        supportsBrightness,
        unit: attrs.unit_of_measurement || ''
    };
}

// Опрашивает устройства/сцены/датчики. error=true, если ни одно
// controllable-устройство не удалось получить (как в апплете).
async function pollHa({ haUrl, haToken, entities, scenes, sensors }) {
    const lights = {};
    const sceneMap = {};
    const sensorMap = {};
    let error = false;

    if (entities.length) {
        const results = await Promise.allSettled(
            entities.map(id => fetchEntityState(haUrl, haToken, id))
        );
        let anyOk = false;
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') { lights[entities[i]] = r.value; anyOk = true; }
        });
        error = !anyOk;
    } else {
        error = true;
    }

    await Promise.allSettled(scenes.map(async id => {
        try { sceneMap[id] = await fetchEntityState(haUrl, haToken, id); } catch (e) { /* пропускаем */ }
    }));
    await Promise.allSettled(sensors.map(async id => {
        try { sensorMap[id] = await fetchEntityState(haUrl, haToken, id); } catch (e) { /* пропускаем */ }
    }));

    return { lights, scenes: sceneMap, sensors: sensorMap, error };
}

// Считает число сущностей update.* в состоянии "on" (т.е. доступных обновлений).
async function fetchUpdatesCount(baseUrl, token) {
    const states = await haGet(baseUrl, token, '/api/states');
    return states.filter(s => s.entity_id.startsWith('update.') && s.state === 'on').length;
}

async function callService(baseUrl, token, service, entityId, extraData) {
    const domain = entityId.split('.')[0];
    await haPost(baseUrl, token, `/api/services/${domain}/${service}`,
        Object.assign({ entity_id: entityId }, extraData || {}));
}
