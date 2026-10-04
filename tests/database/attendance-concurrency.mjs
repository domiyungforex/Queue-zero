import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
export async function testAttendanceConcurrency(container) {
 function query(source,onOutput){return new Promise((resolve,reject)=>{
  const p=spawn('docker',['exec','-i',container,'psql','-XAt','-U','postgres','-v','ON_ERROR_STOP=1']);let output='',errors='';
  const timer=setTimeout(()=>{p.kill();reject(new Error('Attendance concurrency timeout'));},15000);
  p.stdout.on('data',d=>{output+=d;onOutput?.(output)});p.stderr.on('data',d=>{errors+=d});p.on('error',reject);p.on('close',code=>{clearTimeout(timer);resolve({code,output,errors})});p.stdin.end(source);
 });}
 const actor=id=>`select set_config('request.jwt.claims','{"role":"authenticated","sub":"${id}"}',true);`;
 const owner='user_raceschoolowner', teacher='user_raceschoolteacher';
 const checked=async source=>{const r=await query(source);assert.equal(r.code,0,r.errors);return r.output;};
 const value=async expr=>{const out=await checked(`begin;${actor(owner)} select 'DATA:'||(${expr})::text;commit;`);return out.match(/DATA:([^\n]+)/)[1];};
 const org=await value("onboard_organization('Concurrency school','education','NG','UTC','Campus','Address','SCHOOL')");
 const manage=async(action,fields)=>JSON.parse(await value(`school_manage('${action}','${JSON.stringify({organization_id:org,...fields})}'::jsonb)`));
 const faculty=(await manage('faculty',{name:'Science'})).id;
 const department=(await manage('department',{faculty_id:faculty,name:'Physics'})).id;
 const course=(await manage('course',{department_id:department,code:'RACE101',title:'Concurrency'})).id;
 await manage('lecturer',{course_id:course,user_id:teacher,display_name:'Assigned lecturer'});
 await manage('enroll',{course_id:course,students:[1,2].map(n=>({full_name:`Student ${n}`,email:`race${n}@school.test`,matric_number:`RACE${n}`,department_id:department,level:'100'}))});
 for(const n of [1,2])await checked(`set role service_role;select school_claim_student('${org}','user_racestudent${n}','race${n}@school.test');`);
 const cls=(await manage('class',{course_id:course,starts_at:new Date(Date.now()-60000).toISOString(),late_after_minutes:10,departure_required:true})).id;
 await manage('open',{class_id:cls});
 const nonce=randomUUID();await value(`school_issue_qr('${cls}','${nonce}',clock_timestamp()+interval '45 seconds')`);
 const request=randomUUID();
 const scan=(student,req=request)=>`select 'RESULT:'||school_scan('${org}','${cls}','${nonce}','user_racestudent${student}',repeat('c',64),'${req}')::text;`;
 async function overlap(first,second,marker='LOCKED'){
  let ready;const started=new Promise(resolve=>{ready=resolve});const one=query(first,out=>{if(out.includes(marker))ready()});
  await Promise.race([started,one.then(r=>{throw new Error('Lock was not reached: '+r.errors)})]);return Promise.all([one,query(second)]);
 }
 const repeated=await overlap(`begin;set local role service_role;${scan(1)} select 'LOCKED';select pg_sleep(1);commit;`,`begin;set local role service_role;${scan(1)}commit;`);
 for(const r of repeated){assert.equal(r.code,0,r.errors);assert.equal(JSON.parse(r.output.match(/RESULT:([^\n]+)/)[1]).action,'CHECK_IN')}
 assert.equal((await checked(`select count(*) from presence_events where session_id='${cls}' and event_type='CHECKED_IN';`)).trim(),'1');
 const timestamps=await overlap(`begin;select 1 from class_sessions where id='${cls}' for update;select 'LOCKED';select pg_sleep(1);select 'RELEASE:'||clock_timestamp();commit;`,`begin;set local role service_role;${scan(2,randomUUID())}commit;`);
 for(const r of timestamps)assert.equal(r.code,0,r.errors);
 const released=new Date(timestamps[0].output.match(/RELEASE:([^\n]+)/)[1]);
 const stamp=new Date((await checked(`select check_in_at from attendance_records a join people p on p.id=a.student_id where class_session_id='${cls}' and p.clerk_user_id='user_racestudent2';`)).trim());
 assert.ok(stamp>=released,'authoritative timestamp must be sampled after lock wait');
 await manage('finish',{class_id:cls});
 const draft=(await manage('class',{course_id:course,starts_at:new Date().toISOString(),late_after_minutes:10})).id;
 const open=`select school_manage('open','${JSON.stringify({organization_id:org,class_id:draft})}'::jsonb);`;
 const mode=await overlap(`begin;${actor(owner)}select set_organization_mode('${org}','BUSINESS');select 'LOCKED';select pg_sleep(1);commit;`,`begin;${actor(teacher)}${open}commit;`);
 assert.equal(mode[0].code,0,mode[0].errors);assert.notEqual(mode[1].code,0);assert.match(mode[1].errors,/School unavailable/);
 await checked(`begin;${actor(owner)}select set_organization_mode('${org}','SCHOOL');commit;`);
 const revoked=await overlap(`begin;select 1 from courses where id='${course}' for update;delete from course_lecturers where course_id='${course}' and clerk_user_id='${teacher}';select 'LOCKED';select pg_sleep(1);commit;`,`begin;${actor(teacher)}${open}commit;`);
 assert.equal(revoked[0].code,0,revoked[0].errors);assert.notEqual(revoked[1].code,0);assert.match(revoked[1].errors,/Course unavailable/);
 console.log('Concurrent attendance: exact retry commits once; server timestamp follows lock wait; organization-mode change and lecturer revocation block pending class opening.');
}
