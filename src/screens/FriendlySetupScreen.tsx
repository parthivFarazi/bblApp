import { FC, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { LiveGameStackParamList } from '@/navigation/LiveGameNavigator';
import { useGameStore } from '@/store/gameStore';
import { usePlayerStore } from '@/store/playerStore';
import { PlayerIdentity } from '@/types';

type Step = 'names' | 'teamA' | 'teamB' | 'confirm';
type TeamKey = 'teamA' | 'teamB';

const inningsOptions = [3, 5, 7, 9];
const stepOrder: Step[] = ['names', 'teamA', 'teamB', 'confirm'];

type Props = NativeStackScreenProps<LiveGameStackParamList, 'FriendlySetup'>;

export const FriendlySetupScreen: FC<Props> = ({ navigation }) => {
  const startGame = useGameStore((state) => state.startGame);
  const playerDirectory = usePlayerStore((state) => state.players);
  const addPlayer = usePlayerStore((state) => state.addPlayer);
  const [step, setStep] = useState<Step>('names');
  const [teamAName, setTeamAName] = useState('Visitors');
  const [teamBName, setTeamBName] = useState('Home Team');
  const [innings, setInnings] = useState(5);
  const allPlayers = useMemo(() => Object.values(playerDirectory), [playerDirectory]);
  const { teamASeed, teamBSeed } = useMemo(() => {
    const first = allPlayers.slice(0, 4);
    const second = allPlayers.slice(4, 8);
    return {
      teamASeed: first,
      teamBSeed: second.length ? second : first,
    };
  }, [allPlayers]);
  const [lineups, setLineups] = useState<{ teamA: PlayerIdentity[]; teamB: PlayerIdentity[] }>(() => ({
    teamA: teamASeed,
    teamB: teamBSeed,
  }));
  const [guestInputs, setGuestInputs] = useState<{ teamA: string; teamB: string }>({
    teamA: '',
    teamB: '',
  });
  const [search, setSearch] = useState<{ teamA: string; teamB: string }>({
    teamA: '',
    teamB: '',
  });
  const [guestPlayers, setGuestPlayers] = useState<PlayerIdentity[]>([]);
  const [newBrother, setNewBrother] = useState<{ first: string; last: string }>({
    first: '',
    last: '',
  });
  const searchInputRefs = {
    teamA: useRef<TextInput>(null),
    teamB: useRef<TextInput>(null),
  };

  const updateLineups = (updater: (prev: { teamA: PlayerIdentity[]; teamB: PlayerIdentity[] }) => {
    teamA: PlayerIdentity[];
    teamB: PlayerIdentity[];
  }) => setLineups((prev) => updater(prev));

  const assignPlayer = (teamKey: TeamKey, player: PlayerIdentity) => {
    updateLineups((prev) => {
      const otherKey: TeamKey = teamKey === 'teamA' ? 'teamB' : 'teamA';
      const next = {
        teamA: prev.teamA.filter((slot) => slot.id !== player.id),
        teamB: prev.teamB.filter((slot) => slot.id !== player.id),
      };
      if (next[teamKey].some((slot) => slot.id === player.id)) {
        return next;
      }
      return {
        ...next,
        [teamKey]: [...next[teamKey], player],
      };
    });
  };

  const removePlayer = (teamKey: TeamKey, playerId: string) => {
    updateLineups((prev) => ({
      ...prev,
      [teamKey]: prev[teamKey].filter((player) => player.id !== playerId),
    }));
  };

  const movePlayer = (teamKey: TeamKey, index: number, direction: 'up' | 'down') => {
    updateLineups((prev) => {
      const roster = [...prev[teamKey]];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= roster.length) return prev;
      [roster[index], roster[swapIndex]] = [roster[swapIndex], roster[index]];
      return {
        ...prev,
        [teamKey]: roster,
      };
    });
  };

  const handleAddGuest = (teamKey: TeamKey) => {
    const name = guestInputs[teamKey].trim();
    if (!name) return;
    const guest: PlayerIdentity = {
      id: `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      displayName: name,
      isGuest: true,
    };
    setGuestPlayers((prev) => [...prev, guest]);
    assignPlayer(teamKey, guest);
    setGuestInputs((prev) => ({ ...prev, [teamKey]: '' }));
  };

  const handleStart = () => {
    if (!lineups.teamA.length || !lineups.teamB.length) return;
    const combinedPoolMap = new Map<string, PlayerIdentity>();
    [...lineups.teamA, ...lineups.teamB].forEach((player) => {
      combinedPoolMap.set(player.id, player);
    });

    startGame({
      type: 'friendly',
      teamAName,
      teamBName,
      innings,
      playerPool: Array.from(combinedPoolMap.values()),
      teamAPlayers: lineups.teamA,
      teamBPlayers: lineups.teamB,
    });
    navigation.navigate('LiveGame');
  };

  const currentIndex = stepOrder.indexOf(step);
  const goBack = () => {
    if (currentIndex === 0) {
      navigation.goBack();
      return;
    }
    setStep(stepOrder[currentIndex - 1]);
  };
  const goNext = () => {
    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1]);
    }
  };

  const canContinue = () => {
    switch (step) {
      case 'names':
        return Boolean(teamAName.trim() && teamBName.trim());
      case 'teamA':
        return lineups.teamA.length > 0;
      case 'teamB':
        return lineups.teamB.length > 0;
      case 'confirm':
        return lineups.teamA.length > 0 && lineups.teamB.length > 0;
      default:
        return false;
    }
  };

  const directory = useMemo(
    () => [...allPlayers, ...guestPlayers],
    [allPlayers, guestPlayers],
  );

  const renderLineupStep = (teamKey: TeamKey) => {
    const title = teamKey === 'teamA' ? `${teamAName} Lineup` : `${teamBName} Lineup`;
    const otherKey: TeamKey = teamKey === 'teamA' ? 'teamB' : 'teamA';
    const filteredPlayers = directory.filter((player) =>
      player.displayName.toLowerCase().includes(search[teamKey].toLowerCase()),
    );
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCopy}>
          Tap brothers or guests to add them to the batting order. Use the arrows to reorder the
          batting lineup.
        </Text>

        <View style={styles.lineupCard}>
          {lineups[teamKey].map((player, index) => (
            <View key={player.id} style={styles.lineItem}>
              <View style={styles.lineItemLeft}>
                <Text style={styles.lineNumber}>{index + 1}</Text>
                <View>
                  <Text style={styles.lineName}>{player.displayName}</Text>
                  {player.isGuest && <Text style={styles.badge}>Guest</Text>}
                </View>
              </View>
              <View style={styles.lineActions}>
                <Pressable onPress={() => movePlayer(teamKey, index, 'up')}>
                  <Text style={styles.actionIcon}>↑</Text>
                </Pressable>
                <Pressable onPress={() => movePlayer(teamKey, index, 'down')}>
                  <Text style={styles.actionIcon}>↓</Text>
                </Pressable>
                <Pressable onPress={() => removePlayer(teamKey, player.id)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {lineups[teamKey].length === 0 && (
            <Text style={styles.placeholder}>Add at least one player to continue.</Text>
          )}
        </View>

        <View style={styles.guestRow}>
          <TextInput
            style={styles.guestInput}
            placeholder="Add guest name"
            placeholderTextColor="#64748B"
            value={guestInputs[teamKey]}
            onChangeText={(text) => setGuestInputs((prev) => ({ ...prev, [teamKey]: text }))}
          />
          <Pressable style={styles.guestButton} onPress={() => handleAddGuest(teamKey)}>
            <Text style={styles.guestButtonLabel}>Add Guest</Text>
          </Pressable>
        </View>

        <Text style={styles.subheading}>Brother & Guest Directory</Text>
        <TextInput
          ref={searchInputRefs[teamKey]}
          style={styles.searchInput}
          placeholder="Search players"
          placeholderTextColor="#475569"
          value={search[teamKey]}
          onChangeText={(text) => setSearch((prev) => ({ ...prev, [teamKey]: text }))}
        />
        {!filteredPlayers.length && (
          <View style={styles.addBrotherRow}>
            <Text style={styles.addBrotherLabel}>Need to add a DU Brother?</Text>
            <View style={styles.brotherInputRow}>
              <TextInput
                style={styles.brotherInput}
                placeholder="First name"
                placeholderTextColor="#475569"
                value={newBrother.first}
                onChangeText={(text) => setNewBrother((prev) => ({ ...prev, first: text }))}
              />
              <TextInput
                style={styles.brotherInput}
                placeholder="Last name"
                placeholderTextColor="#475569"
                value={newBrother.last}
                onChangeText={(text) => setNewBrother((prev) => ({ ...prev, last: text }))}
              />
            </View>
            <Pressable
              style={[
                styles.addBrotherButton,
                (!newBrother.first.trim() || !newBrother.last.trim()) && styles.primaryButtonDisabled,
              ]}
              disabled={!newBrother.first.trim() || !newBrother.last.trim()}
              onPress={() => {
                const first = newBrother.first.trim();
                const last = newBrother.last.trim();
                if (!first || !last) return;
                const id = `bro-${first.toLowerCase()}-${last.toLowerCase()}-${Date.now()}`;
                const identity: PlayerIdentity = {
                  id,
                  brotherId: id,
                  displayName: `${first} ${last}`,
                };
                addPlayer(identity);
                setNewBrother({ first: '', last: '' });
                assignPlayer(teamKey, identity);
              }}
            >
              <Text style={styles.addBrotherButtonLabel}>Add Brother Profile</Text>
            </Pressable>
          </View>
        )}
        <Text style={styles.subheading}>Available Players</Text>
        <View style={styles.playerGrid}>
          {filteredPlayers.map((player) => {
            const inThisTeam = lineups[teamKey].some((slot) => slot.id === player.id);
            const inOtherTeam = lineups[otherKey].some((slot) => slot.id === player.id);
            return (
              <Pressable
                key={player.id}
                style={[
                  styles.playerChip,
                  inThisTeam && styles.playerChipActive,
                  inOtherTeam && styles.playerChipWarning,
                ]}
                onPress={() => assignPlayer(teamKey, player)}
              >
                <Text style={styles.playerChipLabel}>{player.displayName}</Text>
                <Text style={styles.playerChipMeta}>
                  {player.brotherId ? 'Brother' : 'Guest'}
                  {inOtherTeam ? ' • on Opponent' : ''}
                </Text>
              </Pressable>
            );
          })}
          {!filteredPlayers.length && (
            <Text style={styles.placeholder}>No players match that search.</Text>
          )}
        </View>
      </View>
    );
  };

  const renderConfirmStep = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Confirm Lineups</Text>
      <Text style={styles.sectionCopy}>
        Review both teams before launching the live scorebook. You can always step back to edit.
      </Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{teamAName}</Text>
          {lineups.teamA.map((player, index) => (
            <Text key={player.id} style={styles.summaryRow}>
              {index + 1}. {player.displayName}
            </Text>
          ))}
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{teamBName}</Text>
          {lineups.teamB.map((player, index) => (
            <Text key={player.id} style={styles.summaryRow}>
              {index + 1}. {player.displayName}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    if (step === 'names') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Names</Text>
          <Text style={styles.sectionCopy}>
            Label each squad and choose the number of innings you plan to play.
          </Text>
          <TextInput
            style={styles.input}
            value={teamAName}
            onChangeText={setTeamAName}
            placeholder="Visitors"
            placeholderTextColor="#475569"
          />
          <TextInput
            style={styles.input}
            value={teamBName}
            onChangeText={setTeamBName}
            placeholder="Home Team"
            placeholderTextColor="#475569"
          />
          <Text style={styles.subheading}>Planned Innings</Text>
          <View style={styles.segment}>
            {inningsOptions.map((option) => (
              <Pressable
                key={option}
                style={[styles.segmentOption, innings === option && styles.segmentSelected]}
                onPress={() => setInnings(option)}
              >
                <Text
                  style={[styles.segmentLabel, innings === option && styles.segmentLabelActive]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }
    if (step === 'teamA') return renderLineupStep('teamA');
    if (step === 'teamB') return renderLineupStep('teamB');
    return renderConfirmStep();
  };

  const ctaLabel = step === 'confirm' ? 'Start Game' : 'Continue';

  const handlePrimaryAction = () => {
    if (step === 'confirm') {
      handleStart();
      return;
    }
    goNext();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.progressRow}>
          {stepOrder.map((item) => (
            <View key={item} style={styles.progressItem}>
              <View style={[styles.progressDot, step === item && styles.progressDotActive]} />
              <Text style={[styles.progressLabel, step === item && styles.progressLabelActive]}>
                {item === 'names'
                  ? 'Team Names'
                  : item === 'teamA'
                    ? 'Team 1 Lineup'
                    : item === 'teamB'
                      ? 'Team 2 Lineup'
                      : 'Confirm'}
              </Text>
            </View>
          ))}
        </View>

        {renderCurrentStep()}

          <View style={styles.controls}>
            <Pressable style={styles.secondaryButton} onPress={goBack}>
              <Text style={styles.secondaryLabel}>
                {currentIndex === 0 ? 'Back to Modes' : 'Back'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, !canContinue() && styles.primaryButtonDisabled]}
              disabled={!canContinue()}
              onPress={handlePrimaryAction}
            >
              <Text style={styles.primaryLabel}>{ctaLabel}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1F2937',
  },
  progressDotActive: {
    backgroundColor: '#38BDF8',
  },
  progressLabel: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionCopy: {
    color: '#94A3B8',
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  subheading: {
    color: '#CBD5F5',
    fontWeight: '600',
    marginTop: 8,
  },
  searchInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
  },
  addBrotherRow: {
    backgroundColor: '#0B1223',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    gap: 10,
  },
  addBrotherLabel: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  brotherInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  brotherInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
  },
  addBrotherButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  addBrotherButtonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#1D4ED8',
  },
  segmentLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#F8FAFC',
  },
  lineupCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    gap: 10,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  lineItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineNumber: {
    width: 24,
    textAlign: 'center',
    color: '#38BDF8',
    fontWeight: '600',
  },
  lineName: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  lineActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  actionIcon: {
    color: '#94A3B8',
    fontSize: 16,
  },
  remove: {
    color: '#F87171',
    fontWeight: '600',
  },
  badge: {
    color: '#FDE047',
    fontSize: 12,
  },
  placeholder: {
    color: '#64748B',
    fontStyle: 'italic',
  },
  guestRow: {
    flexDirection: 'row',
    gap: 8,
  },
  guestInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  guestButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  guestButtonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#020617',
    gap: 4,
  },
  playerChipActive: {
    borderColor: '#22D3EE',
  },
  playerChipWarning: {
    borderColor: '#F59E0B',
  },
  playerChipLabel: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  playerChipMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  summaryCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    gap: 6,
  },
  summaryTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  summaryRow: {
    color: '#E2E8F0',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: '#fff',
    fontWeight: '700',
  },
});
