import type { OwnerSettings, SettingsOwner } from '../shared/settings.ts';
export interface DraftState {
    owners: Partial<Record<SettingsOwner, OwnerSettings>>;
    drafts: Partial<Record<SettingsOwner, Record<string, unknown>>>;
    resets: Partial<Record<SettingsOwner, string[]>>;
}
export declare const emptyDraftState: () => DraftState;
export declare function receiveOwners(state: DraftState, owners: OwnerSettings[], saved?: SettingsOwner): DraftState;
export declare function editDraft(state: DraftState, owner: SettingsOwner, field: string, value: unknown, reset?: boolean): DraftState;
export declare function draftOperations(state: DraftState, owner: SettingsOwner): {
    op: string;
    path: string;
}[];
