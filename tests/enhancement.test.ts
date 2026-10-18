import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { SqliteAutomationStore } from '../src/storage/sqlite.ts'
import { AutomationService } from '../src/core/service.ts'
import { ChildProcessExecutor } from '../src/actions/process.ts'
import { createSettingsBridge, revision, type ConfigRow } from '../src/host/settings.ts'
import { SETTINGS_FIELDS } from '../src/shared/settings.ts'
import { emptyDraftState, receiveOwners, editDraft, draftOperations } from '../src/client/settings-state.ts'
import { normalizeTrigger, nextOccurrence, legacyRuleIssue } from '../src/shared/time.ts'
import { createMigrationBridge } from '../src/host/migration.ts'
import { compareAutomationVersions } from '../src/host/compatibility.ts'
const wait = async (condition: () => boolean) => { const deadline = Date.now()+4000; while (!condition()) { if (Date.now()>deadline) throw Error('timeout'); await new Promise(resolve=>setTimeout(resolve,10)) } }
function fixture() {
  const root = mkdtempSync(join(tmpdir(),'automation-enhancement-'))
  const store = new SqliteAutomationStore({ homeDir: root, keepBackups: 0, skipLegacyMigration: true })
  const service = new AutomationService(store,{resolveExecutor:()=>new ChildProcessExecutor()},{tickMs:10})
  return { root, store, service }
}
function editorFixture(root: string) {
  const rows: ConfigRow[] = Object.entries({ 'time-context':'@deepseek-ai/dsh-time-context',schedule:'@deepseek-ai/dsh-schedule',automation:'dsh-automation' }).map(([owner,name]) => ({entry:{options:{name,id:owner,config:{unknown:'preserve'}},fiber:{config:{...Object.fromEntries(SETTINGS_FIELDS[owner as keyof typeof SETTINGS_FIELDS].map(field=>[field.path,field.default])),unknown:'preserve'},runtime:{Config:{}}}},inherited:{},override:{}}))
  const documentPath=join(root,'cordis.patch.yml');writeFileSync(documentPath,'# test configuration\n')
  return {rows,editor:{documentPath,configuration:()=>rows,async edit(entry:ConfigRow['entry'],change:any){const row=rows.find(row=>row.entry===entry)!;const next=change(entry.options.config,row.inherited);entry.options.config=next;row.override=next;row.entry.fiber!.config={...row.inherited,...next};writeFileSync(documentPath,JSON.stringify(next));}}}
}
describe('target configuration and drafts',()=>{
  it('each of eight fields saves to its own owner and preserves unknown config',async()=>{
    const root=mkdtempSync(join(tmpdir(),'automation-settings-')), {editor,rows}=editorFixture(root), bridge=createSettingsBridge(editor,()=>false)
    let count=0
    for(const owner of bridge.describe()) for(const field of owner.fields){
      const before=JSON.stringify(rows.filter(row=>row.entry.options.id!==owner.owner))
      const current=bridge.describe().find(item=>item.owner===owner.owner)!
      const value=field.type==='number'?Number(field.default)+1:field.path==='timeZone'?'Asia/Shanghai':'custom-directory'
      await bridge.save({owner:owner.owner,entryId:owner.entryId,expectedRevisionToken:current.revisionToken,operations:[{op:'set',path:field.path,value}]})
      expect(rows.find(row=>row.entry.options.id===owner.owner)!.entry.options.config?.[field.path]).toBe(value)
      expect(JSON.stringify(rows.filter(row=>row.entry.options.id!==owner.owner))).toBe(before)
      expect(rows.find(row=>row.entry.options.id===owner.owner)!.entry.options.config?.unknown).toBe('preserve');count++
      const saved=bridge.describe().find(item=>item.owner===owner.owner)!
      await bridge.save({owner:owner.owner,entryId:owner.entryId,expectedRevisionToken:saved.revisionToken,operations:[{op:'unset',path:field.path}]})
      expect(Object.hasOwn(rows.find(row=>row.entry.options.id===owner.owner)!.entry.options.config!,field.path)).toBe(false)
    }
    expect(count).toBe(8)
  })
  it('rejects stale writes, invalid values/paths/owners and busy reloads',async()=>{
    const {editor}=editorFixture(mkdtempSync(join(tmpdir(),'automation-settings-'))), bridge=createSettingsBridge(editor,()=>false)
    const owner=bridge.describe().find(item=>item.owner==='automation')!
    const request={owner:'automation',entryId:owner.entryId,expectedRevisionToken:owner.revisionToken,operations:[{op:'set',path:'tickMs',value:500}]}
    await bridge.save(request);await expect(bridge.save(request)).rejects.toMatchObject({code:'CONFIG_CONFLICT'})
    for(const [path,value] of [['tickMs',0],['keepBackups',-1],['__proto__',{}],['tickMs',{__jsExpr:'danger'}]]) await expect(bridge.save({...request,expectedRevisionToken:bridge.describe().find(item=>item.owner==='automation')!.revisionToken,operations:[{op:'set',path,value}]})).rejects.toBeTruthy()
    await expect(bridge.save({...request,owner:'constructor'})).rejects.toMatchObject({code:'INVALID_OWNER'})
    await expect(createSettingsBridge(editor,()=>true).save(request)).rejects.toMatchObject({code:'TASK_BUSY'})
  })
  it('saving/resetting one owner leaves all other drafts and revision tokens untouched',()=>{
    const {editor}=editorFixture(mkdtempSync(join(tmpdir(),'automation-drafts-'))), bridge=createSettingsBridge(editor,()=>false)
    let state=receiveOwners(emptyDraftState(),bridge.describe())
    state=editDraft(state,'schedule','deliveryHistoryDays',45)
    state=editDraft(state,'automation','tickMs',250)
    const other=state.drafts.automation,token=state.owners.automation!.revisionToken
    const result=bridge.describe().map(owner=>owner.owner==='schedule'?{...owner,effective:{deliveryHistoryDays:45},revisionToken:'new'}:owner)
    state=receiveOwners(state,result,'schedule')
    expect(state.drafts.automation).toBe(other);expect(state.owners.automation!.revisionToken).toBe(token)
    state=editDraft(state,'schedule','deliveryHistoryDays',30,true)
    expect(draftOperations(state,'schedule')).toContainEqual({op:'unset',path:'deliveryHistoryDays'})
    expect(draftOperations(state,'automation')).toContainEqual({op:'set',path:'tickMs',value:250})
    expect(receiveOwners(state,bridge.describe()).drafts.automation).toBe(other)
  })
})
describe('official timing and direct execution',()=>{
  it('explicit timezone and month-end clamping preserve calendar semantics',()=>{
    const start=Date.parse('2026-02-27T16:00:00Z')
    expect(new Date(nextOccurrence(normalizeTrigger({type:'monthly',day:31,time:'09:00',time_zone:'Asia/Shanghai'}),start)!).toISOString()).toBe('2026-02-28T01:00:00.000Z')
    expect(new Date(nextOccurrence(normalizeTrigger({type:'daily',time:'09:00',time_zone:'America/New_York'}),Date.parse('2026-10-14T00:00:00Z'))!).toISOString()).toBe('2026-10-14T13:00:00.000Z')
    expect(legacyRuleIssue({type:'cron',expr:'0 9 1 * 1'})).toContain('AND')
    expect(()=>normalizeTrigger({type:'daily',time:'09:00',time_zone:'invalid'})).toThrow()
  })
  for(const [extension,contents,executable] of [
    ['.py','import sys\nprint(sys.argv[1])','python'],['.sh','printf "%s\\n" "$1"','bash'],['.ps1','param($value)\nWrite-Output $value','pwsh'],['.js','console.log(process.argv[2])','node'],['.mjs','console.log(process.argv[2])','node'],
  ]) it('real script format '+extension+' or explicit unavailable interpreter',async()=>{
    const root=mkdtempSync(join(tmpdir(),'automation script ')),path=join(root,'sample'+extension);writeFileSync(path,contents!)
    const available=spawnSync(executable!,[executable==='pwsh'?'-Version':'--version'],{windowsHide:true,timeout:1000}).status===0
    const result=await new ChildProcessExecutor().execute({context:{cwd:root}},{type:'script',path,args:['argument with spaces']},{signal:AbortSignal.timeout(2500),log:()=>{}})
    if(available){expect(result.error).toBeUndefined();expect(result.output.trim()).toBe('argument with spaces')}else if(result.exit_code===0) expect(result.output.trim()).toBe('argument with spaces'); else expect(result.error).toBeTruthy()
  })
  it('command extra args and environment reach process without any Session',async()=>{
    const result=await new ChildProcessExecutor().execute({context:{env:{AUTOMATION_TEST_VALUE:'expected'}}},{type:'command',command:'node',args:['-e','console.log(process.argv[1]+process.env.AUTOMATION_TEST_VALUE)','literal space ']},{signal:new AbortController().signal,log:()=>{}})
    expect(result.output.trim()).toBe('literal space expected');expect(result.exit_code).toBe(0)
  })
  it('rejects unsafe reinterpretation of unknown script suffix even with interpreter override',async()=>{
    const path=join(mkdtempSync(join(tmpdir(),'automation-script-')),'x.exe');writeFileSync(path,'irrelevant')
    const result=await new ChildProcessExecutor().execute({},{type:'script',path,interpreter:'node'},{signal:new AbortController().signal,log:()=>{}})
    expect(result.error).toContain('不支持')
  })
  it('restores pending, marks interrupted unknown and records overdue once without executing it twice',async()=>{
    const {store,service}=fixture()
    const task=store.createTask({name:'direct',enabled:true,created_by:'web',action:{type:'command',command:'node',args:['-e','console.log("safe")']}})
    const past=new Date(Date.now()-60000).toISOString();store.addTrigger(task.id,{enabled:true,config:{type:'once',at:past}})
    const common={task_id:task.id,trigger_id:'manual',scheduled_at:past,attempt:1,created_at:past,updated_at:past}
    store.createRun({...common,id:'interrupted',status:'running'});store.createRun({...common,id:'queued',status:'pending'})
    service.start()
    try{await wait(()=>store.getRun('queued')?.status==='success');expect(store.getRun('interrupted')?.error).toContain('结果未知');expect(store.listRuns().filter(run=>run.status==='skipped')).toHaveLength(1);service.rebuildSchedule();expect(store.listRuns().filter(run=>run.status==='skipped')).toHaveLength(1)}finally{await service.dispose();store.close()}
  })
  for(const policy of ['queue','parallel','skip'] as const) it('actual '+policy+' overlap policy',async()=>{
    const {store}=fixture();let active=0,max=0,releases:(()=>void)[]=[]
    const service=new AutomationService(store,{resolveExecutor:()=>({execute:async()=>{active++;max=Math.max(max,active);await new Promise<void>(resolve=>releases.push(resolve));active--;return{output:'done'}}})},{tickMs:10})
    const task=store.createTask({name:policy,enabled:true,created_by:'web',concurrency:policy,action:{type:'command',command:'test'}})
    service.start()
    try{
      service.runNow(task.id);await wait(()=>active===1);service.runNow(task.id)
      await new Promise(resolve=>setTimeout(resolve,60))
      expect(active).toBe(policy==='parallel'?2:1)
      if(policy==='skip')expect(store.listRuns().some(run=>run.status==='skipped')).toBe(true)
      releases.splice(0).forEach(release=>release())
      if(policy==='queue'){await wait(()=>releases.length===1);releases.splice(0).forEach(release=>release())}
      await wait(()=>active===0);expect(max).toBe(policy==='parallel'?2:1)
    }finally{releases.splice(0).forEach(release=>release());await service.dispose();store.close()}
  })
  it('invalid initial trigger rolls back task creation',async()=>{const {store,service}=fixture();try{const result=service.createTask({name:'invalid',enabled:true,created_by:'web',action:{type:'command',command:'node'}},[{type:'cron',expr:'invalid'}]);expect(result.ok).toBe(false);expect(store.listTasks()).toEqual([])}finally{await service.dispose();store.close()}})
  it('compares own revisions while rejecting automatic cross-baseline upgrades',()=>{expect(compareAutomationVersions('0.2.0-rc.2+rev.2','0.2.0-rc.2+rev.1')).toBe(1);expect(()=>compareAutomationVersions('0.2.1+rev.1','0.2.0-rc.2+rev.1')).toThrow()})
})
describe('migration and recovery',()=>{
  function migrationFixture(){const f=fixture(),{editor}=editorFixture(f.root);let calls=0;const catalog:any[]=[];const schedule={async create(sessionId:string,request:any){calls++;const value={...request,id:'schedule-'+calls,scheduledAt:'2099-01-01T00:00:00Z'};catalog.push({...value,sessionId,status:'active'});return value},async delete(request:any){const index=catalog.findIndex(item=>item.id===request.id);if(index>=0)catalog.splice(index,1);return{deleted:index>=0}},async catalog(){return catalog}};return{...f,editor,schedule,catalog,migration:createMigrationBridge(f.store,f.service,editor,schedule,{async list(){return{items:[{sessionId:'session-existing'}]}}})}}
  it('read-only preview then direct migration preserves identity/history; recovery rejects later edits',async()=>{
    const f=migrationFixture();const task=f.store.createTask({name:'existing',enabled:true,created_by:'web',action:{type:'command',command:'node'}});const trigger=f.store.addTrigger(task.id,{enabled:true,config:{type:'daily',time:'09:00'}})!
    try{const before=JSON.stringify([f.store.listTasks(),f.store.listTriggers()]);const preview=await f.migration.preview();expect(JSON.stringify([f.store.listTasks(),f.store.listTriggers()])).toBe(before);const result=await f.migration.mutate({operation:'apply',expectedRevisionToken:preview.revisionToken});expect(f.store.getTask(task.id)?.enabled).toBe(true);expect(f.store.getTrigger(trigger.id)?.config.time_zone).toBeTruthy();f.store.updateTask(task.id,{name:'later edit'});await expect(f.migration.mutate({operation:'restore',migration_id:result.records[0]!.id,expectedRevisionToken:(await f.migration.preview()).revisionToken})).rejects.toMatchObject({code:'RESTORE_CONFLICT'})}finally{await f.service.dispose();f.store.close()}
  })
  it('migrates model task to selected original Session and can restore mappings without deleting history',async()=>{
    const f=migrationFixture();const task=f.store.createTask({name:'legacy model',enabled:true,created_by:'web',action:{type:'skill',skill:'daily-report'}});f.store.addTrigger(task.id,{enabled:true,config:{type:'daily',time:'09:00'}})
    try{const result=await f.migration.mutate({operation:'apply',task_id:task.id,session_id:'session-existing',expectedRevisionToken:(await f.migration.preview()).revisionToken});expect(f.catalog).toHaveLength(1);expect(f.catalog[0].sessionId).toBe('session-existing');expect(f.store.getTask(task.id)?.enabled).toBe(false);await f.migration.mutate({operation:'restore',migration_id:result.records[0]!.id,expectedRevisionToken:result.revisionToken});expect(f.catalog).toHaveLength(0);expect(f.store.getTask(task.id)).toBeDefined()}finally{await f.service.dispose();f.store.close()}
  })
  it('rejects non-equivalent month-end model rule and invalid Session without creating reminders',async()=>{
    const f=migrationFixture();const task=f.store.createTask({name:'month-end',enabled:false,created_by:'web',action:{type:'agent_prompt',agent:'legacy',prompt:'report'}});f.store.addTrigger(task.id,{enabled:true,config:{type:'monthly',day:31,time:'09:00'}})
    try{await expect(f.migration.mutate({operation:'apply',task_id:task.id,session_id:'session-existing',expectedRevisionToken:(await f.migration.preview()).revisionToken})).rejects.toBeTruthy();expect(f.catalog).toEqual([])}finally{await f.service.dispose();f.store.close()}
  })
  it('partial model migration failure compensates created official reminders and keeps original records',async()=>{
    const f=migrationFixture();const task=f.store.createTask({name:'legacy',enabled:false,created_by:'web',action:{type:'agent_prompt',agent:'old',prompt:'report'}});f.store.addTrigger(task.id,{enabled:true,config:{type:'daily',time:'09:00'}});f.store.addTrigger(task.id,{enabled:true,config:{type:'weekly',weekday:1,time:'09:00'}})
    const create=f.schedule.create;let calls=0;f.schedule.create=async(...args:Parameters<typeof create>)=>{if(++calls===2)throw Error('injected official failure');return create(...args)}
    try{await expect(f.migration.mutate({operation:'apply',task_id:task.id,session_id:'session-existing',expectedRevisionToken:(await f.migration.preview()).revisionToken})).rejects.toThrow('injected');expect(f.catalog).toEqual([]);expect(f.store.getTask(task.id)).toBeDefined();expect(f.store.listTriggers(task.id)).toHaveLength(2);expect((await f.migration.preview()).records[0]?.state).toBe('failed')}finally{await f.service.dispose();f.store.close()}
  })
  it('already delivered one-shot mapping cannot be removed by recovery',async()=>{
    const f=migrationFixture();const task=f.store.createTask({name:'legacy',enabled:false,created_by:'web',action:{type:'agent_prompt',agent:'old',prompt:'report'}});f.store.addTrigger(task.id,{enabled:true,config:{type:'once',at:'2099-01-01T00:00:00Z'}})
    try{const result=await f.migration.mutate({operation:'apply',task_id:task.id,session_id:'session-existing',expectedRevisionToken:(await f.migration.preview()).revisionToken});f.catalog[0].lastDelivery={messageId:'delivered'};await expect(f.migration.mutate({operation:'restore',migration_id:result.records[0]!.id,expectedRevisionToken:result.revisionToken})).rejects.toMatchObject({code:'RESTORE_CONFLICT'});expect(f.catalog).toHaveLength(1)}finally{await f.service.dispose();f.store.close()}
  })
  it('migration conflict checks history beyond the first thousand rows',async()=>{
    const f=migrationFixture();const task=f.store.createTask({name:'history',enabled:false,created_by:'web',action:{type:'command',command:'node'}})
    f.store.transaction(()=>{for(let i=0;i<1005;i++){const at=new Date(Date.UTC(2020,0,1,0,i)).toISOString();f.store.createRun({id:'history-'+i,task_id:task.id,trigger_id:'manual',scheduled_at:at,status:'success',attempt:1,created_at:at,updated_at:at})}})
    try{const preview=await f.migration.preview();f.store.updateRun('history-0',{output:'later historical update'});await expect(f.migration.mutate({operation:'apply',expectedRevisionToken:preview.revisionToken})).rejects.toMatchObject({code:'MIGRATION_CONFLICT'});expect(f.store.getRun('history-0')?.output).toBe('later historical update')}finally{await f.service.dispose();f.store.close()}
  })

})

