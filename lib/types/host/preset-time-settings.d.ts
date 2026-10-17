import { type OwnerSettings } from '../shared/settings.ts';
import { type ConfigEditor } from './settings.ts';
export declare function hasGlobalTimeOwner(editor: ConfigEditor): boolean;
export declare function describePresetTime(editor: ConfigEditor): OwnerSettings;
export declare function savePresetTime(editor: ConfigEditor, request: any): Promise<void>;
