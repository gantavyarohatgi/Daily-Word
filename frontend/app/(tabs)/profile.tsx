import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await api.stats();
      setStats(s);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>PROFILE</Text>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text testID="profile-name" style={s.name}>{user?.name}</Text>
        <Text testID="profile-email" style={s.email}>{user?.email}</Text>

        <View style={s.hairline} />

        {loading ? (
          <ActivityIndicator color={theme.color.brand} />
        ) : stats ? (
          <View style={s.statGrid}>
            <Stat label="Words unlocked" value={stats.total_words} />
            <Stat label="Current streak" value={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`} />
            <Stat label="Practices" value={stats.total_practices} />
            <Stat label="Revisions" value={stats.total_revisions} />
          </View>
        ) : null}

        <View style={s.hairline} />

        <Pressable testID="profile-logout-button" style={s.logout} onPress={logout}>
          <Feather name="log-out" size={18} color={theme.color.error} />
          <Text style={s.logoutTxt}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={s.statItem}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.xl, paddingBottom: 80 },
  eyebrow: { color: theme.color.muted, letterSpacing: 1.5, fontSize: 11, marginBottom: theme.spacing.xl },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.color.brandTertiary,
    justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.md,
  },
  avatarTxt: { fontFamily: 'serif', fontSize: 32, color: theme.color.onBrandTertiary },
  name: { fontFamily: 'serif', fontSize: 28, color: theme.color.onSurface },
  email: { color: theme.color.onSurfaceSecondary, fontSize: 14, marginTop: 2 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: theme.spacing.xl },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg },
  statItem: { width: '47%', paddingVertical: theme.spacing.md },
  statVal: { fontFamily: 'serif', fontSize: 28, color: theme.color.onSurface },
  statLbl: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
  logout: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 12 },
  logoutTxt: { color: theme.color.error, fontSize: 15 },
});
