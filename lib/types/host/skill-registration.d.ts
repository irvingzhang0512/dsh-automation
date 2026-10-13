import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
/** 本包随附的技能目录（相对 src/ 或 lib/）。 */
export declare const BUNDLED_SKILL_DIR = "../../skills/automation";
/** 打包的 SKILL.md 的 URL（锚定到本模块：src/ 与 lib/ 同深）。 */
export declare const BUNDLED_SKILL_URL: URL;
/** 解析结果。 */
export interface ParsedSkillFrontmatter {
    name: string;
    description: string;
    whenToUse?: string;
    /** 结束 `---` 之后的正文（去除前导空行）。 */
    content: string;
}
/**
 * 解析 SKILL.md 的 `---` frontmatter。支持普通标量与折叠 `>` / 字面 `|`
 * 块标量（`>-` / `|-` 变体）。非合法技能文件（无 frontmatter 或缺
 * name/description）返回 undefined。
 */
export declare function parseSkillFrontmatter(raw: string): ParsedSkillFrontmatter | undefined;
/**
 * 加载打包的 SKILL.md 为运行时技能注册。
 * @param fileUrl - 覆盖打包文件 URL（测试用）；默认 {@link BUNDLED_SKILL_URL}。
 * @returns 注册对象；文件缺失 / 不可读 / frontmatter 校验失败返回 undefined。
 */
export declare function loadBundledSkill(fileUrl?: string | URL): Promise<SkillRegistration | undefined>;
