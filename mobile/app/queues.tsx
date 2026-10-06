import { useAuth, useClerk } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, Text, View } from "react-native";
import { createMobileSupabaseClient } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import type { QueueRow, QueueSummary } from "@/lib/types";

export default function Queues() {
  const { getToken }=useAuth(); const { signOut }=useClerk(); const router=useRouter();
  const [queues,setQueues]=useState<QueueSummary[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const db=createMobileSupabaseClient(()=>getToken({template:"supabase"}));const {data,error}=await db.from("queues").select("id,name,description,status,average_service_seconds,locations!queues_location_id_business_id_fkey(name)").order("created_at");if(error)throw error;const rows = (data ?? []) as QueueRow[];
    setQueues(rows.map(row => ({ ...row, locations: row.locations?.[0] ?? null })));}catch{setError("We couldn’t load your queues. Pull down to try again.");}finally{setLoading(false)}},[getToken]);
  useFocusEffect(useCallback(()=>{void load()},[load]));
  return <SafeAreaView style={{flex:1,backgroundColor:theme.surface}}><View style={{padding:20,flex:1}}>
    <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><View><Text style={{fontSize:30,fontWeight:"800",color:theme.ink}}>Your queues</Text><Text style={{color:theme.muted}}>Run today’s service.</Text></View><Pressable onPress={()=>void signOut()}><Text style={{color:theme.green,fontWeight:"700"}}>Sign out</Text></Pressable></View>
    {!!error&&<Text accessibilityRole="alert" style={{color:theme.danger,marginBottom:12}}>{error}</Text>}
    {loading&&!queues.length?<ActivityIndicator/>:<FlatList data={queues} keyExtractor={q=>q.id} refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>} ListEmptyComponent={<Text style={{color:theme.muted}}>No queues are assigned to this account.</Text>} renderItem={({item})=><Pressable onPress={()=>router.push({pathname:"/queue/[id]",params:{id:item.id}})} style={{backgroundColor:theme.white,padding:18,borderRadius:18,marginBottom:12,borderWidth:1,borderColor:theme.border}}><View style={{flexDirection:"row",justifyContent:"space-between"}}><Text style={{fontSize:18,fontWeight:"800",color:theme.ink}}>{item.name}</Text><Text style={{fontWeight:"700",color:item.status==="open"?theme.green:theme.muted}}>{item.status.toUpperCase()}</Text></View><Text style={{marginTop:8,color:theme.muted}}>{item.locations?.name??"Location"} · {Math.round(item.average_service_seconds/60)} min / customer</Text></Pressable>}/>}
  </View></SafeAreaView>;
}