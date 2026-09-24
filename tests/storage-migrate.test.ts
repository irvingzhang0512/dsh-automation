import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SqliteAutomationStore, migrateLegacyData, resolveAutomationDataDir } from '../src/storage/sqlite.ts'

/** 临时目录夹具。 */
const tmpRoots: string[] = []
function tmpDir(label: string): string {
  const dir = join(process.cwd(), '.test-runs', `migrate-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  mkdirSync(dir, { recursive: true })
  tmpRoots.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of tmpRoots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('resolveAutomationDataDir', () => {
  it('override 优先', () => {
    expect(resolveAutomationDataDir({}, 'C:\\home', '/custom/path')).toBe('/custom/path')
  })
  it('DSH_DATA_DIR 次之', () => {
    expect(resolveAutomationDataDir({ DSH_DATA_DIR: 'D:\\data' }, 'C:\\home')).toBe(join('D:\\data', 'automation'))
  })
  it('默认 ~/.dsh/data/automation', () => {
    expect(resolveAutomationDataDir({}, 'C:\\home')).toBe(join('C:\\home', '.dsh', 'data', 'automation'))
    expect(resolveAutomationDataDir({ DSH_HOME: 'D:\\dsh' }, 'C:\\home')).toBe(join('D:\\dsh', 'data', 'automation'))
  })
})

describe('migrateLegacyData', () => {
  it('旧目录存在且新目录无 db → 迁移（复制 db + logs），不删除旧目录', () => {
    const legacy = tmpDir('legacy')
    const target = tmpDir('target')
    writeFileSync(join(legacy, 'automation.db'), 'db-content')
    mkdirSync(join(legacy, 'logs'), { recursive: true })
    writeFileSync(join(legacy, 'logs', 'run_1.log'), 'log-line')

    const migrated = migrateLegacyData(legacy, target)
    expect(migrated).toBe(true)
    expect(readFileSync(join(target, 'automation.db'), 'utf8')).toBe('db-content')
    expect(readFileSync(join(target, 'logs', 'run_1.log'), 'utf8')).toBe('log-line')
    // 旧目录保留（回退）。
    expect(existsSync(join(legacy, 'automation.db'))).toBe(true)
  })

  it('目标已有 db → 跳过（不覆盖新数据）', () => {
    const legacy = tmpDir('legacy2')
    const target = tmpDir('target2')
    writeFileSync(join(legacy, 'automation.db'), 'old')
    writeFileSync(join(target, 'automation.db'), 'new')

    const migrated = migrateLegacyData(legacy, target)
    expect(migrated).toBe(false)
    expect(readFileSync(join(target, 'automation.db'), 'utf8')).toBe('new')
  })

  it('旧目录无 db → 不迁移', () => {
    const legacy = tmpDir('legacy3')
    const target = tmpDir('target3')
    expect(migrateLegacyData(legacy, target)).toBe(false)
  })

  it('同路径 → 不迁移', () => {
    const dir = tmpDir('same')
    expect(migrateLegacyData(dir, dir)).toBe(false)
  })
})

describe('SqliteAutomationStore 备份', () => {
  it('keepBackups=2：启动备份 + 多次 backupNow 只保留 2 份', () => {
    const dir = tmpDir('backup')
    const store = new SqliteAutomationStore({ homeDir: dir, keepBackups: 2, skipLegacyMigration: true })
    try {
      // 构造器已备份一次。
      store.backupNow()
      store.backupNow()
      store.backupNow()
      const files = readdirSync(join(dir, 'backup')).filter(name => /^automation\..+\.db$/.test(name))
      expect(files.length).toBe(2)
    } finally {
      store.close()
    }
  })

  it('keepBackups=0：不建 backup 目录、不备份', () => {
    const dir = tmpDir('nobackup')
    const store = new SqliteAutomationStore({ homeDir: dir, keepBackups: 0, skipLegacyMigration: true })
    try {
      expect(existsSync(join(dir, 'backup'))).toBe(false)
    } finally {
      store.close()
    }
  })

  it('备份文件是有效 db（可用 DatabaseSync 打开）', () => {
    const dir = tmpDir('valid')
    const store = new SqliteAutomationStore({ homeDir: dir, keepBackups: 3, skipLegacyMigration: true })
    let backupPath = ''
    try {
      store.createTask({ name: 't', enabled: true, action: { type: 'command', command: 'echo' }, created_by: 'test' })
      backupPath = store.backupNow() ?? ''
      expect(backupPath).not.toBe('')
      expect(existsSync(backupPath)).toBe(true)
    } finally {
      store.close()
    }
    // 用 node:sqlite 打开备份验证完整性。
    const db = new DatabaseSync(backupPath)
    try {
      const row = db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }
      expect(row.n).toBe(1)
    } finally {
      db.close()
    }
  })
})
