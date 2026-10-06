import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { theme } from "@/lib/theme";

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email,setEmail]=useState(""),[code,setCode]=useState(""),[stage,setStage]=useState<"email"|"code">("email");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function sendCode(){
    if(!isLoaded||!email.trim())return; setBusy(true);setError("");
    try{const attempt=await signIn.create({identifier:email.trim()});const factor=attempt.supportedFirstFactors?.find(v=>v.strategy==="email_code");if(!factor||!("emailAddressId" in factor))throw new Error();await attempt.prepareFirstFactor({strategy:"email_code",emailAddressId:factor.emailAddressId});setStage("code");}
    catch{setError("We couldn’t send the code. Check your email and try again.");}finally{setBusy(false)}
  }
  async function verify(){
    if(!isLoaded||code.length<6)return;setBusy(true);setError("");
    try{const attempt=await signIn.attemptFirstFactor({strategy:"email_code",code});if(attempt.status!=="complete"||!attempt.createdSessionId)throw new Error();await setActive({session:attempt.createdSessionId});router.replace("/queues");}
    catch{setError("That code didn’t work. Request a new code and try again.");}finally{setBusy(false)}
  }
  return <SafeAreaView style={{flex:1,backgroundColor:theme.surface}}><View style={{flex:1,padding:24,justifyContent:"center",gap:16}}>
    <Text style={{fontSize:36,fontWeight:"800",color:theme.ink}}>TuRnMaRk</Text>
    <Text style={{fontSize:24,fontWeight:"700",color:theme.ink}}>Welcome back</Text>
    <Text style={{color:theme.muted}}>Sign in to manage live queues from your phone.</Text>
    {stage==="email"?<TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email address" value={email} onChangeText={setEmail} style={{backgroundColor:theme.white,borderWidth:1,borderColor:theme.border,borderRadius:14,padding:16}}/>:<TextInput keyboardType="number-pad" placeholder="6-digit code" value={code} onChangeText={setCode} style={{backgroundColor:theme.white,borderWidth:1,borderColor:theme.border,borderRadius:14,padding:16}}/>}
    {!!error&&<Text accessibilityRole="alert" style={{color:theme.danger}}>{error}</Text>}
    <Pressable disabled={busy} onPress={stage==="email"?sendCode:verify} style={{minHeight:54,borderRadius:14,backgroundColor:theme.green,alignItems:"center",justifyContent:"center"}}>{busy?<ActivityIndicator color="white"/>:<Text style={{color:"white",fontWeight:"800"}}>{stage==="email"?"Continue":"Verify code"}</Text>}</Pressable>
    {stage==="code"&&<Pressable disabled={busy} onPress={sendCode}><Text style={{color:theme.green,fontWeight:"700"}}>Resend code</Text></Pressable>}
  </View></SafeAreaView>;
}