import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

type RWord = { word_id: string; word: string; phonetic: string; index: number; total: number };

export default function RevisionPlay() {
  const { revisionId, data } = useLocalSearchParams<{ revisionId: string; data: string }>();
  const router = useRouter();
  const words: RWord[] = useMemo(() => {
    try { return JSON.parse(data as string); } catch { return []; }
  }, [data]);

  const [idx, setIdx] = useState(0);
  const [meaning, setMeaning] = useState('');
  const [s1, set1] = useState('');
  const [s2, set2] = useState('');
  const [s3, set3] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [totalScore, setTotalScore] = useState(0);

  const current = words[idx];
  if (!current) {
    return <View style={s.center}><Text style={s.error}>No words to revise.</Text></View>;
  }

  const submit = async () => {
    setErr(null);
    if (!meaning.trim() || !s1.trim() || !s2.trim() || !s3.trim()) {
      setErr('Please fill meaning and all three sentences.');
      return;
    }
    setBusy(true);
    try {
      const r: any = await api.revisionAnswer(
        revisionId as string, current.word_id, meaning.trim(),
        [s1.trim(), s2.trim(), s3.trim()],
      );
      setResult(r);
      setTotalScore((t) => t + r.overall_score);
    } catch (e: any) {
      setErr(e.message || 'Could not submit.');
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (idx + 1 < words.length) {
      setIdx(idx + 1);
      setMeaning(''); set1(''); set2(''); set3('');
      setResult(null);
    } else {
      // finish
      try {
        const summary: any = await api.finishRevision(revisionId as string);
        router.replace({
          pathname: '/revision/summary',
          params: { data: JSON.stringify(summary) },
        });
      } catch (e: any) {
        setErr(e.message || 'Could not finish.');
      }
    }
  };

  // Result view
  if (result) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.eyebrow}>WORD {idx + 1} / {words.length}</Text>
          <Text style={s.word}>{current.word}</Text>
          <Text style={s.scoreLine}>
            <Text testID="revision-word-score" style={s.scoreBig}>{result.overall_score}</Text>
            <Text style={s.scoreOf}> / 40</Text>
          </Text>

          <View style={s.fbCard}>
            <View style={s.fbHead}>
              <Text style={s.fbNum}>MEANING</Text>
              <Text style={s.fbScore}>{result.meaning_score}/10</Text>
            </View>
            <Text style={s.fbBody}>{result.meaning_feedback}</Text>
            <Text style={s.correctLbl}>CORRECT MEANING</Text>
            <Text style={s.correct}>{result.correct_meaning}</Text>
          </View>

          {result.sentence_feedbacks.map((f: any, i: number) => (
            <View key={i} style={s.fbCard}>
              <View style={s.fbHead}>
                <Text style={s.fbNum}>Sentence {i + 1}</Text>
                <Text style={s.fbScore}>{f.score}/10</Text>
              </View>
              <Text style={s.fbSentence}>{`"${f.sentence}"`}</Text>
              <Text style={s.fbBody}>{f.feedback}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.ctaBar}>
          <Pressable
            testID="revision-next-button"
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
            onPress={next}
          >
            <Text style={s.ctaTxt}>
              {idx + 1 < words.length ? 'Next word' : 'See score'}
            </Text>
            <Feather name="arrow-right" size={18} color={theme.color.onBrand} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Question view
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${((idx) / words.length) * 100}%` }]} />
          </View>
          <Text style={s.eyebrow}>WORD {idx + 1} / {words.length}</Text>
          <View style={s.wordRow}>
            <Text testID="revision-current-word" style={s.word}>{current.word}</Text>
            <Pressable onPress={() => Speech.speak(current.word, { rate: 0.9 })} hitSlop={8} style={{ padding: 6 }}>
              <Feather name="volume-2" size={20} color={theme.color.brand} />
            </Pressable>
          </View>
          <Text style={s.phonetic}>{current.phonetic}</Text>

          <View style={s.hairline} />

          <Text style={s.inputLabel}>WHAT DOES IT MEAN?</Text>
          <TextInput
            testID="revision-meaning-input"
            value={meaning} onChangeText={setMeaning}
            multiline
            style={[s.input, { minHeight: 80 }]}
            placeholder="In your own words…"
            placeholderTextColor={theme.color.muted}
          />

          <Text style={[s.inputLabel, { marginTop: theme.spacing.xl }]}>WRITE 3 SENTENCES</Text>
          {[
            { val: s1, set: set1, id: 'revision-sentence-1' },
            { val: s2, set: set2, id: 'revision-sentence-2' },
            { val: s3, set: set3, id: 'revision-sentence-3' },
          ].map((f, i) => (
            <View key={i} style={{ marginTop: theme.spacing.md }}>
              <TextInput
                testID={f.id}
                value={f.val} onChangeText={f.set}
                multiline
                style={s.input}
                placeholder={`Sentence ${i + 1}`}
                placeholderTextColor={theme.color.muted}
              />
            </View>
          ))}

          {err && <Text style={s.error}>{err}</Text>}
        </ScrollView>
        <View style={s.ctaBar}>
          <Pressable
            testID="revision-submit-button"
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={theme.color.onBrand} /> : (
              <>
                <Text style={s.ctaTxt}>Submit answer</Text>
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
  progressBar: { height: 3, backgroundColor: theme.color.surfaceTertiary, borderRadius: 2, marginBottom: theme.spacing.lg, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: theme.color.brand },
  eyebrow: { color: theme.color.muted, letterSpacing: 1.5, fontSize: 11 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  word: { fontFamily: 'serif', fontSize: 44, color: theme.color.onSurface, lineHeight: 52 },
  phonetic: { fontFamily: 'serif', fontStyle: 'italic', fontSize: 16, color: theme.color.onSurfaceSecondary, marginTop: 2 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: theme.spacing.xl },
  inputLabel: { color: theme.color.muted, letterSpacing: 1.2, fontSize: 11, marginBottom: 6 },
  input: {
    minHeight: 56,
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
  },
  ctaTxt: { color: theme.color.onBrand, fontSize: 16, fontWeight: '500' },
  scoreLine: { marginTop: theme.spacing.lg, flexDirection: 'row', alignItems: 'flex-end' },
  scoreBig: { fontFamily: 'serif', fontSize: 56, color: theme.color.brand, lineHeight: 60 },
  scoreOf: { fontFamily: 'serif', fontSize: 22, color: theme.color.muted },
  fbCard: {
    marginTop: theme.spacing.lg, padding: theme.spacing.lg,
    backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md,
  },
  fbHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fbNum: { color: theme.color.muted, fontSize: 11, letterSpacing: 1 },
  fbScore: { color: theme.color.brand, fontWeight: '500' },
  fbSentence: { fontStyle: 'italic', color: theme.color.onSurface, fontSize: 15, marginBottom: 6 },
  fbBody: { color: theme.color.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  correctLbl: { color: theme.color.muted, fontSize: 10, letterSpacing: 1.2, marginTop: theme.spacing.md },
  correct: { color: theme.color.onSurface, fontSize: 14, marginTop: 4, fontStyle: 'italic' },
  error: { color: theme.color.error, marginTop: theme.spacing.md },
});
