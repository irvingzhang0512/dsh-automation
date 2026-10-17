import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BASE_VERSION, BUNDLE, SCHEDULE_PACKAGES, compatibilityFacts } from '../src/host/compatibility.ts'
const roots: string[]=[]
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})})
function fixture() {
 const root=mkdtempSync(join(tmpdir(),'automation-0212-compat-'));roots.push(root)
 writeFileSync(join(root,'package.json'),JSON.stringify({dsh:{profile:{bundles:[BUNDLE]}}}))
 writeFileSync(join(root,'anchor.json'),JSON.stringify({version:BASE_VERSION}))
 const rows=['@deepseek-ai/dsh-schedule','@deepseek-ai/dsh-client-ui-schedule'].map(name=>({entry:{options:{name,id:name},parent:{tree:{ctx:{baseUrl:'file:///fixture/'}}}},inherited:{},override:{}}))
 const versions: Record<string,string>=Object.fromEntries(SCHEDULE_PACKAGES.map(name=>[name,BASE_VERSION]))
 const ctx={fiber:{entry:{parent:{tree:{ctx:{baseUrl:'file:///fixture/'}}}}},get(name:string){return name==='profileContext'?{installAnchor:join(root,'anchor.json')}:{packageOf:(pkg:string)=>versions[pkg]?{version:versions[pkg]}:undefined}}}
 return{root,rows,versions,ctx,editor:{documentPath:join(root,'cordis.patch.yml'),configuration:()=>rows,edit:async()=>{}}}
}
it('validates built-in schedule without the retired Bundle or a global time-context instance',()=>{
 const f=fixture();expect(compatibilityFacts(f.ctx,f.editor).matched).toBe(true)
 expect(compatibilityFacts(f.ctx,f.editor).actual['@deepseek-ai/dsh-time-context']).toBe(BASE_VERSION)
})
it('refuses disabled built-in surface, wrong runtime package, wrong Desktop and duplicate service',()=>{
 const f=fixture();f.versions['@deepseek-ai/dsh-schedule']='0.2.0-rc.2';expect(compatibilityFacts(f.ctx,f.editor).matched).toBe(false)
 f.versions['@deepseek-ai/dsh-schedule']=BASE_VERSION;f.rows.push(f.rows[0]!);expect(compatibilityFacts(f.ctx,f.editor).matched).toBe(false);f.rows.pop()
 writeFileSync(join(f.root,'package.json'),JSON.stringify({dsh:{profile:{bundles:[]}}}));expect(compatibilityFacts(f.ctx,f.editor).matched).toBe(false)
 writeFileSync(join(f.root,'package.json'),JSON.stringify({dsh:{profile:{bundles:[BUNDLE]}}}));writeFileSync(join(f.root,'anchor.json'),JSON.stringify({version:'0.2.0-rc.2'}));expect(compatibilityFacts(f.ctx,f.editor).matched).toBe(false)
})
