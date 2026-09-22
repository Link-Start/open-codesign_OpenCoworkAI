// Publication revision: portable checkout dependency resolution.
import {productPackageURL, productFileURL, runtimeDirectory, rootRequire} from '../publication/paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { APP_SCRIPT_ENTRY_CONTRACT, compileAppScriptR2 } from '../src/entry-contract-r2.mjs';
const trustedBytes = await readFile(productFileURL('packages/runtime/vendor/babel.standalone.js'), 'utf8');
const context = vm.createContext({});
new vm.Script(trustedBytes).runInContext(context, { timeout: 15000 }); // Trusted vendor only.
const Babel = context.Babel;
const compile = source => compileAppScriptR2({ source, Babel });
test('formal App compiles JSX without adding mount or changing source bytes', () => {
  const source = 'function App(){ return <main>Hello</main>; }', before = Buffer.from(source);
  const result = compile(source); assert.equal(result.entryName, 'App'); assert.equal(result.entryContract, APP_SCRIPT_ENTRY_CONTRACT);
  assert.match(result.code, /React.createElement/); assert.doesNotMatch(result.code, /ReactDOM|createRoot|module\.exports/);
  assert.deepEqual(Buffer.from(source), before);
});
test('function const and let App/_App align with product declaration kinds', () => {
  for (const source of ['function _App(){return <div/>}', 'const App=()=> <div/>;', 'let _App=function(){return <div/>};']) assert.ok(['App','_App'].includes(compile(source).entryName));
});
test('App has precedence when both names exist; exactly one selected entry', () => {
  const result = compile('function _App(){return <p/>}; function App(){return <main/>}');
  assert.equal(result.entryName, 'App'); assert.equal(result.selectionRule, 'App-before-_App'); assert.deepEqual(result.declaredEntries, ['_App','App']);
});
test('comments strings and nested declarations cannot spoof a top-level entry', () => {
  for (const source of ['// function App(){}\nconst text="const App =";', 'function Outer(){function App(){return <p/>}}', 'if(true){let App=()=> <p/>}', 'var App=()=> <p/>', 'class App {}']) assert.throws(() => compile(source), /APP_SCRIPT_ENTRY_MISSING/);
});
test('formal contract rejects default export, imports, exports and dynamic imports', () => {
  for (const source of ['export default function App(){return <p/>}', 'import React from "react"; function App(){return <p/>}', 'function App(){return <p/>};export {App};', 'function App(){return <p/>};import("x");']) assert.throws(() => compile(source), /APP_SCRIPT_MODULE_SYNTAX_FORBIDDEN/);
});
test('self-mount and mount aliases are rejected rather than duplicated', () => {
  for (const source of ['ReactDOM.createRoot(x).render(<App/>);', 'createRoot(x);', 'hydrateRoot(x,<App/>);', 'ReactDOM["render"](<App/>,x);', 'const {createRoot:r}=ReactDOM;r(x);']) assert.throws(() => compile('function App(){return <p/>};'+source), /APP_SCRIPT_SELF_MOUNT_FORBIDDEN/);
});
test('stateful complex code is not rejected merely outside native editor support', () => {
  const source = 'const data=[1,2,3];function Child({value}){return <span>{value}</span>};function App(){const [n,setN]=React.useState(0);React.useEffect(()=>{setN(1)},[]);return <main>{data.map(v=><Child key={v} value={v+n}/>)}<button onClick={()=>setN(x=>x+1)}>Add</button></main>}';
  assert.equal(compile(source).entryName, 'App');
});
test('compile-only does not execute top-level or component candidate JavaScript in Node', () => {
  const source = 'throw new Error("CANDIDATE_EXECUTED");function App(){throw new Error("COMPONENT_EXECUTED");return <div/>}';
  const result = compile(source); assert.match(result.code, /CANDIDATE_EXECUTED/); assert.equal(result.entryName, 'App');
});
test('invalid syntax and missing trusted compiler fail with distinct protocol codes', () => {
  assert.throws(() => compile('function App( {'), /APP_SCRIPT_PARSE_ERROR/);
  assert.throws(() => compileAppScriptR2({source:'function App(){}'}), /TRUSTED_BABEL_REQUIRED/);
});

test('nonreferenced data property names are not mistaken for ReactDOM self-mount', () => {
  assert.equal(compile('const labels={ReactDOM:"public label"};function App(){return <p>{labels.ReactDOM}</p>}').entryName,'App');
});
