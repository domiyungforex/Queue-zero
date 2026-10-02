import { NextResponse } from "next/server";
import { requireBusinessOwner } from "@/lib/business/membership";
import { verifyCheckout } from "@/lib/paystack/server";
export async function GET(request:Request){const m=await requireBusinessOwner();const reference=new URL(request.url).searchParams.get('reference');let status='pending';try{if(reference&&await verifyCheckout(reference,m.businessId))status='verified'}catch{status='unconfirmed'}return NextResponse.redirect(new URL('/dashboard/billing?payment='+status,process.env.NEXT_PUBLIC_APP_URL))}
