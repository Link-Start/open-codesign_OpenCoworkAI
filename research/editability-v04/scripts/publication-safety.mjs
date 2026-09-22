// Publication WIP boundary, not a runtime admission or scientific evidence check.
// Uses only Node built-ins: no product discovery, file I/O, or network.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function isDirectInvocation(moduleURL){
  if(!process.argv[1])return false;
  const invoked=resolve(process.argv[1]),modulePath=fileURLToPath(moduleURL);
  return process.platform==='win32'
    ?invoked.toLowerCase()===modulePath.toLowerCase()
    :invoked===modulePath;
}

export function blockPublicationNativeExecution(){
  const code='PUBLICATION_NATIVE_EXECUTION_BLOCKED';
  throw Object.assign(new Error(code+': publication WIP P0: implement and consume native evidence seal; validate new container allow-forms negative controls, keyboard/style/raw identity and journal/latest-source contract in full calibration; independently review admission. Native execution disabled; this is not a passed calibration.'),{code});
}

/** Call before loading optional dependencies or evaluating any executable body. */
export function publicationCLI(moduleURL){
  if(!isDirectInvocation(moduleURL))return;
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--check-only'){
    console.log(JSON.stringify({
      schemaVersion:'publication-safety-check-1',status:'WIP',evidence:'non-evidence',
      executed:false,nativeExecutionAllowed:false,formalReady:false,
      formalExecutionAuthorized:false,noScientificOutcomesClaimed:true,
      writes:0,browserCalls:0,modelCalls:0,networkCalls:0,
      reason:'Publication WIP safety check only; this does not validate calibration, admission, or scientific results.',
      pendingP0:['Integrate native raw/journal evidence seal and normalizer consumption','Validate container allow-forms negative controls','Run full calibration for keyboard/style/raw identity and journal/latest-source producer','Independent admission review before enabling any native execution']
    }));
    process.exit(0);
  }
  blockPublicationNativeExecution();
}

publicationCLI(import.meta.url);
