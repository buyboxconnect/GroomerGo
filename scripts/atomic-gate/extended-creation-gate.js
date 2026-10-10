// CLI exec, authenticated admin; never emit SDK error objects or capabilities.
const runId=crypto.randomUUID();
const report={type:'report',gate:'extended-concurrent-creation',runId,checks:[],passed:false};
const assert=(v,label)=>{if(!v)throw new Error(label)};
const call=async body=>{try{const r=await base44.functions.invoke('creation-sync-probe',{runId,...body});return {status:r.status||200,data:r.data}}catch(e){return {status:e?.status||e?.response?.status||0,data:e?.data||e?.response?.data}}};
const check=(name,passed,details={})=>{report.checks.push({name,passed,...details});if(!name.startsWith('concurrent-creation-'))assert(passed,name.toUpperCase().replaceAll('-','_'))};
const pause=()=>new Promise(r=>setTimeout(r,12000));
try{
 const seed=await call({action:'prepare'});assert(seed.status===200,'PREPARE_FAILED');
 const recordUUID=crypto.randomUUID();
 const mutation={schemaVersion:1,businessId:seed.data.businessId,recordUUID,recordType:'service',operationId:crypto.randomUUID(),baseRevision:0,action:'put',payloadJSON:JSON.stringify({name:'Disposable concurrency fixture',durationMinutes:60,priceMinor:5000,depositMinor:1000,prepInstructions:'Disposable fixture only'})};
 for(let round=0;round<10;round++){
  const id=crypto.randomUUID();const start=Date.now();
  const results=await Promise.all(Array.from({length:8},()=>call({action:'reserve',mutation:{businessId:mutation.businessId,recordUUID:id}})));
  const ids=new Set(results.map(r=>r.data?.id));
  const inspect=await call({action:'inspect'});
  check('concurrent-creation-'+round,results.every(r=>r.status===200)&&ids.size===1&&inspect.data?.records.filter(r=>r.recordUUID===id).length===1,{writers:8,storedMatches:inspect.data?.records.filter(r=>r.recordUUID===id).length,storedRunCount:inspect.data?.count,statuses:results.map(r=>r.status),distinctIDs:ids.size,errors:results.filter(r=>r.status!==200).map(r=>({status:r.status,code:r.data?.code,stage:r.data?.stage,upstreamStatus:r.data?.upstreamStatus})),created:results.reduce((n,r)=>n+(r.data?.created||0),0),elapsedMs:Date.now()-start});
  await pause();
  const settled=await call({action:'inspect'});report.checks[report.checks.length-1].settledMatches=settled.data?.records.filter(r=>r.recordUUID===id).length;
  console.log(JSON.stringify({type:'round',...report.checks[report.checks.length-1]}));
 }
 report.passed=report.checks.every(c=>c.passed && c.settledMatches===1);
}catch(e){report.failure=e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:'HARNESS_FAILED'}
finally{const r=await call({action:'cleanup'});report.cleanup={status:r.status,remaining:r.data?.remaining};if(r.status!==200||r.data?.remaining!==0)report.passed=false;report.finishedAt=new Date().toISOString();console.log(JSON.stringify(report));}
