import { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppStackParamList } from '@/navigation/appRoutes';
import { StatsNavigator } from '@/navigation/StatsNavigator';

type Props = NativeStackScreenProps<AppStackParamList, 'StatsHub'>;

export const StatsHubScreen: FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backLabel}>← Home</Text>
        </Pressable>
        <View>
          <Text style={styles.kicker}>Stat Center</Text>
          <Text style={styles.title}>DU Leaderboards</Text>
        </View>
      </View>

      <View style={styles.spacer} />
      <StatsNavigator />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  backLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  kicker: {
    color: '#38BDF8',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
  },
  spacer: {
    height: 8,
  },
});

