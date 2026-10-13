import { type ConfigEditor } from './settings.ts';
import { type AutomationService } from '../core/service.ts';
import type { SqliteAutomationStore } from '../storage/sqlite.ts';
interface SchedulePort {
    create(session: any, request: any): Promise<any>;
    delete(request: any): Promise<any>;
    catalog(): Promise<any[]>;
}
export declare function createMigrationBridge(store: SqliteAutomationStore, service: AutomationService, editor: ConfigEditor, schedule: SchedulePort, sessionController: any): {
    preview: () => Promise<{
        revisionToken: string;
        timeZone: string;
        tasks: {
            id: string;
            name: string;
            type: "skill" | "agent_prompt" | "command" | "script";
            enabled: boolean;
            action: import("../shared/types.ts").ActionSpec;
            triggers: {
                proposedTimeZone: string;
                issue: string | undefined;
                id: import("../shared/types.ts").AutomationId;
                task_id: import("../shared/types.ts").AutomationId;
                config: import("../shared/types.ts").TriggerConfig;
                enabled: boolean;
                created_at: string;
                updated_at: string;
            }[];
        }[];
        sessions: any[];
        sessionError: string | undefined;
        records: {
            id: string;
            state: string;
            error: string | undefined;
        }[];
        running: boolean;
    }>;
    mutate: (request: any) => Promise<{
        revisionToken: string;
        timeZone: string;
        tasks: {
            id: string;
            name: string;
            type: "skill" | "agent_prompt" | "command" | "script";
            enabled: boolean;
            action: import("../shared/types.ts").ActionSpec;
            triggers: {
                proposedTimeZone: string;
                issue: string | undefined;
                id: import("../shared/types.ts").AutomationId;
                task_id: import("../shared/types.ts").AutomationId;
                config: import("../shared/types.ts").TriggerConfig;
                enabled: boolean;
                created_at: string;
                updated_at: string;
            }[];
        }[];
        sessions: any[];
        sessionError: string | undefined;
        records: {
            id: string;
            state: string;
            error: string | undefined;
        }[];
        running: boolean;
    }>;
};
export {};