describe('owned process cancellation',()=>{
  it('terminates an owned descendant and waits for pipe closure',async()=>{
    const root=mkdtempSync(join(tmpdir(),'automation-descendant-'));
    const script=join(root,'parent.mjs');
    writeFileSync(script, 'import {spawn} from "node:child_process";const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"inherit"});console.log("DESCENDANT="+child.pid);setInterval(()=>{},1000);');
    const controller=new AbortController();let pid:number|undefined;
    const promise=new ChildProcessExecutor().execute({},{type:'script',path:script},{signal:controller.signal,log:line=>{const match=line.match(/DESCENDANT=(\d+)/);if(match)pid=Number(match[1]);}});
    await wait(()=>!!pid);controller.abort();
    const result=await promise;expect(result.error).toContain('取消');
    await wait(()=>{try{process.kill(pid!,0);return false}catch{return true}});
  },10000);
});

describe('migration recovery journal',()=>{
  it('resumes partial official reminder removal without overwriting a later direct edit',async()=>{
    const f=fixture(),{editor}=editorFixture(f.root);const catalog:any[]=[];let id=0,failDelete=true;
    const schedule={async create(sessionId:string,request:any){const item={...request,id:'reminder-'+(++id)};catalog.push({...item,sessionId,status:'active'});return item},async catalog(){return catalog},async delete(request:any){if(failDelete&&request.id==='reminder-2')throw Error('simulated deletion failure');catalog.splice(catalog.findIndex(item=>item.id===request.id),1);return{deleted:true}}};
    const migration=createMigrationBridge(f.store,f.service,editor,schedule,{async list(){return{items:[{sessionId:'original'}]}}});
    const task=f.store.createTask({name:'legacy',enabled:false,created_by:'web',action:{type:'agent_prompt',agent:'unused',prompt:'hello'}});
    f.store.addTrigger(task.id,{enabled:true,config:{type:'daily',time:'09:00'}});f.store.addTrigger(task.id,{enabled:true,config:{type:'daily',time:'10:00'}});
    try{const applied=await migration.mutate({operation:'apply',task_id:task.id,session_id:'original',expectedRevisionToken:(await migration.preview()).revisionToken});const mid=applied.records[0]!.id;
      await expect(migration.mutate({operation:'restore',migration_id:mid,expectedRevisionToken:applied.revisionToken})).rejects.toThrow('simulated');expect(catalog).toHaveLength(1);
      failDelete=false;const restored=await migration.mutate({operation:'restore',migration_id:mid,expectedRevisionToken:(await migration.preview()).revisionToken});expect(restored.records[0]?.state).toBe('restored');expect(catalog).toHaveLength(0);
    }finally{await f.service.dispose();f.store.close()}
  });
});

