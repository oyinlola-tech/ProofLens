import { Tabs } from "expo-router";
import { TabBar } from "../../../src/components/TabBar";
import { useTheme } from "../../../src/lib/theme";

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs tabBar={(props) => <TabBar state={props.state} navigation={props.navigation} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.canvas } }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="history" options={{ title: "Activity" }} />
      <Tabs.Screen name="documents" options={{ title: "Library" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
