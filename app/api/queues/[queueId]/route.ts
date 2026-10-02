import { NextResponse } from "next/server";
import { getQueueConsole } from "@/lib/queue/console";
export async function GET(_request:Request,{params}:{params:Promise<{queueId:string}>}){
 try{return NextResponse.json(await getQueueConsole((await params).queueId),{headers:{"Cache-Control":"no-store"}});}
 catch{return NextResponse.json({error:"Queue unavailable. Sign in and try again."},{status:403,headers:{"Cache-Control":"no-store"}});}
}