it('routine backup rotation preserves migration recovery snapshots',async()=>{
  const root=mkdtempSync(join(tmpdir(),'automation-backup-'));const store=new SqliteAutomationStore({homeDir:root,keepBackups:1,skipLegacyMigration:true});
  try{const forced=store.backupNow(true)!;store.backupNow();store.backupNow();expect(readFileSync(forced).length).toBeGreaterThan(0);store.restoreSnapshot(forced)}finally{store.close()}
});

it('every configuration field rejects invalid values and stale tokens without changing any owner',async()=>{
 const root=mkdtempSync(join(tmpdir(),'automation-eight-invalid-')),{editor,rows}=editorFixture(root),bridge=createSettingsBridge(editor,()=>false);
 for(const owner of bridge.describe()) for(const field of owner.fields){const before=JSON.stringify(rows),value=field.path==='timeZone'?'Invalid/Zone':field.path==='dataDir'?editor.documentPath:Number(field.min??0)-1;
 const request={owner:owner.owner,entryId:owner.entryId,expectedRevisionToken:owner.revisionToken,operations:[{op:'set',path:field.path,value}]};
 await expect(bridge.save(request)).rejects.toMatchObject({code:'INVALID_VALUE'});expect(JSON.stringify(rows)).toBe(before);
 await expect(bridge.save({...request,expectedRevisionToken:'stale'})).rejects.toMatchObject({code:'CONFIG_CONFLICT'});expect(JSON.stringify(rows)).toBe(before);}
});
