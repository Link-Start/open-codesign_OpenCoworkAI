// Pure replay of the observer's finite structured runtime journal; no page execution.
import {isDeepStrictEqual} from 'node:util';
import {copyR3,hashBytesR3} from './evaluation-plan-r3.mjs';
export function normalizeRuntimeJournalR3(journal,{runKey,sourceSha256,runId}){
 const events=[];if(!journal||!Array.isArray(journal.journals)||!Array.isArray(journal.events))return{complete:false,events};
 let complete=journal.available===true&&journal.complete===true&&journal.journals.length>0&&Number.isInteger(journal.throughEventSequence);
 const journals=journal.journals,epochs=new Map;
 if(!journals.every(j=>Array.isArray(j.events))||!isDeepStrictEqual(journals.flatMap(j=>j.events??[]),journal.events))complete=false;
 for(const [index,j]of journals.entries()){if(j.sourceSha256!==sourceSha256||j.available!==true||j.complete!==true||j.droppedEvents!==0)complete=false;if(Number.isInteger(j.renderEpoch)&&j.sourceSha256===sourceSha256&&j.available===true){if(epochs.has(j.renderEpoch))complete=false;else epochs.set(j.renderEpoch,index)}}
 const methods={'runtime-exception':'Runtime.exceptionThrown','unhandled-promise-rejection':'Runtime.exceptionThrown','console-error':'Runtime.consoleAPICalled','browser-log-error':'Log.entryAdded','exception-revoked':'Runtime.exceptionRevoked'};let previous=0;
 for(const native of journal.events){
  const valid=Number.isInteger(native.eventSequence)&&native.eventSequence>previous&&native.eventSequence<=journal.throughEventSequence&&epochs.has(native.renderEpoch)&&methods[native.category]===native.native?.method&&typeof native.name==='string'&&typeof native.message==='string'&&typeof native.replayStage?.kind==='string'&&Number.isInteger(native.replayStage.sequence)&&native.replayStage.sequence>=0;
  previous=native.eventSequence;if(!valid)complete=false;if(native.category==='exception-revoked')continue;
  // Source URL/line/column stay evidence only. Planned reload ordinal avoids conflating distinct replay phases.
    let identityMessage=native.message;
  if(native.category==='console-error'&&Array.isArray(native.native?.params?.args))identityMessage=native.native.params.args.map(a=>a.value!==undefined?String(a.value):a.subtype==='error'?String(a.description??a.className??'Error').split('\n')[0]:a.description??a.type??'').join(' ');
  const signature=valid?{category:native.category,location:JSON.stringify([runKey,epochs.get(native.renderEpoch),native.replayStage.kind,native.replayStage.sequence]),code:hashBytesR3(JSON.stringify([native.name,identityMessage]))}:null;
  events.push({runKey,kind:'runtime-error',confirmed:valid,signature,evidence:{sourceSha256,runId,native:copyR3(native),locationContract:'scenario-reload-ordinal-and-public-replay-stage-not-source-line'}});
 }
 return{complete,events};
}
