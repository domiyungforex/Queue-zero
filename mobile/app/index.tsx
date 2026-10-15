import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { ActivityIndicator, View } from "react-native";
export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <View style={{flex:1,alignItems:"center",justifyContent:"center"}}><ActivityIndicator /></View>;
  return <Redirect href={isSignedIn ? "/queues" : "/sign-in"} />;
}