import { databaseTokenOptions } from "@/lib/auth/database-token";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
export async function GET(){const {userId,getToken}=await auth();if(!userId)return NextResponse.json({error:"Sign in required"},{status:401});return NextResponse.json({token:await getToken(databaseTokenOptions())},{headers:{"Cache-Control":"no-store"}});}
