import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LiveGameScreen } from '@/screens/LiveGameScreen';
import { GameSummaryScreen } from '@/screens/GameSummaryScreen';
import { GameModeScreen } from '@/screens/GameModeScreen';
import { FriendlySetupScreen } from '@/screens/FriendlySetupScreen';
import { LeagueSetupScreen } from '@/screens/LeagueSetupScreen';

export type LiveGameStackParamList = {
  GameMode: undefined;
  FriendlySetup: undefined;
  LeagueSetup: undefined;
  LiveGame: undefined;
  Summary: undefined;
};

const Stack = createNativeStackNavigator<LiveGameStackParamList>();

export const LiveGameNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="GameMode" component={GameModeScreen} />
      <Stack.Screen name="FriendlySetup" component={FriendlySetupScreen} />
      <Stack.Screen name="LeagueSetup" component={LeagueSetupScreen} />
      <Stack.Screen name="LiveGame" component={LiveGameScreen} />
      <Stack.Screen name="Summary" component={GameSummaryScreen} />
    </Stack.Navigator>
  );
};
