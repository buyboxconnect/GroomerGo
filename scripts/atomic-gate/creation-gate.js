// CLI exec, authenticated admin; never emit SDK error objects or capabilities.
const runId=crypto.randomUUID();
const report={type:'report',gate:'creation-and-idempotency',runId,checks:[],passed:false};
const assert=(v,label)=>{if(!v)throw new Error(label)};
const call=async body=>{try{const r=await base44.functions.invoke('creation-sync-probe',{runId,...body});return {status:r.status||200,data:r.data}}catch(e){return {status:e?.status||e?.response?.status||0,data:e?.data||e?.response?.data}}};
const check=(name,passed,details={})=>{report.checks.push({name,passed,...details});if(!name.startsWith('concurrent-creation-'))assert(passed,name.toUpperCase().replaceAll('-','_'))};
const pause=()=>new Promise(r=>setTimeout(r,12000));
try{
 const seed=await call({action:'prepare'});assert(seed.status===200,'PREPARE_FAILED');
 const recordUUID=crypto.randomUUID();
 const mutation={schemaVersion:1,businessId:seed.data.businessId,recordUUID,recordType:'service',operationId:crypto.randomUUID(),baseRevision:0,action:'put',payloadJSON:JSON.stringify({name:'Disposable concurrency fixture',durationMinutes:60,priceMinor:5000,depositMinor:1000,prepInstructions:'Disposable fixture only'})};
 for(let round=0;round<3;round++){
  const id=crypto.randomUUID();const start=Date.now();
  const results=await Promise.all(Array.from({length:8},()=>call({action:'reserve',mutation:{businessId:mutation.businessId,recordUUID:id}})));
  const ids=new Set(results.map(r=>r.data?.id));
  const inspect=await call({action:'inspect'});
  check('concurrent-creation-'+round,results.every(r=>r.status===200)&&ids.size===1&&inspect.data?.records.filter(r=>r.recordUUID===id).length===1,{writers:8,storedMatches:inspect.data?.records.filter(r=>r.recordUUID===id).length,storedRunCount:inspect.data?.count,statuses:results.map(r=>r.status),distinctIDs:ids.size,errors:results.filter(r=>r.status!==200).map(r=>({status:r.status,code:r.data?.code,stage:r.data?.stage,upstreamStatus:r.data?.upstreamStatus})),created:results.reduce((n,r)=>n+(r.data?.created||0),0),elapsedMs:Date.now()-start});
  await pause();
 }
 assert((await call({action:'reserve',mutation:{businessId:mutation.businessId,recordUUID}})).status===200,'SEQUENTIAL_RESERVE_FAILED');
 const responses=await Promise.all(Array.from({length:8},()=>call({action:'push',mutation})));
 let inspect=await call({action:'inspect'});let stored=inspect.data.records.find(r=>r.recordUUID===recordUUID);
 check('concurrent-identical-operation',responses.every(r=>r.status===200)&&responses.filter(r=>r.data.status==='applied').length===1&&responses.filter(r=>r.data.status==='replayed').length===7&&stored.revision===1&&stored.receiptCount===1,{applied:responses.filter(r=>r.data?.status==='applied').length,replayed:responses.filter(r=>r.data?.status==='replayed').length,revision:stored.revision,receiptCount:stored.receiptCount});
 await pause();
 const replay=await call({action:'push',mutation});check('lost-response-retry',replay.status===200&&replay.data.status==='replayed'&&replay.data.record.revision===1);
 const changed=await call({action:'push',mutation:{...mutation,payloadJSON:mutation.payloadJSON.replace('concurrency','changed')}});check('operation-id-reuse-rejected',changed.status===409&&changed.data.code==='OPERATION_ID_REUSED');
 const next={...mutation,operationId:crypto.randomUUID(),baseRevision:1};
 const other={...next,operationId:crypto.randomUUID(),payloadJSON:mutation.payloadJSON.replace('concurrency','other')};
 const rivals=await Promise.all([call({action:'push',mutation:next}),call({action:'push',mutation:other})]);
 check('different-operation-conflict',rivals.filter(r=>r.status===200).length===1&&rivals.filter(r=>r.status===409).length===1);
 const old=await call({action:'push',mutation});inspect=await call({action:'inspect'});stored=inspect.data.records.find(r=>r.recordUUID===recordUUID);
 check('old-receipt-does-not-reset-record',old.status===200&&old.data.record.revision===1&&stored.revision===2&&stored.receiptCount===2);
 // Save a fresh scoped capability for native Simulator tests. Never print it.
 const nativeRunId=crypto.randomUUID();
 const native=await base44.functions.invoke('creation-sync-probe',{action:'prepare',runId:nativeRunId});
 const nativeRecordId=crypto.randomUUID();
 const reserve=await base44.functions.invoke('creation-sync-probe',{action:'reserve',runId:nativeRunId,mutation:{businessId:native.data.businessId,recordUUID:nativeRecordId}});
 assert(reserve.status===200,'NATIVE_RESERVE_FAILED');
 await Deno.writeTextFile('/private/tmp/groomergo-native-validation.json',JSON.stringify({...native.data,recordUUID:nativeRecordId}),{mode:0o600});
 report.nativeRunId=nativeRunId;
 report.passed=report.checks.every(c=>c.passed);
}catch(e){report.failure=e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:'HARNESS_FAILED'}
finally{const r=await call({action:'cleanup'});report.cleanup={status:r.status,remaining:r.data?.remaining};if(r.status!==200||r.data?.remaining!==0)report.passed=false;report.finishedAt=new Date().toISOString();console.log(JSON.stringify(report));}
