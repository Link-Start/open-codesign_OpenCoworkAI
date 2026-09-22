export default function ValueMatrix(){
 const [accept,setAccept]=React.useState('seed'),[reject,setReject]=React.useState('seed'),[restore,setRestore]=React.useState('seed');
 const [ta,setTa]=React.useState('seed'),[tr,setTr]=React.useState('seed');
 const [mounted,setMounted]=React.useState(false),[bottom,setBottom]=React.useState(0),[inner,setInner]=React.useState(0);
 return <><style>{'html,body{margin:0;padding:0}main{padding:12px}label{display:block;margin:4px}input,textarea{width:160px}button{min-height:40px}.override{display:block}#spacer{height:1600px}#inner-scroll{height:160px;width:260px;overflow:auto}#inner-content{height:800px;width:600px;position:relative}#inner-button{position:absolute;left:450px;top:700px}'}</style><main>
 {['empty','zero','seed','space'].map((name,i)=><label key={'i'+name}>Input {name}<input id={'i-'+name} aria-label={'Input '+name} defaultValue={['','0','seed',' '][i]}/></label>)}
 {['empty','zero','seed','space'].map((name,i)=><label key={'t'+name}>Textarea {name}<textarea id={'t-'+name} aria-label={'Textarea '+name} defaultValue={['','0','seed',' '][i]}/></label>)}
 <label>Textarea newline<textarea id="t-newline" aria-label="Textarea newline" defaultValue={'line1\nline2\n'.replaceAll('\\n','\n')}/></label>
 <input id="hidden-input" aria-label="Hidden input" hidden defaultValue="seed"/>
 <input id="override-input" aria-label="Override input" hidden className="override" defaultValue=""/>
 <div role="group" aria-label="Duplicate context"><input aria-label="Duplicate input" defaultValue="seed"/></div>
 <div role="group" aria-label="Duplicate context" hidden className="override"><input aria-label="Duplicate input" defaultValue=""/></div>
 <input id="n-empty" type="number" aria-label="Number empty" defaultValue=""/><input id="n-zero" type="number" aria-label="Number zero" defaultValue="0"/>
 <input id="readonly-seed" aria-label="Readonly seed" readOnly defaultValue="seed"/><input id="readonly-empty" aria-label="Readonly empty" readOnly defaultValue=""/>
 <input id="disabled-seed" aria-label="Disabled seed" disabled defaultValue="seed"/><input id="disabled-empty" aria-label="Disabled empty" disabled defaultValue=""/>
 <input id="visibility-seed" aria-label="Visibility hidden seed" style={{visibility:'hidden'}} defaultValue="seed"/><input id="visibility-empty" aria-label="Visibility hidden empty" style={{visibility:'hidden'}} defaultValue=""/>
 <input id="aria-seed" aria-label="Aria hidden seed" aria-hidden="true" defaultValue="seed"/><input id="aria-empty" aria-label="Aria hidden empty" aria-hidden="true" defaultValue=""/>
 <div id="migration-a" role="group" aria-label="Migration context"><input id="migrating" aria-label="Migrating input" defaultValue="seed"/></div><div id="migration-b" role="group" aria-label="Empty context"/>
 <button onClick={()=>{const el=document.getElementById('migrating'),old=el.parentElement,dest=document.getElementById(old.id==='migration-a'?'migration-b':'migration-a');dest.appendChild(el);old.setAttribute('aria-label','Old context');dest.setAttribute('aria-label','Migration context')}}>Move context</button>
 <textarea id="ct-accept" aria-label="Textarea accept clear" value={ta} onChange={e=>setTa(e.target.value)}/>
 <textarea id="ct-reject" aria-label="Textarea reject clear" value={tr} onChange={e=>setTr(e.target.value||'seed')}/>
 <input id="c-accept" aria-label="Accept clear" value={accept} onChange={e=>setAccept(e.target.value)}/>
 <input id="c-reject" aria-label="Reject clear" value={reject} onChange={e=>setReject(e.target.value||'seed')}/>
 <input id="c-restore" aria-label="Restore clear" value={restore} onChange={e=>{setRestore(e.target.value);if(e.target.value==='')setTimeout(()=>setRestore('seed'),200)}}/>
 <button id="mount" onClick={()=>setMounted(true)}>Mount</button>{mounted&&<input id="dynamic" aria-label="Dynamic input" defaultValue=""/>}
 <button id="unmount" onClick={()=>setMounted(false)}>Unmount</button>
 <div id="spacer"/><button id="bottom" onClick={()=>setBottom(n=>n+1)}>Bottom {bottom}</button>
 <div id="inner-scroll"><div id="inner-content"><button id="inner-button" onClick={()=>setInner(n=>n+1)}>Inner {inner}</button></div></div>
 </main></>;
}
