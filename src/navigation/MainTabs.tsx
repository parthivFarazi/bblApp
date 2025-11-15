import { FC } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { LiveGameNavigator } from '@/navigation/LiveGameNavigator';
import { StatsNavigator } from '@/navigation/StatsNavigator';
import { useSessionStore } from '@/store/sessionStore';

const Tab = createBottomTabNavigator();

const SettingsScreen = () => {
  const clear = useSessionStore((state) => state.clear);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: '#E2E8F0', fontSize: 18, fontWeight: '600' }}>Session</Text>
      <Pressable
        onPress={clear}
        style={{ backgroundColor: '#EF4444', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Sign out</Text>
      </Pressable>
    </View>
  );
};

export const MainTabs: FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: '#1F2937' },
        tabBarInactiveTintColor: '#94A3B8',
      }}
    >
      <Tab.Screen
        name="Live"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="play-circle" size={size} color={color} />,
          title: 'Live Game',
        }}
        component={LiveGameNavigator}
      />
      <Tab.Screen
        name="Stats"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
          title: 'Stats',
        }}
        component={StatsNavigator}
      />
      <Tab.Screen
        name="More"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} />,
        }}
        component={SettingsScreen}
      />
    </Tab.Navigator>
  );
};
