// Authenticated admin CLI; no capability or caught SDK error is printed.
const seed=JSON.parse(await Deno.readTextFile('/private/tmp/groomergo-two-device.json'));
const report={type:'report',gate:'actual-two-simulator-server-verification',runId:seed.runId,passed:false};
const call=async action=>{try{const r=await base44.functions.invoke('creation-sync-probe',{action,runId:seed.runId});return {status:r.status||200,data:r.data}}catch(e){return {status:e?.status||e?.response?.status||0,data:{code:e?.data?.code||e?.response?.data?.code}}}};
try{
 const inspected=await call('inspect');
 report.inspectStatus=inspected.status;report.records=inspected.data?.records;report.count=inspected.data?.count;
 report.passed=inspected.status===200&&report.count===1&&report.records[0].recordUUID===seed.recordUUID&&report.records[0].revision===1&&report.records[0].receiptCount===1;
}finally{
 const cleanup=await call('cleanup');report.cleanup={status:cleanup.status,remaining:cleanup.data?.remaining,deleted:cleanup.data?.deleted};
 report.passed=report.passed&&cleanup.status===200&&cleanup.data?.remaining===0;
 report.finishedAt=new Date().toISOString();console.log(JSON.stringify(report));
}
