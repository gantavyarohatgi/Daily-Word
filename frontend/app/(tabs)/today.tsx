import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Word } from '@/src/api';
import { theme } from '@/src/theme';

export default function TodayScreen() {
  const router = useRouter();
  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const w = await api.today() as Word;
      setWord(w);
    } catch (e: any) {
      setErr(e.message || 'Unable to load today\'s word');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const speak = () => {
    if (word) Speech.speak(word.word, { rate: 0.9 });
  };

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text testID="today-header" style={s.eyebrow}>TODAY · {new Date().toDateString()}</Text>

        {loading && !word ? (
          <View style={s.center}><ActivityIndicator color={theme.color.brand} /></View>
        ) : err ? (
          <View style={s.center}>
            <Text style={s.error}>{err}</Text>
            <Pressable testID="today-retry" onPress={load} style={s.retry}>
              <Text style={s.retryTxt}>Try again</Text>
            </Pressable>
          </View>
        ) : word ? (
          <>
            <Text testID="today-word" style={s.word}>{word.word}</Text>
            <View style={s.phonRow}>
              <Text testID="today-phonetic" style={s.phonetic}>{word.phonetic}</Text>
              <Pressable testID="today-speak-button" onPress={speak} style={s.iconBtn} hitSlop={8}>
                <Feather name="volume-2" size={20} color={theme.color.brand} />
              </Pressable>
            </View>

            <View style={s.hairline} />

            <Text style={s.label}>MEANING</Text>
            <Text testID="today-meaning" style={s.body}>{word.meaning}</Text>

            <Text style={[s.label, { marginTop: theme.spacing.xl }]}>EXAMPLE</Text>
            <Text testID="today-example" style={s.example}>“{word.example}”</Text>

            {word.practiced && (
              <View style={s.practicedBadge}>
                <Feather name="check" size={14} color={theme.color.success} />
                <Text style={s.practicedTxt}>You practiced this word today</Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {word && (
        <View style={s.ctaBar}>
          <Pressable
            testID="today-practice-button"
            style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
            onPress={() => router.push(`/practice/${word.id}`)}
          >
            <Text style={s.ctaTxt}>{word.practiced ? 'Practice again' : 'Practice now'}</Text>
            <Feather name="arrow-right" size={18} color={theme.color.onBrand} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.xl, paddingBottom: 120 },
  eyebrow: { color: theme.color.muted, fontSize: 11, letterSpacing: 1.5, marginBottom: theme.spacing.xl },
  word: { fontFamily: 'serif', fontSize: 56, color: theme.color.onSurface, lineHeight: 64 },
  phonRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm, gap: 12 },
  phonetic: { fontFamily: 'serif', fontSize: 18, color: theme.color.onSurfaceSecondary, fontStyle: 'italic' },
  iconBtn: { padding: 6 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: theme.spacing.xl },
  label: { color: theme.color.muted, fontSize: 11, letterSpacing: 1.2, marginBottom: theme.spacing.sm },
  body: { color: theme.color.onSurface, fontSize: 17, lineHeight: 26 },
  example: { color: theme.color.onSurfaceSecondary, fontSize: 17, lineHeight: 26, fontStyle: 'italic', fontFamily: 'serif' },
  practicedBadge: {
    marginTop: theme.spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  practicedTxt: { color: theme.color.success, fontSize: 13 },
  center: { paddingVertical: 80, alignItems: 'center' },
  error: { color: theme.color.error, marginBottom: 12 },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderStrong, borderRadius: theme.radius.pill },
  retryTxt: { color: theme.color.onSurface },
  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: theme.spacing.lg, paddingBottom: theme.spacing.xl,
    backgroundColor: theme.color.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border,
  },
  cta: {
    backgroundColor: theme.color.brand,
    paddingVertical: theme.spacing.lg, borderRadius: theme.radius.pill,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  ctaPressed: { opacity: 0.85 },
  ctaTxt: { color: theme.color.onBrand, fontSize: 16, fontWeight: '500' },
});
