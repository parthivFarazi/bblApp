import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

import { IndividualStatsScreen } from '@/screens/IndividualStatsScreen';
import { TeamStatsScreen } from '@/screens/TeamStatsScreen';
import { TimelineScreen } from '@/screens/TimelineScreen';

const Tab = createMaterialTopTabNavigator();

export const StatsTabs = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarIndicatorStyle: { backgroundColor: '#2563EB' },
      tabBarStyle: { backgroundColor: '#0B1220' },
      tabBarInactiveTintColor: '#94A3B8',
      tabBarActiveTintColor: '#F8FAFC',
    }}
  >
    <Tab.Screen name="Individual" component={IndividualStatsScreen} />
    <Tab.Screen name="Team" component={TeamStatsScreen} />
    <Tab.Screen name="History" component={TimelineScreen} />
  </Tab.Navigator>
);
