import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createContext,runInContext} from 'node:vm'
it('built client registers one official-detail extension and a direct panel without a sidebar',()=>{
  let entry:any;const sandbox:any={window:{__ModuleLoader__:{load:(value:any)=>entry=value}},console,Intl,setInterval,clearInterval,setTimeout,clearTimeout};
  const styles:any[]=[];sandbox.document={createElement:()=>({setAttribute(){},textContent:''}),head:{appendChild:(style:any)=>styles.push(style),querySelectorAll:()=>[]}};
  runInContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),createContext(sandbox));
  expect(entry.id).toBe('dsh-automation');
  const react={createElement:(type:any,props:any,...children:any[])=>({type,props,children}),useState:(value:any)=>[typeof value==='function'?value():value,()=>{}],useEffect:()=>{}};
  const client=entry.factory((name:string)=>name==='react'?react:{});const slots:any[]=[];
  client.apply({slots:{inject:(_name:string,fn:()=>void)=>fn(),register:(spec:any,component:any)=>slots.push({spec,component})},layout:{selectPanel(){}},effect:(fn:any)=>fn()});
  expect(slots.map(item=>item.spec.name)).toEqual(['main','plugins.detail.section']);expect(styles).toHaveLength(1);
  const details=slots[1].component({subject:{kind:'bundle',pkg:{name:'@deepseek-ai/dsh-experimental-schedule-bundle'}}});
  expect(details.type(details.props)).toBeTruthy();expect(slots[0].component().type({})).toBeTruthy();
  expect(slots[1].component({subject:{kind:'bundle',pkg:{name:'other'}}})).toBeNull();
})
