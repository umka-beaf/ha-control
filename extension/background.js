importScripts('ha-api.js');

const DEFAULTS = {
    haUrl: 'http://homeassistant.local:8123',
    haToken: '',
    entities: '',
    scenes: '',
    sensors: '',
    brightnessStep: 1,
    badgeInterval: 1  // минуты — как часто фоново обновляем значок панели
};

const ALARM_NAME = 'ha-poll';

function getSettings() {
    return chrome.storage.sync.get(DEFAULTS);
}

function setBadge(error, anyOn) {
    if (error) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#f87171' });
    } else if (anyOn) {
        chrome.action.setBadgeText({ text: 'on' });
        chrome.action.setBadgeBackgroundColor({ color: '#4ade80' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

async function refresh() {
    const s = await getSettings();
    const entities = parseIds(s.entities);
    const scenes = parseIds(s.scenes);
    const sensors = parseIds(s.sensors);

    if (!entities.length || !s.haUrl || !s.haToken) {
        await chrome.storage.local.set({
            haState: { lights: {}, scenes: {}, sensors: {}, error: true, ts: Date.now() }
        });
        setBadge(true, false);
        return;
    }

    try {
        const state = await pollHa({ haUrl: s.haUrl, haToken: s.haToken, entities, scenes, sensors });
        await chrome.storage.local.set({ haState: Object.assign(state, { ts: Date.now() }) });
        const anyOn = Object.values(state.lights).some(l => l.state === 'on');
        setBadge(state.error, anyOn);
    } catch (e) {
        await chrome.storage.local.set({
            haState: { lights: {}, scenes: {}, sensors: {}, error: true, ts: Date.now() }
        });
        setBadge(true, false);
    }
}

async function restartAlarm() {
    const s = await getSettings();
    const period = Math.max(1, Number(s.badgeInterval) || 1);
    await chrome.alarms.clear(ALARM_NAME);
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: period, delayInMinutes: 0 });
}

chrome.runtime.onInstalled.addListener(() => { restartAlarm(); refresh(); });
chrome.runtime.onStartup.addListener(() => { restartAlarm(); refresh(); });

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_NAME) refresh();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.badgeInterval) restartAlarm();
    refresh();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        try {
            if (msg.type === 'pollNow') {
                await refresh();
                const { haState } = await chrome.storage.local.get('haState');
                sendResponse({ ok: true, state: haState });
            } else if (msg.type === 'callService') {
                const s = await getSettings();
                await callService(s.haUrl, s.haToken, msg.service, msg.entityId, msg.extraData);
                setTimeout(refresh, 600);
                sendResponse({ ok: true });
            } else if (msg.type === 'callServiceAll') {
                const s = await getSettings();
                const entities = parseIds(s.entities);
                await Promise.allSettled(entities.map(id =>
                    callService(s.haUrl, s.haToken, msg.service, id)));
                setTimeout(refresh, 600);
                sendResponse({ ok: true });
            }
        } catch (e) {
            sendResponse({ ok: false, error: String(e) });
        }
    })();
    return true;  // ответ асинхронный
});
