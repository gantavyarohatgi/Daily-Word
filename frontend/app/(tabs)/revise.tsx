import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

const PRESETS = [3, 5, 10, 20];

export default function ReviseScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [count, setCount] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [st, hist] = await Promise.all([api.stats(), api.revisionHistory()]);
      setStats(st);
      setHistory(hist as any[]);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const start = async () => {
    setErr(null);
    setStarting(true);
    try {
      const r: any = await api.startRevision(count);
      router.push({
        pathname: '/revision/play',
        params: { revisionId: r.revision_id, data: JSON.stringify(r.words) },
      });
    } catch (e: any) {
      setErr(e.message || 'Could not start');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={theme.color.brand} /></View>;
  }

  const total = stats?.total_words ?? 0;
  const canRevise = stats?.can_revise;
  const maxCount = Math.min(total, 50);
  const validPresets = PRESETS.filter((n) => n <= maxCount);

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>REVISE</Text>
        <Text style={s.h1}>Bring back what matters</Text>

        {!canRevise ? (
          <View style={s.lockBox}>
            <Feather name="lock" size={20} color={theme.color.onSurfaceSecondary} />
            <Text style={s.lockTitle}>{5 - total} more {5 - total === 1 ? 'word' : 'words'} to unlock revision</Text>
            <Text style={s.lockBody}>
              You need at least 5 unlocked words. Come back tomorrow for a new one.
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.label}>HOW MANY WORDS?</Text>
            <View style={s.presetRow}>
              {validPresets.map((n) => (
                <Pressable
                  key={n}
                  testID={`revise-preset-${n}`}
                  style={[s.chip, count === n && s.chipActive]}
                  onPress={() => setCount(n)}
                >
                  <Text style={[s.chipTxt, count === n && s.chipTxtActive]}>{n}</Text>
                </Pressable>
              ))}
              {total > 5 && (
                <Pressable
                  testID="revise-preset-all"
                  style={[s.chip, count === maxCount && s.chipActive]}
                  onPress={() => setCount(maxCount)}
                >
                  <Text style={[s.chipTxt, count === maxCount && s.chipTxtActive]}>All ({maxCount})</Text>
                </Pressable>
              )}
            </View>

            {err && <Text style={s.error}>{err}</Text>}

            <Pressable
              testID="revise-start-button"
              style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
              onPress={start}
              disabled={starting}
            >
              {starting ? <ActivityIndicator color={theme.color.onBrand} /> : (
                <>
                  <Text style={s.ctaTxt}>Begin revision</Text>
                  <Feather name="arrow-right" size={18} color={theme.color.onBrand} />
                </>
              )}
            </Pressable>
          </>
        )}

        {history.length > 0 && (
          <>
            <View style={s.hairline} />
            <Text style={s.label}>PAST REVISIONS</Text>
            {history.map((h) => (
              <View key={h.revision_id} style={s.histRow}>
                <View>
                  <Text style={s.histScore}>{h.percentage}%</Text>
                  <Text style={s.histMeta}>{h.word_count} words · {new Date(h.finished_at).toLocaleDateString()}</Text>
                </View>
                <Text style={s.histPoints}>{h.total_score}/{h.max_score}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.xl, paddingBottom: 120 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.surface },
  eyebrow: { color: theme.color.muted, letterSpacing: 1.5, fontSize: 11, marginBottom: 4 },
  h1: { fontFamily: 'serif', fontSize: 32, color: theme.color.onSurface, marginBottom: theme.spacing.xl },
  label: { color: theme.color.muted, fontSize: 11, letterSpacing: 1.2, marginTop: theme.spacing.lg, marginBottom: theme.spacing.md },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, height: 36, borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderStrong,
    justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.surface,
  },
  chipActive: { backgroundColor: theme.color.surfaceInverse, borderColor: theme.color.surfaceInverse },
  chipTxt: { color: theme.color.onSurface, fontSize: 14 },
  chipTxtActive: { color: theme.color.onSurfaceInverse },
  cta: {
    marginTop: theme.spacing.xxl, backgroundColor: theme.color.brand,
    paddingVertical: theme.spacing.lg, borderRadius: theme.radius.pill,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  ctaTxt: { color: theme.color.onBrand, fontSize: 16, fontWeight: '500' },
  lockBox: { backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.xl, borderRadius: theme.radius.md, alignItems: 'center', gap: 8 },
  lockTitle: { color: theme.color.onSurface, fontSize: 16, marginTop: 8 },
  lockBody: { color: theme.color.onSurfaceSecondary, textAlign: 'center', fontSize: 13 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: theme.spacing.xxl },
  histRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.divider,
  },
  histScore: { fontFamily: 'serif', fontSize: 22, color: theme.color.onSurface },
  histMeta: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
  histPoints: { color: theme.color.onSurfaceSecondary, fontSize: 14 },
  error: { color: theme.color.error, marginTop: 8 },
});
