import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, webcrypto} from 'node:crypto';
import {handleCreationProbe} from '../base44/functions/creation-sync-probe/handler.js';
globalThis.crypto ??= webcrypto;

function fixture(){
 const tables={SyncValidationRun:[],AtomicCreationProbe:[]};
 const matches=(row,query)=>Object.entries(query).every(([k,v])=>row[k]===v);
 const entities=Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,{
  filter:async(q,s,l)=>rows.filter(r=>matches(r,q)).slice(0,l).map(r=>structuredClone(r)),
  create:async d=>{const r={id:randomUUID(),...d};rows.push(r);return r},
  upsert:async([d],{key})=>{let row=rows.find(r=>key.every(k=>r[k]===d[k]));const created=row?0:1;if(!row){row={id:randomUUID(),revision:0,receiptsJSON:'[]'};rows.push(row)}Object.assign(row,d);return {created,updated:1-created,records:[structuredClone(row)]}},
  updateMany:async(q,u)=>{const selected=rows.filter(r=>matches(r,q));selected.forEach(r=>{Object.assign(r,u.$set);for(const [k,n] of Object.entries(u.$inc))r[k]+=n});return {success:true,updated:selected.length,has_more:false}},
  deleteMany:async q=>{const count=rows.length;for(let i=rows.length-1;i>=0;i--)if(matches(rows[i],q))rows.splice(i,1);return {deleted:count-rows.length}},
  delete:async id=>{rows.splice(rows.findIndex(r=>r.id===id),1)}
 }]));
 const client={auth:{me:async()=>({id:'admin-fixture',role:'admin'})},asServiceRole:{entities}};
 const runId=randomUUID();
 const call=async(body,capability)=>{const r=await handleCreationProbe(new Request('https://fixture.invalid',{method:'POST',headers:capability?{'X-GroomerGo-Probe-Capability':capability}:{},body:JSON.stringify({runId,...body})}),client);return {status:r.status,data:await r.json()}};
 return {tables,client,call};
}
test('matching retry returns original receipt after later revisions; changed operation is rejected',async()=>{
 const f=fixture(),seed=await f.call({action:'prepare'});
 const mutation={schemaVersion:1,businessId:seed.data.businessId,recordUUID:randomUUID(),recordType:'service',operationId:randomUUID(),baseRevision:0,action:'put',payloadJSON:JSON.stringify({name:'Disposable test',durationMinutes:60,priceMinor:1000,depositMinor:0,prepInstructions:''})};
 const applied=await f.call({action:'push',mutation},seed.data.capability);assert.equal(applied.data.status,'applied');
 const updated=await f.call({action:'push',mutation:{...mutation,operationId:randomUUID(),baseRevision:1}},seed.data.capability);assert.equal(updated.data.record.revision,2);
 const replay=await f.call({action:'push',mutation},seed.data.capability);assert.equal(replay.data.status,'replayed');assert.deepEqual(replay.data.record,applied.data.record);
 const wrong=await f.call({action:'push',mutation:{...mutation,payloadJSON:mutation.payloadJSON.replace('test','changed')}},seed.data.capability);assert.equal(wrong.status,409);assert.equal(wrong.data.code,'OPERATION_ID_REUSED');
 assert.equal(f.tables.AtomicCreationProbe.length,1);assert.equal(f.tables.AtomicCreationProbe[0].revision,2);
});
test('capability cannot read a different run or accept a different business',async()=>{
 const f=fixture(),seed=await f.call({action:'prepare'});
 assert.equal((await f.call({action:'pull'},'wrong')).status,401);
 assert.equal((await f.call({action:'reserve',mutation:{businessId:randomUUID(),recordUUID:randomUUID()}},seed.data.capability)).status,400);
 assert.equal((await f.call({action:'cleanup'},seed.data.capability)).status,403);
 assert.equal(f.tables.AtomicCreationProbe.length,0);
});
test('duplicate server identities fail closed instead of choosing a row',async()=>{
 const f=fixture(),seed=await f.call({action:'prepare'}),id=randomUUID();
 await f.call({action:'reserve',mutation:{businessId:seed.data.businessId,recordUUID:id}});
 f.tables.AtomicCreationProbe.push({...f.tables.AtomicCreationProbe[0],id:randomUUID()});
 const response=await f.call({action:'reserve',mutation:{businessId:seed.data.businessId,recordUUID:id}});
 assert.equal(response.status,503);assert.equal(response.data.code,'DUPLICATE_OR_MISSING_IDENTITY');
});
