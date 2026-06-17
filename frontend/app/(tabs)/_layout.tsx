import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { theme } from '@/src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.muted,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
          borderTopWidth: StyleSheet_hairline(),
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, letterSpacing: 0.4 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Feather name="sun" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <Feather name="book" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="revise"
        options={{
          title: 'Revise',
          tabBarIcon: ({ color, size }) => <Feather name="repeat" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

function StyleSheet_hairline() {
  // small helper to avoid importing StyleSheet just for the constant
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native').StyleSheet.hairlineWidth;
}
