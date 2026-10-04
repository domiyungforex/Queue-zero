import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
export async function testAttendanceConcurrency(container) {
 function query(source,onOutput){return new Promise((resolve,reject)=>{const p=spawn("docker",["exec","-i",container,"psql","-XAt","-U","postgres","-v","ON_ERROR_STOP=1"]);let output="",errors="";const timer=setTimeout(()=>{p.kill();reject(new Error("Attendance concurrency timeout"));},15000);p.stdout.on("data",d=>{output+=d;onOutput?.(output)});p.stderr.on("data",d=>{errors+=d});p.on("error",reject);p.on("close",code=>{clearTimeout(timer);resolve({code,output,errors})});p.stdin.end(source);});}
 const actor=id=>`select set_config('request.jwt.claims','{"role":"authenticated","sub":"${id}"}',true);`;
 const owner="user_raceschoolowner",teacher="user_raceschoolteacher";
 const checked=async source=>{const r=await query(source);assert.equal(r.code,0,r.errors);return r.output;};
 const value=async expr=>{const out=await checked(`begin;${actor(owner)} select 'DATA:'||(${expr})::text;commit;`);return out.match(/DATA:([^\n]+)/)[1];};
 const org=await value("onboard_organization('Accountless concurrency school','education','NG','UTC','Campus','Address','SCHOOL')");
 const manage=async(action,fields)=>JSON.parse(await value(`school_manage('${action}','${JSON.stringify({organization_id:org,...fields})}'::jsonb)`));
 const faculty=(await manage("faculty",{name:"Science"})).id;
 const department=(await manage("department",{faculty_id:faculty,name:"Physics"})).id;
 const course=(await manage("course",{department_id:department,code:"RACE101",title:"Concurrency"})).id;
 await manage("lecturer",{course_id:course,user_id:teacher,display_name:"Assigned lecturer"});
 await value(`school_import_roster('${org}','${course}','${JSON.stringify([1,2,3].map(n=>({full_name:`Student ${n}`,matric_number:`RACE${n}`})))}'::jsonb)`);
 const start=new Date(Date.now()-60_000).toISOString(),close=new Date(Date.now()+30*60_000).toISOString(),end=new Date(Date.now()+60*60_000).toISOString();
 const cls=JSON.parse(await value(`school_create_accountless_class('${org}','${course}','${start}','${end}',10,'${close}')`)).id;
 await manage("open",{class_id:cls});
 const requestedNonce=randomUUID();const issued=JSON.parse(await value(`school_issue_qr('${cls}','${requestedNonce}',clock_timestamp()+interval '30 seconds')`));const nonce=issued.nonce;
 const scan=(student,request=randomUUID(),device="c")=>`select 'RESULT:'||school_attend_accountless('${org}','${cls}','${nonce}','Student ${student}','RACE${student}',repeat('${device}',64),repeat('d',64),'${request}')::text;`;
 async function overlap(first,second,marker="LOCKED"){let ready;const started=new Promise(resolve=>{ready=resolve});const one=query(first,out=>{if(out.includes(marker))ready()});await Promise.race([started,one.then(r=>{throw new Error("Lock was not reached: "+r.errors)})]);return Promise.all([one,query(second)]);}

 const sameRequest=randomUUID();
 const retried=await overlap(`begin;set local role service_role;${scan(1,sameRequest)} select 'LOCKED';select pg_sleep(1);commit;`,`begin;set local role service_role;${scan(1,sameRequest)}commit;`);
 for(const result of retried){assert.equal(result.code,0,result.errors);assert.equal(JSON.parse(result.output.match(/RESULT:([^\n]+)/)[1]).status,"PRESENT");}
 assert.equal((await checked(`select count(*) from attendance_records where class_session_id='${cls}';`)).trim(),"1");
 assert.equal((await checked(`select count(*) from presence_events where session_id='${cls}' and event_type='CHECKED_IN';`)).trim(),"1");

 const simultaneous=await overlap(`begin;set local role service_role;${scan(2,randomUUID(),"e")} select 'LOCKED';select pg_sleep(1);commit;`,`begin;set local role service_role;${scan(3,randomUUID(),"e")}commit;`);
 for(const result of simultaneous){assert.equal(result.code,0,result.errors);assert.equal(JSON.parse(result.output.match(/RESULT:([^\n]+)/)[1]).status,"PRESENT");}
 assert.equal((await checked(`select count(*) from attendance_records where class_session_id='${cls}';`)).trim(),"3");
 assert.equal((await checked(`select count(*) from attendance_flags where class_session_id='${cls}' and reason='POSSIBLE_PROXY_ATTENDANCE';`)).trim(),"2");

 const newRequest=randomUUID();
 const duplicate=JSON.parse((await checked(`begin;set local role service_role;${scan(1,newRequest)}commit;`)).match(/RESULT:([^\n]+)/)[1]);
 assert.equal(duplicate.status,"DUPLICATE");
 assert.equal((await checked(`select count(*) from attendance_records where class_session_id='${cls}' and student_id in(select student_id from class_roster where class_session_id='${cls}');`)).trim(),"3");
 console.log("Concurrent accountless attendance: exact retries commit once; simultaneous roster students remain unique; shared-device submissions record review flags without blocking.");
}
