import { type SettingsOwner, type OwnerSettings } from '../shared/settings.ts';
export declare const OWNER_PACKAGES: Record<SettingsOwner, string>;
export interface ConfigRow {
    entry: {
        options: {
            name: string;
            id: string;
            config?: Record<string, unknown>;
            disabled?: boolean;
        };
        fiber?: {
            config?: unknown;
            runtime?: {
                Config?: unknown;
            };
        };
        parent?: {
            tree?: {
                ctx?: {
                    baseUrl?: string;
                };
            };
        };
    };
    inherited: Record<string, unknown>;
    override: Record<string, unknown>;
}
export interface ConfigEditor {
    documentPath: string;
    configuration(): ConfigRow[];
    edit(entry: ConfigRow['entry'], change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>): Promise<void>;
}
export declare function revision(value: unknown): string;
export declare function unpack(value: unknown): any;
export declare class BridgeError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, message: string, status?: number);
}
export declare function ownerRow(editor: ConfigEditor, owner: SettingsOwner): ConfigRow;
export declare function createSettingsBridge(editor: ConfigEditor, busy: () => boolean): {
    describe: () => OwnerSettings[];
    save(request: any): Promise<OwnerSettings[]>;
};
