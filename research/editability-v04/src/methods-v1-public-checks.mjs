import {compileAppScriptR2} from './entry-contract-r2.mjs';
import {rebuildPatch,sha256,immutable} from './methods-v1.mjs';
// Source is parsed/compiled as data, never executed by this common postcheck.
// The executor owner supplies the frozen common safety policy, not a product edit-support guard.
export function createPublicCheckV1({Babel,safetyCheck}={}) {
  if(typeof Babel?.transform!=='function'||typeof safetyCheck!=='function')throw new Error('TRUSTED_COMPILER_AND_COMMON_SAFETY_REQUIRED');
  return async input=>{
    let parse=false,entry=false,patchSafety=false;
    try { Babel.transform(input.content,{ast:true,code:false,presets:[],plugins:[],sourceType:'module',parserOpts:{plugins:['jsx']},filename:'candidate.jsx',babelrc:false,configFile:false});parse=true; }catch{}
    if(parse)try{compileAppScriptR2({source:input.content,Babel});entry=true;}catch{}
    try {
      const rebuilt=rebuildPatch(input.source,input.patches);
      if(rebuilt===input.content&&sha256(rebuilt)===input.candidateHash){
        const safety=await safetyCheck(immutable({source:input.source,content:input.content}));
        patchSafety=safety?.pass===true;
      }
    }catch{}
    return immutable({checks:[{key:'parse',pass:parse},{key:'entry',pass:entry},{key:'patch-safety',pass:patchSafety}]});
  };
}
