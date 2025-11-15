import { FC, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppStackParamList } from '@/navigation/appRoutes';
import { useSessionStore } from '@/store/sessionStore';

const DU_ACCESS_PASSWORD = 'Goducks1834';

type Props = NativeStackScreenProps<AppStackParamList, 'DuPassword'>;

const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
};

export const DuPasswordScreen: FC<Props> = ({ navigation }) => {
  const setRole = useSessionStore((state) => state.setRole);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (submitting) return;
    setSubmitting(true);
    const normalized = password.trim();
    if (normalized.length === 0) {
      showToast('Enter the DU access password.');
      setSubmitting(false);
      return;
    }
    if (normalized === DU_ACCESS_PASSWORD) {
      setRole('brother');
      setPassword('');
      setSubmitting(false);
      return;
    }
    showToast('Incorrect password');
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.kicker}>Delta Upsilon</Text>
        <Text style={styles.title}>Members Only</Text>
        <Text style={styles.copy}>
          Enter the shared DU passcode to access the Stats Center and league-only gameplay controls.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Access Password</Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#475569"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
          />
          <Pressable style={[styles.cta, submitting && styles.ctaDisabled]} onPress={handleSubmit}>
            <Text style={styles.ctaLabel}>Unlock DU Home</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryLabel}>Back</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  kicker: {
    color: '#818CF8',
    fontWeight: '600',
    letterSpacing: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '700',
  },
  copy: {
    color: '#94A3B8',
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 16,
  },
  label: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cta: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondary: {
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
});

