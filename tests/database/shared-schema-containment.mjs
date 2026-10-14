// Disposable metadata/privilege regression. Never connects to a hosted database.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
const container = `queuezero-containment-${randomUUID()}`;
const docker = (...args) => execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']});
const sql = source => execFileSync('docker',['exec','-i',container,'psql','-XAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:source,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const names=['Memory','Conversation','Permission','Agent','Wallet','Reputation','Message','SharedContext','ApiKey'];
try {
 docker('run','--rm','-d','--name',container,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','queuezero-db-tests:local');
 let ready=false;
 for(let i=0;i<60;i++){try{docker('exec',container,'pg_isready','-h','127.0.0.1','-U','postgres');ready=true;break}catch{await setTimeout(500)}}
 if(!ready)throw new Error('Disposable database did not start');
 sql('create role anon; create role authenticated; create role service_role bypassrls;');
 for(const name of names)sql(`create table public."${name}"(id integer primary key); insert into public."${name}" values(1); grant all on public."${name}" to public,anon,authenticated,service_role;`);
 sql('create table public.queuezero_sentinel(id integer); grant select on public.queuezero_sentinel to authenticated;');
 const script=readFileSync(new URL('../../ops/shared-database-containment.sql',import.meta.url),'utf8');
 sql(script);
 for(const name of names){
  for(const role of ['anon','authenticated']) {
   for(const statement of [`select * from public."${name}"`,`insert into public."${name}" values(2)`,`update public."${name}" set id=3`,`delete from public."${name}"`,`truncate public."${name}"`]){
    try{sql(`set role ${role}; ${statement}`)}catch(error){if(String(error.stderr).includes('permission denied'))continue;throw error}
    throw new Error(`Client access remained: ${role}, ${name}`);
   }
  }
  if(sql(`set role service_role; select count(*) from public."${name}"`).trim().split('\n').at(-1)!=='1')throw new Error('Backend lost read access');
  sql(`set role service_role; insert into public."${name}" values(2); update public."${name}" set id=3 where id=2; delete from public."${name}" where id=3;`);
 }
 if(sql("select has_table_privilege('authenticated','public.queuezero_sentinel','SELECT')").trim()!=='t')throw new Error('Unrelated grant changed');
 sql(script); // Safe to rerun while still deny-by-default.
 sql('alter table public."Memory" disable row level security; grant select on public."Memory" to anon; create policy reviewed_policy on public."Agent" for select using(false);');
 let rejected=false;try{sql(script)}catch{rejected=true}
 if(!rejected)throw new Error('Existing policies were not protected');
 if(sql("select has_table_privilege('anon','public.\"Memory\"','SELECT') and not relrowsecurity from pg_class where oid='public.\"Memory\"'::regclass").trim()!=='t')throw new Error('Failure did not roll back earlier changes');
 console.log('PASS: 90 anonymous/authenticated read/write/truncate denials; backend CRUD preserved on nine tables; unrelated grant preserved; rerun and policy-conflict rollback verified.');
} finally { try{docker('rm','-f',container)}catch{/* Nothing remains if startup failed. */} }
