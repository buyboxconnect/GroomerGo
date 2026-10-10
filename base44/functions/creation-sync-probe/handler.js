// Diagnostic only: two-hour capabilities can touch only synthetic probe rows.
// No production entity is read or written by this handler.
const headers={'Cache-Control':'no-store'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=(status,code)=>{throw{local:true,status,code}};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const present=row=>({businessId:row.businessId,recordUUID:row.recordUUID,recordType:row.recordType,revision:row.revision,payloadJSON:row.payloadJSON});

export async function handleCreationProbe(request,client) {
  if(request.method!=='POST')return Response.json({code:'METHOD_NOT_ALLOWED'},{status:405,headers});
  let stage='input';
  try {
    const text=await request.text(); if(text.length>70000)fail(400,'REQUEST_TOO_LARGE');
    let input;try{input=JSON.parse(text)}catch{fail(400,'INVALID_INPUT')}
    if(!input||typeof input!=='object'||Array.isArray(input)||!uuid.test(input.runId??''))fail(400,'INVALID_INPUT');
    const capability=request.headers.get('X-GroomerGo-Probe-Capability');
    const entities=client.asServiceRole.entities;
    let user;
    if(!capability){
      stage='auth';try{user=await client.auth.me()}catch(error){if([401,403].includes(error?.status))fail(401,'UNAUTHORIZED');throw error}
      if(!user?.id||user.role!=='admin')fail(403,'ADMIN_REQUIRED');
    }
    if(input.action==='prepare'){
      if(!user||Object.keys(input).some(k=>!['action','runId'].includes(k)))fail(400,'INVALID_INPUT');
      stage='prepare';
      const existing=await entities.SyncValidationRun.filter({runId:input.runId},undefined,2);
      if(existing.length)fail(409,'RUN_EXISTS');
      const token=crypto.randomUUID()+crypto.randomUUID();
      const businessId=crypto.randomUUID();
      await entities.SyncValidationRun.create({disposable:true,ownerUserId:user.id,runId:input.runId,businessId,capabilityHash:await digest(token),expiresAt:new Date(Date.now()+2*60*60*1000).toISOString()});
      return Response.json({runId:input.runId,businessId,capability:token},{headers});
    }
    stage='authorize-run';
    const runQuery={disposable:true,runId:input.runId,...(capability?{capabilityHash:await digest(capability)}:{ownerUserId:user.id})};
    const runs=await entities.SyncValidationRun.filter(runQuery,undefined,2);
    if(runs.length!==1)fail(401,'RUN_ACCESS_DENIED');
    const run=runs[0];
    if(Date.parse(run.expiresAt)<=Date.now())fail(401,'RUN_EXPIRED');
    const scope={disposable:true,ownerUserId:run.ownerUserId,runId:run.runId,businessId:run.businessId};
    const table=entities.AtomicCreationProbe;
    if(input.action==='cleanup'){
      if(!user||Object.keys(input).some(k=>!['action','runId'].includes(k)))fail(403,'ADMIN_REQUIRED');
      stage='cleanup';const removed=await table.deleteMany(scope);
      const remaining=await table.filter(scope,undefined,1);
      if(remaining.length)fail(503,'CLEANUP_FAILED');
      await entities.SyncValidationRun.delete(run.id);
      return Response.json({deleted:removed.deleted,remaining:0},{headers});
    }
    if(input.action==='inspect'){
      if(!user)fail(403,'ADMIN_REQUIRED');
      const rows=await table.filter(scope,undefined,1000);
      return Response.json({count:rows.length,records:rows.map(r=>({recordUUID:r.recordUUID,revision:r.revision,receiptCount:JSON.parse(r.receiptsJSON??'[]').length}))},{headers});
    }
    if(input.action==='pull'){
      if(Object.keys(input).some(k=>!['action','runId'].includes(k)))fail(400,'INVALID_INPUT');
      const rows=await table.filter(scope,undefined,1000);
      if(rows.length===1000||new Set(rows.map(r=>r.recordUUID)).size!==rows.length)fail(503,'DUPLICATE_IDENTITY');
      return Response.json({records:rows.filter(r=>r.revision>0).map(present)},{headers});
    }
    const mutation=input.mutation;
    if(!mutation||typeof mutation!=='object'||Array.isArray(mutation)||mutation.businessId!==run.businessId||!uuid.test(mutation.recordUUID??''))fail(400,'INVALID_MUTATION');
    const identity={...scope,recordUUID:mutation.recordUUID};
    const find=async()=>{
      const rows=await table.filter(identity,undefined,2);
      if(rows.length!==1)fail(503,'DUPLICATE_OR_MISSING_IDENTITY');
      return rows[0];
    };
    if(!['reserve','push'].includes(input.action)||Object.keys(input).some(k=>!['action','runId','mutation'].includes(k)))fail(400,'INVALID_INPUT');
    if(input.action==='push'){
      const fields=['schemaVersion','businessId','recordUUID','recordType','operationId','baseRevision','action','payloadJSON'];
      if(Object.keys(mutation).some(k=>!fields.includes(k))||mutation.schemaVersion!==1||mutation.recordType!=='service'||mutation.action!=='put'||!uuid.test(mutation.operationId??'')||!Number.isSafeInteger(mutation.baseRevision)||mutation.baseRevision<0||mutation.baseRevision>=Number.MAX_SAFE_INTEGER||typeof mutation.payloadJSON!=='string')fail(400,'INVALID_MUTATION');
      let payload;try{payload=JSON.parse(mutation.payloadJSON)}catch{fail(400,'INVALID_PAYLOAD')}
      if(!payload||typeof payload.name!=='string'||!payload.name.startsWith('Disposable ')||payload.name.length>80||Object.keys(payload).some(k=>!['name','durationMinutes','priceMinor','depositMinor','prepInstructions'].includes(k))||![payload.durationMinutes,payload.priceMinor,payload.depositMinor].every(Number.isSafeInteger)||payload.durationMinutes<1||payload.priceMinor<0||payload.depositMinor<0||payload.depositMinor>payload.priceMinor||typeof payload.prepInstructions!=='string')fail(400,'DISPOSABLE_SERVICE_REQUIRED');
    }
    // Identity-only upsert never writes revision, payload, or operation receipts.
    // All creation paths use this keyed endpoint; direct client CRUD is denied.
    stage='reserve';
    const reserved=await table.upsert([identity],{key:['businessId','recordUUID']});
    if(reserved.records?.length!==1)fail(503,'RESERVATION_FAILED');
    let row=await find();
    if(input.action==='reserve')return Response.json({id:row.id,created:reserved.created,updated:reserved.updated,revision:row.revision??0},{headers});
    const fingerprint=await digest(JSON.stringify(canonical(mutation)));
    const receipts=JSON.parse(row.receiptsJSON??'[]');
    const replay=current=>{
      const receipt=JSON.parse(current.receiptsJSON??'[]').find(r=>r.operationId===mutation.operationId);
      if(!receipt)return null;
      if(receipt.fingerprint!==fingerprint)fail(409,'OPERATION_ID_REUSED');
      return Response.json({status:'replayed',operationId:mutation.operationId,record:receipt.record},{headers});
    };
    const prior=replay(row);if(prior)return prior;
    const revision=row.revision??0;
    if(revision!==mutation.baseRevision)return Response.json({code:'REVISION_CONFLICT',record:present(row)},{status:409,headers});
    if(receipts.length>=64)fail(503,'PROBE_RECEIPT_LIMIT');
    const record={businessId:run.businessId,recordUUID:mutation.recordUUID,recordType:'service',revision:revision+1,payloadJSON:mutation.payloadJSON};
    const receipt={operationId:mutation.operationId,fingerprint,record};
    stage='commit';
    const result=await table.updateMany({...identity,id:row.id,revision},{$set:{recordType:'service',payloadJSON:mutation.payloadJSON,receiptsJSON:JSON.stringify([...receipts,receipt])},$inc:{revision:1}});
    if(result.success!==true||![0,1].includes(result.updated)||result.has_more!==false)fail(503,'INVALID_COMMIT_RESULT');
    if(result.updated===1)return Response.json({status:'applied',operationId:mutation.operationId,record},{headers});
    // Another writer committed. A matching receipt turns an ambiguous retry into
    // its original acknowledgment; a different mutation remains a conflict.
    row=await find();const acknowledged=replay(row);if(acknowledged)return acknowledged;
    return Response.json({code:'REVISION_CONFLICT',record:present(row)},{status:409,headers});
  } catch(error){
    if(error?.local)return Response.json({code:error.code},{status:error.status,headers});
    const raw=error?.status??error?.response?.status;
    const upstreamStatus=Number.isInteger(raw)&&raw>=400&&raw<=599?raw:null;
    return Response.json({code:'PROBE_UPSTREAM_FAILED',stage,upstreamStatus},{status:upstreamStatus===429?429:503,headers});
  }
}
