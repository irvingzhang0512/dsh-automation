import { expect, it } from 'vitest'
import { createSettingsBridge, type ConfigEditor, type ConfigRow } from '../src/host/settings.ts'
function fixture() {
 const rows:ConfigRow[]=['standard','ptc','cordis'].map(id=>({entry:{options:{id:'preset-'+id,name:'@deepseek-ai/dsh-agent-preset',config:{id,unknown:'preserve',plugins:[{id:'other',name:'example',config:{secretReference:'KEEP'}},{id:'time-context',name:'@deepseek-ai/dsh-time-context',config:{unknown:'clock',timeZone:'Asia/Shanghai',refreshIntervalMs:600000}}]}},fiber:{runtime:{Config:{}},config:{}}},inherited:{},override:{}}))
 for(const row of rows)row.entry.fiber!.config=row.entry.options.config
 let beforeEdit:(id:string)=>void=()=>{}
 const editor:ConfigEditor={documentPath:'unused',configuration:()=>rows,async edit(entry,change){beforeEdit(entry.options.id);const next=change(entry.options.config??{},{ });entry.options.config=next;entry.fiber!.config=next}}
 return{rows,editor,bridge:createSettingsBridge(editor,()=>false),onEdit(fn:(id:string)=>void){beforeEdit=fn}}
}
const clock=(row:ConfigRow)=>(row.entry.options.config!.plugins as any[]).find(p=>p.id==='time-context').config
function request(f:ReturnType<typeof fixture>,operations:any[]){const owner=f.bridge.describe().find(row=>row.owner==='time-context')!;return{owner:'time-context',entryId:owner.entryId,expectedRevisionToken:owner.revisionToken,operations}}
it('edits the owned clock fields across real preset owners while preserving other plugins and unknown data',async()=>{
 const f=fixture(),other=f.rows.map(row=>structuredClone((row.entry.options.config!.plugins as any[])[0]))
 expect(f.bridge.describe().find(x=>x.owner==='time-context')!.writable).toBe(true)
 await f.bridge.save(request(f,[{op:'set',path:'refreshIntervalMs',value:300000}]))
 for(const [index,row]of f.rows.entries()){expect(clock(row)).toEqual({unknown:'clock',timeZone:'Asia/Shanghai',refreshIntervalMs:300000});expect(row.entry.options.config!.unknown).toBe('preserve');expect((row.entry.options.config!.plugins as any[])[0]).toEqual(other[index])}
 await f.bridge.save(request(f,[{op:'unset',path:'timeZone'}]));expect(f.rows.every(row=>!Object.hasOwn(clock(row),'timeZone'))).toBe(true)
})
it('keeps differing per-preset settings read-only instead of replacing their special values',async()=>{
 const f=fixture();clock(f.rows[0]!).timeZone='UTC';const before=JSON.stringify(f.rows)
 const owner=f.bridge.describe().find(x=>x.owner==='time-context')!;expect(owner.writable).toBe(false)
 await expect(f.bridge.save(request(f,[{op:'set',path:'timeZone',value:'Europe/London'}]))).rejects.toMatchObject({code:'CONFIG_CONFLICT'})
 expect(JSON.stringify(f.rows)).toBe(before)
})
it('detects changes after preview and validates every operation before any write',async()=>{
 const f=fixture(),stale=request(f,[{op:'set',path:'timeZone',value:'UTC'}]);clock(f.rows[0]!).refreshIntervalMs=1
 await expect(f.bridge.save(stale)).rejects.toMatchObject({code:'CONFIG_CONFLICT'})
 clock(f.rows[0]!).refreshIntervalMs=600000;const before=JSON.stringify(f.rows)
 await expect(f.bridge.save(request(f,[{op:'set',path:'timeZone',value:'UTC'},{op:'set',path:'refreshIntervalMs',value:-1}]))).rejects.toMatchObject({code:'INVALID_VALUE'})
 expect(JSON.stringify(f.rows)).toBe(before)
})
it('restores the completed preset when the next owner fails',async()=>{
 const f=fixture(),before=JSON.stringify(f.rows);let writes=0
 f.onEdit(()=>{if(++writes===2)throw Error('second owner failed')})
 await expect(f.bridge.save(request(f,[{op:'set',path:'timeZone',value:'UTC'}]))).rejects.toThrow('second owner failed')
 expect(JSON.stringify(f.rows)).toBe(before)
})
it('does not roll back a concurrent edit made after the first preset was saved',async()=>{
 const f=fixture();let writes=0
 f.onEdit(()=>{if(++writes===2){clock(f.rows.find(row=>row.entry.options.id==='preset-cordis')!).timeZone='Europe/London';throw Error('later failure')}})
 await expect(f.bridge.save(request(f,[{op:'set',path:'timeZone',value:'UTC'}]))).rejects.toMatchObject({code:'CONFIG_RECOVERY_CONFLICT'})
 expect(clock(f.rows.find(row=>row.entry.options.id==='preset-cordis')!).timeZone).toBe('Europe/London')
})
