import type { ConfigEditor } from './settings.ts';
export declare const BUNDLE = "@deepseek-ai/dsh-experimental-schedule-bundle";
export declare const BASE_VERSION = "0.2.0-rc.2";
export declare const AUTOMATION_VERSION: string;
export declare const SCHEDULE_PACKAGES: string[];
export declare function compareAutomationVersions(a: string, b: string): number;
export declare function compatibilityFacts(ctx: any, editor: ConfigEditor): {
    matched: boolean;
    version: string;
    target: string;
    actual: Record<string, string | undefined>;
    reasons: string[];
};
