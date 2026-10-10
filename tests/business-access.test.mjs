import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleConnection} from '../base44/functions/test-connection/handler.js';
import {handleBusinessAccess, authorizeBusiness} from '../base44/functions/business-access/handler.js';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const req=(body)=>new Request('https://example.test',{method:'POST',body:JSON.stringify(body)});
function fixture(userId='alice') {
 const records={Business:[{id:'a',businessId:A,ownerUserId:'alice',name:'A',status:'active'},{id:'b',businessId:B,ownerUserId:'bob',name:'B',status:'active'}],BusinessMembership:[{businessId:A,userId:'alice',role:'owner',status:'active'},{businessId:B,userId:'bob',role:'owner',status:'active'}]};
 const writes=[]; const entities=Object.fromEntries(Object.entries(records).map(([name,rows])=>[name,{
  async filter(q,_sort,limit){return rows.filter(r=>Object.entries(q).every(([k,v])=>r[k]===v)).slice(0,limit)},
  async create(v){writes.push({name,v});const r={id:crypto.randomUUID(),...v};rows.push(r);return r},
  async update(id,v){writes.push({name,v});const r=rows.find(r=>r.id===id);Object.assign(r,v);return r}
 }]));
 return {records,writes,entities,client:{auth:{me:async()=>({id:userId,email:userId+'@example.test',role:'admin'})},asServiceRole:{entities}}};
}
test('connection check authenticates once and cannot access storage or service role',async()=>{
 let calls=0;const client={auth:{me:async()=>{calls++;return{id:'alice',email:'a@example.test'}}},get entities(){throw Error('write/read forbidden')},get asServiceRole(){throw Error('service role forbidden')}};
 const r=await handleConnection(req({payload:'ignored'}),client);assert.equal(r.status,200);assert.equal(calls,1);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{connected:true,user:{id:'alice',email:'a@example.test'}});
});
test('expired token fails without mutation and upstream faults do not masquerade as successful auth',async()=>{
 for(const [status,expected] of [[401,401],[403,401],[500,503]]){const r=await handleConnection(req({}),{auth:{me:async()=>{throw{status}}}});assert.equal(r.status,expected)}
});
test('two business owners cannot cross-read even with platform admin role or forged userId',async()=>{
 const f=fixture();let r=await handleBusinessAccess(req({action:'list',userId:'bob'}),f.client);assert.deepEqual((await r.json()).businesses.map(b=>b.businessId),[A]);
 r=await handleBusinessAccess(req({action:'verify',businessId:B,userId:'bob',role:'owner'}),f.client);assert.equal(r.status,403);assert.equal(f.writes.length,0);
 assert.equal((await handleBusinessAccess(req({action:'verify',businessId:A}),fixture('bob').client)).status,403);
});
test('revoked, duplicate, mismatched owner, disabled business memberships fail closed',async()=>{
 for(const alter of [f=>f.records.BusinessMembership[0].status='revoked',f=>f.records.BusinessMembership.push({...f.records.BusinessMembership[0]}),f=>f.records.Business[0].ownerUserId='bob',f=>f.records.Business[0].status='disabled']){const f=fixture();alter(f);await assert.rejects(authorizeBusiness(f.entities,'alice',A),e=>e.status===403)}
});
test('business creation derives owner from authentication and rejects forged fields',async()=>{
 const f=fixture('new-owner');let r=await handleBusinessAccess(req({action:'create',name:'Demo',ownerUserId:'alice'}),f.client);assert.equal(r.status,400);assert.equal(f.writes.length,0);
 const C='33333333-3333-4333-8333-333333333333';r=await handleBusinessAccess(req({action:'create',name:' Demo '}),f.client,()=>C);assert.equal(r.status,201);const v=(await r.json()).business;assert.equal(v.ownerUserId,'new-owner');assert.equal(v.businessId,C);assert.equal(f.records.BusinessMembership.at(-1).userId,'new-owner');
});
test('failed onboarding leaves a pending business inaccessible',async()=>{
 const f=fixture('new-owner');f.entities.BusinessMembership.create=async()=>{throw Error('sensitive diagnostic')};const C='33333333-3333-4333-8333-333333333333';const r=await handleBusinessAccess(req({action:'create',name:'Demo'}),f.client,()=>C);assert.equal(r.status,500);assert.equal(f.records.Business.at(-1).status,'pending');assert.ok(!(await r.text()).includes('sensitive'));await assert.rejects(authorizeBusiness(f.entities,'new-owner',C));
});
test('all tenant entities deny direct CRUD; snapshots require businessId',()=>{
 for(const name of ['business','business-membership','business-snapshot']){const s=JSON.parse(readFileSync(new URL('../base44/entities/'+name+'.jsonc',import.meta.url)));assert.deepEqual(s.rls,{create:false,read:false,update:false,delete:false});assert.ok(s.required.includes('businessId'))}
});
test('malformed input and no identity never reach business entities',async()=>{
 const f=fixture();assert.equal((await handleBusinessAccess(req(null),f.client)).status,400);f.client.auth.me=async()=>null;assert.equal((await handleBusinessAccess(req({action:'create',name:'X'}),f.client)).status,401);assert.equal(f.writes.length,0);
});
