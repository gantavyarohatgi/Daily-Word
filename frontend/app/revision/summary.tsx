import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';

export default function RevisionSummary() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();
  const summary = useMemo(() => {
    try { return JSON.parse(data as string); } catch { return null; }
  }, [data]);

  if (!summary) {
    return <View style={s.center}><Text>Missing data</Text></View>;
  }

  const remark =
    summary.percentage >= 85 ? 'Beautifully done.'
    : summary.percentage >= 65 ? 'A solid revision.'
    : summary.percentage >= 40 ? 'A useful reminder.'
    : 'Try again tomorrow — every pass plants the word deeper.';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.content}>
        <Text style={s.eyebrow}>REVISION COMPLETE</Text>
        <Text style={s.score} testID="revision-summary-percent">{summary.percentage}%</Text>
        <Text style={s.points}>{summary.total_score} / {summary.max_score} points</Text>
        <Text style={s.meta}>{summary.word_count} {summary.word_count === 1 ? 'word' : 'words'} revised</Text>

        <View style={s.hairline} />

        <Text style={s.remark}>{remark}</Text>
      </View>

      <View style={s.ctaBar}>
        <Pressable
          testID="revision-finish-button"
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
          onPress={() => router.replace('/(tabs)/revise')}
        >
          <Text style={s.ctaTxt}>Finish</Text>
          <Feather name="check" size={18} color={theme.color.onBrand} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: theme.spacing.xxxl, justifyContent: 'center', alignItems: 'center' },
  eyebrow: { color: theme.color.muted, letterSpacing: 1.5, fontSize: 11 },
  score: { fontFamily: 'serif', fontSize: 112, color: theme.color.brand, lineHeight: 120, marginTop: theme.spacing.lg },
  points: { color: theme.color.onSurface, fontSize: 18, marginTop: theme.spacing.sm },
  meta: { color: theme.color.muted, fontSize: 13, marginTop: 4 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, width: 80, marginVertical: theme.spacing.xxl },
  remark: { fontFamily: 'serif', fontSize: 22, color: theme.color.onSurface, textAlign: 'center', fontStyle: 'italic', lineHeight: 30 },
  ctaBar: { padding: theme.spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  cta: {
    backgroundColor: theme.color.brand, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.pill,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  ctaTxt: { color: theme.color.onBrand, fontSize: 16, fontWeight: '500' },
});
