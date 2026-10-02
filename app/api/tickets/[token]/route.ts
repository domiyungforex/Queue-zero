import { NextResponse } from "next/server";
import { getPublicTicket } from "@/lib/queue/ticket";
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){
 try{const ticket=await getPublicTicket((await params).token);return NextResponse.json(ticket??{error:"Ticket unavailable"},{status:ticket?200:404,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});}
 catch{return NextResponse.json({error:"Ticket temporarily unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
