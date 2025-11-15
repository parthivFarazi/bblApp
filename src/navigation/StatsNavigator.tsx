import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { StatsTabs } from '@/navigation/StatsTabs';
import { GameHistoryDetailScreen } from '@/screens/GameHistoryDetailScreen';

export type StatsStackParamList = {
  StatsTabs: undefined;
  HistoryDetail: { gameId: string; source: 'recorded' | 'sample' };
};

const Stack = createNativeStackNavigator<StatsStackParamList>();

export const StatsNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="StatsTabs" component={StatsTabs} />
    <Stack.Screen name="HistoryDetail" component={GameHistoryDetailScreen} />
  </Stack.Navigator>
);
