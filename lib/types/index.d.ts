import { type AutomationConfig } from './host/config.ts';
export declare const name = "dsh-automation";
export declare const inject: string[];
export declare const Config: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
    dataDir: import("@deepseek-ai/schemastery").default<string, string, "defined">;
    defaultTimeoutSeconds: import("@deepseek-ai/schemastery").default<number, number, "defined">;
    tickMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
    keepBackups: import("@deepseek-ai/schemastery").default<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    dataDir: import("@deepseek-ai/schemastery").default<string, string, "defined">;
    defaultTimeoutSeconds: import("@deepseek-ai/schemastery").default<number, number, "defined">;
    tickMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
    keepBackups: import("@deepseek-ai/schemastery").default<number, number, "defined">;
}>>, "plain">;
export declare function apply(ctx: any, baseConfig?: Partial<AutomationConfig>): void;
