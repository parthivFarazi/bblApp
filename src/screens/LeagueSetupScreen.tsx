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
import { useLeagueStore } from '@/store/leagueStore';
import { useTeamStore } from '@/store/teamStore';
import { PlayerIdentity } from '@/types';

type Step = 'names' | 'teamA' | 'teamB' | 'confirm';
type TeamKey = 'teamA' | 'teamB';

const inningsOptions = [3, 5, 7, 9];
const stepOrder: Step[] = ['names', 'teamA', 'teamB', 'confirm'];

const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

const toLeagueMembers = (teamId: string, players: PlayerIdentity[]) =>
  players.map((player, index) => ({
    id: `${teamId}-${player.id}-${index}`,
    teamId,
    brotherId: player.brotherId ?? player.id,
    battingOrder: index + 1,
    isActive: true,
    displayName: player.displayName,
  }));

type Props = NativeStackScreenProps<LiveGameStackParamList, 'LeagueSetup'>;

export const LeagueSetupScreen: FC<Props> = ({ navigation }) => {
  const startGame = useGameStore((state) => state.startGame);
  const playerDirectory = usePlayerStore((state) => state.players);
  const addPlayer = usePlayerStore((state) => state.addPlayer);
  const savedLeagues = useLeagueStore((state) => state.leagues);
  const addLeaguePreset = useLeagueStore((state) => state.addLeague);
  const ensureTeamProfile = useTeamStore((state) => state.ensureTeam);
  const [step, setStep] = useState<Step>('names');
  const [teamAName, setTeamAName] = useState('Home Team');
  const [teamBName, setTeamBName] = useState('Away Team');
  const [leagueName, setLeagueName] = useState('Official League');
  const [leagueYear, setLeagueYear] = useState(`${new Date().getFullYear()}`);
  const [innings, setInnings] = useState(7);
  const [lineups, setLineups] = useState<{ teamA: PlayerIdentity[]; teamB: PlayerIdentity[] }>(() => {
    const players = Object.values(playerDirectory);
    return {
      teamA: players.slice(0, 4),
      teamB: players.slice(4, 8) || players.slice(0, 4),
    };
  });
  const [search, setSearch] = useState<{ teamA: string; teamB: string }>({
    teamA: '',
    teamB: '',
  });
  const [newBrother, setNewBrother] = useState<{ first: string; last: string }>({
    first: '',
    last: '',
  });
  const searchInputRefs = {
    teamA: useRef<TextInput>(null),
    teamB: useRef<TextInput>(null),
  };

  const allPlayers = useMemo(() => Object.values(playerDirectory), [playerDirectory]);

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
      return {
        ...next,
        [teamKey]: [...next[teamKey], player],
        [otherKey]: next[otherKey].filter((slot) => slot.id !== player.id),
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
      return { ...prev, [teamKey]: roster };
    });
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

  const directory = useMemo(() => [...allPlayers], [allPlayers]);

  const renderLineupStep = (teamKey: TeamKey) => {
    const title =
      teamKey === 'teamA' ? `${teamAName} Lineup` : `${teamBName} Lineup`;
    const otherKey: TeamKey = teamKey === 'teamA' ? 'teamB' : 'teamA';
    const filteredPlayers = directory.filter((player) =>
      player.displayName.toLowerCase().includes(search[teamKey].toLowerCase()),
    );
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCopy}>
          Select the batting order for this league matchup. Players can be reused across teams if necessary.
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
          {!lineups[teamKey].length && (
            <Text style={styles.placeholder}>Add at least one player to continue.</Text>
          )}
        </View>

        <Text style={styles.subheading}>Brother Directory</Text>
        <TextInput
          ref={searchInputRefs[teamKey]}
          style={styles.searchInput}
          placeholder="Search brothers"
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
                  Brother
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
      <Text style={styles.sectionTitle}>Confirm League Lineups</Text>
      <Text style={styles.sectionCopy}>
        Review both teams before starting the official league game.
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
          <Text style={styles.sectionTitle}>League Details</Text>
          <Text style={styles.sectionCopy}>
            Name the league matchup and customize both teams before launching the scorebook.
          </Text>
          <TextInput
            style={styles.input}
            value={leagueName}
            onChangeText={setLeagueName}
            placeholder="League name"
            placeholderTextColor="#475569"
          />
          <TextInput
            style={styles.input}
            value={leagueYear}
            onChangeText={setLeagueYear}
            placeholder="Year"
            placeholderTextColor="#475569"
            keyboardType="number-pad"
          />
          {savedLeagues.length > 0 && (
            <View style={styles.savedLeagueList}>
              <Text style={styles.subheading}>Saved Leagues</Text>
              {savedLeagues.map((league) => (
                <Pressable
                  key={league.id}
                  style={styles.leagueChip}
                  onPress={() => {
                    setLeagueName(league.name);
                    setLeagueYear(String(league.year));
                  }}
                >
                  <Text style={styles.leagueChipLabel}>
                    {league.name} ({league.year})
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable
            style={styles.outlineButton}
            onPress={() => {
              const cleanedName = leagueName.trim();
              if (!cleanedName) {
                return;
              }
              const yearNumber = Number(leagueYear) || new Date().getFullYear();
              const id = `${slugify(cleanedName)}-${yearNumber}`;
              addLeaguePreset({ id, name: cleanedName, year: yearNumber });
            }}
          >
            <Text style={styles.outlineButtonLabel}>Save League Preset</Text>
          </Pressable>
          <Text style={styles.subheading}>Home Team Name</Text>
          <TextInput
            style={styles.input}
            value={teamAName}
            onChangeText={setTeamAName}
            placeholder="Home Team"
            placeholderTextColor="#475569"
          />
          <Text style={styles.subheading}>Away Team Name</Text>
          <TextInput
            style={styles.input}
            value={teamBName}
            onChangeText={setTeamBName}
            placeholder="Away Team"
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

  const handleStart = () => {
    if (!lineups.teamA.length || !lineups.teamB.length) return;
    const cleanedLeagueName = leagueName.trim();
    const leagueId =
      cleanedLeagueName.length > 0
        ? `${slugify(cleanedLeagueName)}-${leagueYear || new Date().getFullYear()}`
        : undefined;
    const homeTeamId = ensureTeamProfile(teamAName, leagueId);
    const awayTeamId = ensureTeamProfile(teamBName, leagueId);
    const members = [
      ...toLeagueMembers(homeTeamId, lineups.teamA),
      ...toLeagueMembers(awayTeamId, lineups.teamB),
    ];
    startGame({
      type: 'league',
      leagueId,
      homeTeamId,
      awayTeamId,
      homeTeamName: teamAName,
      awayTeamName: teamBName,
      innings,
      leagueTeamMembers: members,
    });
    navigation.navigate('LiveGame');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.progress}>
            {stepOrder.map((label) => (
              <View key={label} style={styles.progressItem}>
                <View
                  style={[
                    styles.progressDot,
                    step === label && styles.progressDotActive,
                  ]}
                />
                <Text
                  style={[
                    styles.progressLabel,
                    step === label && styles.progressLabelActive,
                  ]}
                >
                  {label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>

          {renderCurrentStep()}

          <View style={styles.footer}>
            <Pressable style={styles.secondaryButton} onPress={goBack}>
              <Text style={styles.secondaryButtonLabel}>Back</Text>
            </Pressable>
            {step === 'confirm' ? (
              <Pressable
                style={[
                  styles.primaryButton,
                  (!lineups.teamA.length || !lineups.teamB.length) && styles.primaryButtonDisabled,
                ]}
                disabled={!lineups.teamA.length || !lineups.teamB.length}
                onPress={handleStart}
              >
                <Text style={styles.primaryButtonLabel}>Start League Game</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryButton, !canContinue() && styles.primaryButtonDisabled]}
                disabled={!canContinue()}
                onPress={goNext}
              >
                <Text style={styles.primaryButtonLabel}>Continue</Text>
              </Pressable>
            )}
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
    padding: 24,
    gap: 20,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
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
  segment: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0B1223',
    borderRadius: 12,
    padding: 4,
  },
  segmentOption: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
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
    backgroundColor: '#0B1223',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    gap: 8,
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  lineItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineNumber: {
    width: 20,
    textAlign: 'center',
    color: '#60A5FA',
    fontWeight: '600',
  },
  lineName: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  lineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    color: '#94A3B8',
    fontSize: 18,
  },
  remove: {
    color: '#F87171',
    fontWeight: '600',
  },
  placeholder: {
    color: '#94A3B8',
    fontStyle: 'italic',
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
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    gap: 8,
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
    backgroundColor: '#0B1223',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
  },
  addBrotherButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBrotherButtonLabel: {
    color: '#02101F',
    fontWeight: '700',
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#0B1223',
  },
  playerChipActive: {
    borderColor: '#34D399',
    backgroundColor: '#062C1B',
  },
  playerChipWarning: {
    borderColor: '#F97316',
  },
  playerChipLabel: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  playerChipMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    gap: 6,
  },
  summaryTitle: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  summaryRow: {
    color: '#94A3B8',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  savedLeagueList: {
    gap: 8,
  },
  leagueChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1223',
  },
  leagueChipLabel: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  outlineButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingVertical: 10,
    alignItems: 'center',
  },
  outlineButtonLabel: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  badge: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '600',
  },
});
