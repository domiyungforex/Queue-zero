import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, Text, View } from "react-native";
import { createMobileSupabaseClient } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import type { QueueConsole } from "@/lib/types";

type Operation="call_next"|"complete"|"recall"|"no_show";
export default function QueueScreen(){
  const {id}=useLocalSearchParams<{id:string}>();const {getToken}=useAuth();
  const db=useMemo(()=>createMobileSupabaseClient(()=>getToken({template:"supabase"})),[getToken]);
  const [queue,setQueue]=useState<QueueConsole|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const load=useCallback(async()=>{if(!id)return;const {data,error}=await db.rpc("get_queue_console",{p_queue_id:id});if(error){setError("We couldn’t refresh this queue.");return}setQueue(data as QueueConsole);setError("")},[db,id]);
  useEffect(()=>{void load();if(!id)return;const channel=db.channel(`mobile-queue-${id}`).on("postgres_changes",{event:"*",schema:"public",table:"tickets",filter:`queue_id=eq.${id}`},()=>void load()).subscribe();return()=>{void db.removeChannel(channel)}},[db,id,load]);
  async function operate(operation:Operation,ticketId?:string){
    if(!id||busy)return;setBusy(true);setError("");const requestId=globalThis.crypto.randomUUID();
    try{const result=operation==="call_next"?await db.rpc("call_next_ticket",{p_queue_id:id,p_request_id:requestId}):await db.rpc("operate_ticket",{p_queue_id:id,p_ticket_id:ticketId!,p_request_id:requestId,p_operation:operation});if(result.error)throw result.error;await load()}catch{setError("We couldn’t confirm that action. Refresh before trying again.");}finally{setBusy(false)}
  }
  if(!queue)return <SafeAreaView style={{flex:1,alignItems:"center",justifyContent:"center"}}><ActivityIndicator/></SafeAreaView>;
  return <SafeAreaView style={{flex:1,backgroundColor:theme.surface}}><View style={{padding:20,flex:1,gap:16}}>
    <View><Text style={{fontSize:28,fontWeight:"800",color:theme.ink}}>{queue.name}</Text><Text style={{color:theme.muted}}>{queue.waiting.length} waiting · {queue.served_today} served today</Text></View>
    {!!error&&<Text accessibilityRole="alert" style={{color:theme.danger}}>{error}</Text>}
    <View style={{backgroundColor:theme.green,borderRadius:22,padding:20}}><Text style={{color:"#CFE2D5",fontWeight:"700"}}>NOW SERVING</Text>{queue.serving?<><Text style={{fontSize:36,fontWeight:"900",color:"white",marginVertical:6}}>{queue.serving.display_number}</Text><Text style={{color:"white",fontSize:17}}>{queue.serving.customer_name}</Text><View style={{flexDirection:"row",gap:8,marginTop:18}}>{(["complete","recall","no_show"] as Operation[]).map(op=><Pressable key={op} disabled={busy} onPress={()=>void operate(op,queue.serving!.id)} style={{backgroundColor:"white",paddingHorizontal:12,paddingVertical:11,borderRadius:12}}><Text style={{fontWeight:"800",color:theme.green}}>{op.replace("_"," ").toUpperCase()}</Text></Pressable>)}</View></>:<Text style={{fontSize:20,color:"white",marginTop:8}}>Ready for the next customer.</Text>}</View>
    <Pressable disabled={busy||!!queue.serving||!queue.waiting.length} onPress={()=>void operate("call_next")} style={{minHeight:64,borderRadius:18,backgroundColor:busy||queue.serving||!queue.waiting.length?theme.border:theme.lime,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:20,fontWeight:"900",color:theme.ink}}>{busy?"WORKING…":"CALL NEXT"}</Text></Pressable>
    <Text style={{fontSize:18,fontWeight:"800",color:theme.ink}}>Waiting</Text>
    <FlatList data={queue.waiting} keyExtractor={t=>t.id} onRefresh={load} refreshing={false} ListEmptyComponent={<Text style={{color:theme.muted}}>Nobody is waiting.</Text>} renderItem={({item,index})=><View style={{backgroundColor:theme.white,borderRadius:14,padding:15,marginBottom:8,borderWidth:1,borderColor:theme.border,flexDirection:"row",justifyContent:"space-between"}}><View><Text style={{fontWeight:"900",color:theme.ink}}>{item.display_number} · {item.customer_name}</Text><Text style={{color:theme.muted}}>#{index+1} in line</Text></View><Pressable disabled={busy} onPress={()=>void operate("no_show",item.id)}><Text style={{color:theme.danger,fontWeight:"700"}}>No-show</Text></Pressable></View>}/>
  </View></SafeAreaView>;
}