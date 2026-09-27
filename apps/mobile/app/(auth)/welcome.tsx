import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Wordmark, tap } from "../../src/components/ui";
import { ONBOARDED_KEY, setPref } from "../../src/lib/storage";
import { font } from "../../src/lib/theme";

const ACCENT = "#FF6A3D";

const SLIDES = [
  {
    image: require("../../assets/images/welcome.jpg"),
    eyebrow: "The problem",
    title: "A real source can still not say what the claim says.",
    body: "A study finds an association and the claim says it proves causation. ProofLens catches that gap.",
  },
  {
    image: require("../../assets/images/library.jpg"),
    eyebrow: "Your evidence",
    title: "Attach the document. Keep the page.",
    body: "Upload a PDF or paste a passage. Text is read page by page, so every verdict can point back to where it came from.",
  },
  {
    image: require("../../assets/images/empty.jpg"),
    eyebrow: "The verdict",
    title: "An answer that explains itself.",
    body: "Supported, partially supported, contradicted or insufficient evidence, with the exact sentence it rests on.",
  },
];

// Photography sets the palette here, so the introduction is dark in both themes.
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const goTo = (i: number) => {
    tap();
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  };

  const leave = (to: "/(auth)/register" | "/(auth)/login") => {
    void setPref(ONBOARDED_KEY, "1");
    router.push(to);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0F0F11" }}>
      <StatusBar style="light" />
      <ScrollView ref={scroller} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} style={{ flex: 1 }}>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={{ width, flex: 1 }} accessible accessibilityLabel={`${i + 1} of ${SLIDES.length}. ${s.title} ${s.body}`}>
            <Image source={s.image} contentFit="cover" transition={300} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} accessibilityIgnoresInvertColors />
            <LinearGradient colors={["rgba(15,15,17,0.62)", "rgba(15,15,17,0.10)", "rgba(15,15,17,0.86)", "#0F0F11"]} locations={[0, 0.26, 0.6, 0.92]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: 24, paddingBottom: insets.bottom + (i === SLIDES.length - 1 ? 196 : 128), gap: 12 }}>
              <Text style={{ fontFamily: font.monoMedium, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: ACCENT }}>
                {String(i + 1).padStart(2, "0")} · {s.eyebrow}
              </Text>
              <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 35, lineHeight: 39, letterSpacing: -1.1, color: "#FFFFFF" }}>{s.title}</Text>
              <Text style={{ fontFamily: font.body, fontSize: 16.5, lineHeight: 25, color: "rgba(255,255,255,0.8)" }}>{s.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ position: "absolute", top: insets.top + 14, left: 24, right: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", pointerEvents: "box-none" }}>
        <Wordmark size={28} color="#FFFFFF" />
        {!last ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Skip the introduction" hitSlop={12} onPress={() => goTo(SLIDES.length - 1)} style={({ pressed }) => ({ height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ fontFamily: font.semi, fontSize: 14, color: "#FFFFFF" }}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ position: "absolute", left: 24, right: 24, bottom: insets.bottom + 20, gap: 18, pointerEvents: "box-none" }}>
        <View accessibilityRole="progressbar" accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {SLIDES.map((s, i) => (
            <Pressable key={s.title} accessibilityLabel={`Go to slide ${i + 1}`} hitSlop={10} onPress={() => goTo(i)}>
              <View style={{ height: 6, width: i === index ? 28 : 6, borderRadius: 3, backgroundColor: i === index ? ACCENT : "rgba(255,255,255,0.35)" }} />
            </Pressable>
          ))}
        </View>
        {last ? (
          <View style={{ gap: 10 }}>
            <Button title="Create an account" size="lg" iconRight="arrow-forward" onPress={() => leave("/(auth)/register")} textColor="#0F0F11" style={{ backgroundColor: ACCENT, borderColor: ACCENT }} />
            <Button title="I already have an account" size="lg" variant="ghost" textColor="#FFFFFF" onPress={() => leave("/(auth)/login")} style={{ backgroundColor: "rgba(255,255,255,0.14)" }} />
          </View>
        ) : (
          <Button title="Next" size="lg" iconRight="arrow-forward" onPress={() => goTo(index + 1)} textColor="#0F0F11" style={{ backgroundColor: ACCENT, borderColor: ACCENT }} />
        )}
      </View>
    </View>
  );
}
