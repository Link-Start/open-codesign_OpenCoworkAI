// Publication revision: portable checkout dependency resolution.
import {productPackageURL, productFileURL, runtimeDirectory, rootRequire} from '../publication/paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPublicCheckV1} from '../src/methods-v1-public-checks.mjs';
import {sha256} from '../src/methods-v1.mjs';
const requireProduct=createRequire(productPackageURL());
const {parse}=requireProduct('@babel/parser');
// Real parser + explicit compiler control. This tests parsing/ABI boundary, not runtime compilation correctness.
const Babel={transform(source,options){return options.ast?{ast:parse(source,{sourceType:'module',plugins:['jsx']})}:{code:'trusted-compiler-control'};}};
const source='function App(){return <p>old</p>}';
function input(content){return {source,content,candidateHash:sha256(content),patches:[{start:0,end:source.length,expectedText:source,replacement:content}]};}
test('common postcheck performs actual JSX parse and entry validation',async()=>{
 const check=createPublicCheckV1({Babel,safetyCheck:async()=>({pass:true})});
 const valid=await check(input('function App(){return <p>new</p>}'));assert.ok(valid.checks.every(c=>c.pass));
 const malformed=await check(input('function App(){return <p>'));assert.equal(malformed.checks[0].pass,false);assert.equal(malformed.checks[1].pass,false);
 const module=await check(input('export default function App(){return <p>new</p>}'));assert.equal(module.checks[0].pass,true);assert.equal(module.checks[1].pass,false);
});
test('common check requires independent safety, retains patch/hash checks',async()=>{
 assert.throws(()=>createPublicCheckV1({Babel}),/SAFETY_REQUIRED/);
 const check=createPublicCheckV1({Babel,safetyCheck:async()=>({pass:false})});assert.equal((await check(input(source))).checks[2].pass,false);
 let calls=0;const valid=createPublicCheckV1({Babel,safetyCheck:async()=>{calls++;return {pass:true};}});
 assert.equal((await valid({...input(source),candidateHash:'bad'})).checks[2].pass,false);assert.equal(calls,0);
});
