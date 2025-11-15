import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LiveGameNavigator } from '@/navigation/LiveGameNavigator';
import { AppStackParamList } from '@/navigation/appRoutes';
import { HomeScreen } from '@/screens/HomeScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { DuPasswordScreen } from '@/screens/DuPasswordScreen';
import { StatsHubScreen } from '@/screens/StatsHubScreen';
import { useSessionStore } from '@/store/sessionStore';

const Stack = createNativeStackNavigator<AppStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#020617',
  },
};

export default function App() {
  const role = useSessionStore((state) => state.role);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          key={role ? 'app' : 'auth'}
        >
          {!role ? (
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="DuPassword" component={DuPasswordScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="LiveGameFlow" component={LiveGameNavigator} />
              <Stack.Screen name="StatsHub" component={StatsHubScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
