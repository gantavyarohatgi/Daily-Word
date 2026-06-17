import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Word } from '@/src/api';
import { theme } from '@/src/theme';

const HEADER_IMG = 'https://images.pexels.com/photos/30484324/pexels-photo-30484324.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

export default function LibraryScreen() {
  const router = useRouter();
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, st] = await Promise.all([api.words(), api.stats()]);
      setWords(w as Word[]);
      setStats(st);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const Header = (
    <View style={s.hero}>
      <Image source={HEADER_IMG} style={StyleSheet.absoluteFill as any} contentFit="cover" />
      <LinearGradient
        colors={['rgba(28,25,23,0.25)', 'rgba(28,25,23,0.85)']}
        style={StyleSheet.absoluteFill as any}
      />
      <SafeAreaView edges={['top']} style={s.heroInner}>
        <Text style={s.heroEyebrow}>YOUR LIBRARY</Text>
        <Text style={s.heroTitle}>Words you have lived with</Text>
        {stats && (
          <View style={s.statRow}>
            <Stat label="Words" value={stats.total_words} />
            <View style={s.statDiv} />
            <Stat label="Streak" value={`${stats.streak}d`} />
            <View style={s.statDiv} />
            <Stat label="Revisions" value={stats.total_revisions} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );

  return (
    <View style={s.root}>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.color.brand} /></View>
      ) : (
        <FlatList
          testID="library-list"
          data={words}
          keyExtractor={(w) => w.id}
          ListHeaderComponent={Header}
          stickyHeaderIndices={[]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="book-open" size={28} color={theme.color.muted} />
              <Text style={s.emptyTxt}>{`No words unlocked yet. Open today's word to begin.`}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`library-item-${item.word}`}
              style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.color.surfaceSecondary }]}
              onPress={() => router.push(`/word/${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowWord}>{item.word}</Text>
                <Text numberOfLines={1} style={s.rowMeaning}>{item.meaning}</Text>
              </View>
              <View style={s.rowMeta}>
                <Text style={s.rowDate}>{item.unlocked_date}</Text>
                <Feather name="chevron-right" size={18} color={theme.color.muted} />
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={s.divider} />}
        />
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  hero: { height: 240, justifyContent: 'flex-end' },
  heroInner: { padding: theme.spacing.xl },
  heroEyebrow: { color: theme.color.onSurfaceInverse, opacity: 0.7, letterSpacing: 1.5, fontSize: 11 },
  heroTitle: { color: theme.color.onSurfaceInverse, fontFamily: 'serif', fontSize: 28, marginTop: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.lg, gap: theme.spacing.lg },
  statDiv: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: 'rgba(255,255,255,0.4)' },
  statVal: { color: theme.color.onSurfaceInverse, fontSize: 18, fontFamily: 'serif' },
  statLbl: { color: theme.color.onSurfaceInverse, opacity: 0.7, fontSize: 10, letterSpacing: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.lg,
    backgroundColor: theme.color.surface,
  },
  rowWord: { fontFamily: 'serif', fontSize: 22, color: theme.color.onSurface },
  rowMeaning: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  rowMeta: { alignItems: 'flex-end', gap: 4 },
  rowDate: { color: theme.color.muted, fontSize: 11, letterSpacing: 0.5 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.divider, marginHorizontal: theme.spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: theme.spacing.xxxl, alignItems: 'center', gap: 12 },
  emptyTxt: { color: theme.color.muted, textAlign: 'center', maxWidth: 240 },
});
