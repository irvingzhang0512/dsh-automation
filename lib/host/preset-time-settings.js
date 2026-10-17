import { createHash } from 'node:crypto';
import { SETTINGS_FIELDS } from "../shared/settings.js";
import { BridgeError, unpack } from "./settings.js";
const PRESET = '@deepseek-ai/dsh-agent-preset';
const TIME = '@deepseek-ai/dsh-time-context';
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function child(config) { return Array.isArray(config?.plugins) ? config.plugins.filter((row) => row.name === TIME && !row.disabled) : []; }
function rows(editor) {
    const result = editor.configuration().filter(row => row.entry.options.name === PRESET && !row.entry.options.disabled && child(row.entry.options.config).length);
    if (!result.length || result.some(row => child(row.entry.options.config).length !== 1 || !row.entry.fiber?.runtime?.Config))
        throw new BridgeError('OWNER_UNAVAILABLE', '含时间上下文的预设未加载或实例不唯一。', 409);
    return result.sort((a, b) => a.entry.options.id.localeCompare(b.entry.options.id));
}
const fingerprint = (items) => hash(items.map(row => [row.entry.options.id, row.entry.options.config ?? {}, row.inherited]));
const project = (config) => Object.fromEntries(SETTINGS_FIELDS['time-context'].map(field => [field.path, config?.[field.path] ?? field.default]));
export function hasGlobalTimeOwner(editor) { return editor.configuration().some(row => row.entry.options.name === TIME && !row.entry.options.disabled); }
export function describePresetTime(editor) {
    const items = rows(editor), values = items.map(row => project(child(unpack(row.entry.fiber?.config ?? row.entry.options.config))[0]?.config));
    const mixed = values.some(value => hash(value) !== hash(values[0]));
    return { owner: 'time-context', entryId: items.map(row => row.entry.options.id).join('|'), effective: values[0], user: {}, base: {}, fields: SETTINGS_FIELDS['time-context'], writable: !mixed, revisionToken: fingerprint(items), applies: '含时间上下文的预设重载后，新会话采用；已有会话保留原快照', ...(mixed ? { unavailableReason: '各预设的时间设置不同，请先在官方预设编辑器核对，避免覆盖专用设置。' } : {}) };
}
export async function savePresetTime(editor, request) {
    const initial = rows(editor).map(row => ({ id: row.entry.options.id, config: structuredClone(row.entry.options.config ?? {}), inherited: structuredClone(row.inherited) })), description = describePresetTime(editor);
    if (!description.writable)
        throw new BridgeError('CONFIG_CONFLICT', description.unavailableReason, 409);
    if (request.entryId !== description.entryId || request.expectedRevisionToken !== description.revisionToken)
        throw new BridgeError('CONFIG_CONFLICT', '预设或配置已变化；草稿已保留，请重新核对。', 409);
    if (!Array.isArray(request.operations) || request.operations.length > 8)
        throw new BridgeError('INVALID_INPUT', '配置修改必须是字段操作列表。');
    for (const operation of request.operations) {
        const field = SETTINGS_FIELDS['time-context'].find(field => field.path === operation.path);
        if (!field || !['set', 'unset'].includes(operation.op))
            throw new BridgeError('INVALID_FIELD', '不能修改未列出的配置字段。');
        if (operation.op === 'unset')
            continue;
        const value = operation.value;
        if (field.type === 'string') {
            if (typeof value !== 'string')
                throw new BridgeError('INVALID_VALUE', '配置必须是文本。');
            if (value.trim()) {
                try {
                    new Intl.DateTimeFormat('en-US', { timeZone: value });
                }
                catch {
                    throw new BridgeError('INVALID_VALUE', '请输入有效IANA时区。');
                }
            }
        }
        else if (!Number.isSafeInteger(value) || value < 0)
            throw new BridgeError('INVALID_VALUE', '时间读数间隔须为非负安全整数。');
    }
    const completed = [];
    try {
        for (const original of initial) {
            const row = rows(editor).find(row => row.entry.options.id === original.id);
            if (!row)
                throw new BridgeError('CONFIG_CONFLICT', '预设条目已变化。', 409);
            const expected = hash([original.config, original.inherited]);
            const before = original.config;
            let after;
            await editor.edit(row.entry, (current, inherited) => {
                if (hash([current, inherited]) !== expected)
                    throw new BridgeError('CONFIG_CONFLICT', '预设配置已被其他操作修改。', 409);
                const next = structuredClone(current), target = child(next)[0];
                if (!target)
                    throw new BridgeError('OWNER_UNAVAILABLE', '预设时间上下文已不存在。', 409);
                target.config = { ...target.config };
                for (const operation of request.operations) {
                    if (operation.op === 'unset' || operation.path === 'timeZone' && !operation.value.trim())
                        delete target.config[operation.path];
                    else
                        target.config[operation.path] = operation.value;
                }
                after = next;
                return next;
            });
            completed.push({ id: row.entry.options.id, before, after: structuredClone(after) });
        }
    }
    catch (error) {
        const conflicts = [];
        for (const item of completed.reverse()) {
            try {
                const row = rows(editor).find(row => row.entry.options.id === item.id);
                if (!row)
                    throw Error('预设已移除');
                await editor.edit(row.entry, current => { if (hash(current) !== hash(item.after))
                    throw Error('保存后出现其他修改'); return item.before; });
            }
            catch {
                conflicts.push(item.id);
            }
        }
        if (conflicts.length)
            throw new BridgeError('CONFIG_RECOVERY_CONFLICT', '保存未完成，恢复遇到并发修改，请核对预设：' + conflicts.join('、'), 409);
        throw error;
    }
}
