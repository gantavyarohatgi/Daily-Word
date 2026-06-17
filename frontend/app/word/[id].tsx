import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Word } from '@/src/api';
import { theme } from '@/src/theme';

export default function WordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [w, setW] = useState<Word | null>(null);

  useEffect(() => {
    api.word(id as string).then((d) => setW(d as Word)).catch(() => {});
  }, [id]);

  if (!w) return <View style={s.center}><ActivityIndicator color={theme.color.brand} /></View>;

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={theme.color.onSurface} />
        </Pressable>
        <Text style={s.eyebrow}>UNLOCKED · {w.unlocked_date}</Text>
        <Text style={s.word}>{w.word}</Text>
        <View style={s.row}>
          <Text style={s.phonetic}>{w.phonetic}</Text>
          <Pressable onPress={() => Speech.speak(w.word, { rate: 0.9 })} hitSlop={8} style={{ padding: 4 }}>
            <Feather name="volume-2" size={20} color={theme.color.brand} />
          </Pressable>
        </View>
        <View style={s.hairline} />
        <Text style={s.label}>MEANING</Text>
        <Text style={s.body}>{w.meaning}</Text>
        <Text style={[s.label, { marginTop: theme.spacing.xl }]}>EXAMPLE</Text>
        <Text style={s.example}>{`"${w.example}"`}</Text>

        <Pressable
          testID="word-practice-button"
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
          onPress={() => router.push(`/practice/${w.id}`)}
        >
          <Text style={s.ctaTxt}>Practice this word</Text>
          <Feather name="arrow-right" size={18} color={theme.color.onBrand} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.xl, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.surface },
  backBtn: { alignSelf: 'flex-start', padding: 4, marginBottom: theme.spacing.md },
  eyebrow: { color: theme.color.muted, letterSpacing: 1.5, fontSize: 11, marginBottom: 4 },
  word: { fontFamily: 'serif', fontSize: 52, color: theme.color.onSurface, lineHeight: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  phonetic: { fontFamily: 'serif', fontStyle: 'italic', fontSize: 18, color: theme.color.onSurfaceSecondary },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: theme.spacing.xl },
  label: { color: theme.color.muted, letterSpacing: 1.2, fontSize: 11, marginBottom: 6 },
  body: { color: theme.color.onSurface, fontSize: 17, lineHeight: 26 },
  example: { fontStyle: 'italic', fontFamily: 'serif', color: theme.color.onSurfaceSecondary, fontSize: 17, lineHeight: 26 },
  cta: {
    marginTop: theme.spacing.xxl, backgroundColor: theme.color.brand,
    paddingVertical: theme.spacing.lg, borderRadius: theme.radius.pill,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  ctaTxt: { color: theme.color.onBrand, fontSize: 16, fontWeight: '500' },
});
