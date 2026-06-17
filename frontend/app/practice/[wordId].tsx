import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Word } from '@/src/api';
import { theme } from '@/src/theme';

export default function PracticeScreen() {
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  const router = useRouter();
  const [word, setWord] = useState<Word | null>(null);
  const [s1, set1] = useState('');
  const [s2, set2] = useState('');
  const [s3, set3] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const w = await api.word(wordId as string) as Word;
        setWord(w);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [wordId]);

  const submit = async () => {
    if (!word) return;
    if (!s1.trim() || !s2.trim() || !s3.trim()) {
      setErr('Please write all three sentences.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const r = await api.practice(word.id, [s1.trim(), s2.trim(), s3.trim()]);
      setResult(r);
    } catch (e: any) {
      setErr(e.message || 'Could not get feedback.');
    } finally {
      setBusy(false);
    }
  };

  if (!word) {
    return (
      <View style={s.center}>
        <Stack.Screen options={{ headerShown: false }} />
        {err ? <Text style={s.error}>{err}</Text> : <ActivityIndicator color={theme.color.brand} />}
      </View>
    );
  }

  if (result) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={s.scroll}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Feather name="x" size={22} color={theme.color.onSurface} />
          </Pressable>
          <Text style={s.eyebrow}>FEEDBACK</Text>
          <Text style={s.word}>{word.word}</Text>
          <Text style={s.scoreLine}>
            <Text testID="practice-overall-score" style={s.scoreBig}>{result.overall_score}</Text>
            <Text style={s.scoreOf}> / 30</Text>
          </Text>
          {result.summary ? <Text style={s.summary}>{result.summary}</Text> : null}

          {result.feedbacks.map((f: any, i: number) => (
            <View key={i} style={s.fbCard} testID={`practice-feedback-${i}`}>
              <View style={s.fbHead}>
                <Text style={s.fbNum}>Sentence {i + 1}</Text>
                <Text style={s.fbScore}>{f.score}/10</Text>
              </View>
              <Text style={s.fbSentence}>{`"${f.sentence}"`}</Text>
              <Text style={s.fbBody}>{f.feedback}</Text>
            </View>
          ))}

          <Pressable
            testID="practice-done-button"
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
            onPress={() => router.replace('/(tabs)/today')}
          >
            <Text style={s.ctaTxt}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Feather name="x" size={22} color={theme.color.onSurface} />
          </Pressable>
          <Text style={s.eyebrow}>PRACTICE</Text>
          <Text style={s.word}>{word.word}</Text>
          <Text style={s.phonetic}>{word.phonetic}</Text>
          <Text style={s.meaning}>{word.meaning}</Text>

          <View style={s.hairline} />
          <Text style={s.prompt}>Write 3 sentences using this word.</Text>

          {[
            { val: s1, set: set1, id: 'practice-sentence-1' },
            { val: s2, set: set2, id: 'practice-sentence-2' },
            { val: s3, set: set3, id: 'practice-sentence-3' },
          ].map((f, i) => (
            <View key={i} style={{ marginTop: theme.spacing.lg }}>
              <Text style={s.inputLabel}>SENTENCE {i + 1}</Text>
              <TextInput
                testID={f.id}
                value={f.val}
                onChangeText={f.set}
                multiline
                style={s.input}
                placeholder={`Your sentence ${i + 1}…`}
                placeholderTextColor={theme.color.muted}
              />
            </View>
          ))}

          {err && <Text style={s.error}>{err}</Text>}
        </ScrollView>

        <View style={s.ctaBar}>
          <Pressable
            testID="practice-submit-button"
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={theme.color.onBrand} /> : (
              <>
                <Text style={s.ctaTxt}>Submit for feedback</Text>
                <Feather name="arrow-right" size={18} color={theme.color.onBrand} />
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.xl, paddingBottom: 140 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.surface },
  backBtn: { alignSelf: 'flex-start', padding: 4, marginBottom: theme.spacing.md },
  eyebrow: { color: theme.color.muted, letterSpacing: 1.5, fontSize: 11, marginBottom: 4 },
  word: { fontFamily: 'serif', fontSize: 44, color: theme.color.onSurface, lineHeight: 52 },
  phonetic: { fontFamily: 'serif', fontStyle: 'italic', fontSize: 16, color: theme.color.onSurfaceSecondary, marginTop: 4 },
  meaning: { color: theme.color.onSurface, fontSize: 16, marginTop: theme.spacing.md, lineHeight: 24 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: theme.spacing.xl },
  prompt: { color: theme.color.onSurface, fontSize: 16 },
  inputLabel: { color: theme.color.muted, fontSize: 11, letterSpacing: 1.2, marginBottom: 6 },
  input: {
    minHeight: 60,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderStrong,
    borderRadius: theme.radius.md, padding: theme.spacing.md, fontSize: 16,
    color: theme.color.onSurface, backgroundColor: theme.color.surface,
    textAlignVertical: 'top',
  },
  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: theme.spacing.lg,
    backgroundColor: theme.color.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border,
  },
  cta: {
    backgroundColor: theme.color.brand, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.pill,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginTop: theme.spacing.lg,
  },
  ctaTxt: { color: theme.color.onBrand, fontSize: 16, fontWeight: '500' },
  scoreLine: { marginTop: theme.spacing.lg, flexDirection: 'row', alignItems: 'flex-end' },
  scoreBig: { fontFamily: 'serif', fontSize: 64, color: theme.color.brand, lineHeight: 70 },
  scoreOf: { fontFamily: 'serif', fontSize: 24, color: theme.color.muted },
  summary: { color: theme.color.onSurfaceSecondary, fontSize: 15, marginTop: theme.spacing.sm, lineHeight: 22 },
  fbCard: {
    marginTop: theme.spacing.lg, padding: theme.spacing.lg,
    backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md,
  },
  fbHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fbNum: { color: theme.color.muted, fontSize: 11, letterSpacing: 1 },
  fbScore: { color: theme.color.brand, fontWeight: '500' },
  fbSentence: { fontStyle: 'italic', color: theme.color.onSurface, fontSize: 15, marginBottom: 6 },
  fbBody: { color: theme.color.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  error: { color: theme.color.error, marginTop: theme.spacing.md },
});
