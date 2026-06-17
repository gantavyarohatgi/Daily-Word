import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/src/auth';
import { theme } from '@/src/theme';

const HERO = 'https://images.pexels.com/photos/5634672/pexels-photo-5634672.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

export default function Signup() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !email.trim() || pwd.length < 6) {
      setErr('Name, email, and a password of at least 6 characters are required.');
      return;
    }
    setBusy(true);
    try {
      await signup(email.trim(), pwd, name.trim());
      router.replace('/(tabs)/today');
    } catch (e: any) {
      setErr(e.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Image source={HERO} style={StyleSheet.absoluteFill as any} contentFit="cover" />
          <LinearGradient
            colors={['rgba(28,25,23,0.0)', 'rgba(28,25,23,0.85)']}
            style={StyleSheet.absoluteFill as any}
          />
          <View style={s.heroText}>
            <Text style={s.brand}>Lexis</Text>
            <Text style={s.tag}>Begin your daily word journal.</Text>
          </View>
        </View>

        <View style={s.form}>
          <Text style={s.h1}>Create account</Text>
          <Text style={s.sub}>One new word a day. Reflect, write, remember.</Text>

          <Text style={s.label}>Name</Text>
          <TextInput
            testID="signup-name-input"
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.color.muted}
          />

          <Text style={s.label}>Email</Text>
          <TextInput
            testID="signup-email-input"
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={theme.color.muted}
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            testID="signup-password-input"
            style={s.input}
            value={pwd}
            onChangeText={setPwd}
            secureTextEntry
            placeholder="At least 6 characters"
            placeholderTextColor={theme.color.muted}
          />

          {err && <Text testID="signup-error" style={s.error}>{err}</Text>}

          <Pressable
            testID="signup-submit-button"
            style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={theme.color.onBrand} /> : (
              <>
                <Text style={s.btnTxt}>Create account</Text>
                <Feather name="arrow-right" size={18} color={theme.color.onBrand} />
              </>
            )}
          </Pressable>

          <View style={s.row}>
            <Text style={s.muted}>Have an account?</Text>
            <Link href="/auth/login" asChild>
              <Pressable testID="signup-go-login">
                <Text style={s.linkTxt}>  Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { flexGrow: 1 },
  hero: { height: 280, justifyContent: 'flex-end' },
  heroText: { padding: theme.spacing.xl },
  brand: { color: theme.color.onSurfaceInverse, fontFamily: 'serif', fontSize: 44, letterSpacing: 0.5 },
  tag: { color: theme.color.onSurfaceInverse, opacity: 0.85, fontSize: 14, marginTop: 4 },
  form: { padding: theme.spacing.xl, gap: theme.spacing.sm },
  h1: { fontFamily: 'serif', fontSize: 32, color: theme.color.onSurface, marginBottom: 4 },
  sub: { color: theme.color.onSurfaceSecondary, fontSize: 14, marginBottom: theme.spacing.lg },
  label: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: theme.spacing.md, letterSpacing: 0.5 },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.borderStrong,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.color.onSurface,
  },
  btn: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.color.brand,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnPressed: { opacity: 0.85 },
  btnTxt: { color: theme.color.onBrand, fontSize: 16, fontWeight: '500' },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg },
  muted: { color: theme.color.muted },
  linkTxt: { color: theme.color.brand, fontWeight: '500' },
  error: { color: theme.color.error, marginTop: theme.spacing.sm },
});
