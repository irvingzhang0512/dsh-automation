export type SettingsOwner = 'time-context' | 'schedule' | 'automation';
export interface SettingField {
    path: string;
    label: string;
    type: 'string' | 'number';
    default: string | number;
    min?: number;
    max?: number;
    help: string;
}
export declare const SETTINGS_FIELDS: Record<SettingsOwner, SettingField[]>;
export interface OwnerSettings {
    owner: SettingsOwner;
    entryId: string;
    effective: Record<string, unknown>;
    user: Record<string, unknown>;
    base: Record<string, unknown>;
    fields: SettingField[];
    writable: boolean;
    revisionToken: string;
    applies: string;
    unavailableReason?: string;
}
