import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { LiveGameStackParamList } from '@/navigation/LiveGameNavigator';
import { useGameStore } from '@/store/gameStore';
import { GameHalf, LiveGameState } from '@/types';
import { getCurrentBatter } from '@/utils/baseball';

type Props = NativeStackScreenProps<LiveGameStackParamList, 'LiveGame'>;

const halfIcon = (half: GameHalf) => (half === 'top' ? '▲' : '▼');

type DefenderAction =
  | { type: 'error' }
  | { type: 'caught_out' }
  | { type: 'steal_success' }
  | { type: 'steal_fail' };

export const LiveGameScreen = ({ navigation }: Props) => {
  const live = useGameStore((state) => state.live);
  const logHit = useGameStore((state) => state.logHit);
  const logStrike = useGameStore((state) => state.logStrike);
  const logError = useGameStore((state) => state.logError);
  const logCaughtOut = useGameStore((state) => state.logCaughtOut);
  const logSteal = useGameStore((state) => state.logSteal);
  const completeGame = useGameStore((state) => state.completeGame);
  const [defenderPrompt, setDefenderPrompt] = useState<DefenderAction | null>(null);

  const canSteal = useMemo(() => {
    if (!live) return false;
    const { bases } = live;
    return Boolean(bases.first || bases.second || bases.third);
  }, [live]);

  const runnerId = live ? live.bases.third ?? live.bases.second ?? live.bases.first : null;
  const defenders = live ? live.lineups[live.defenseTeamId]?.lineup ?? [] : [];
  const offenseLineup = live ? live.lineups[live.offenseTeamId] : undefined;
  const currentBatter = offenseLineup ? getCurrentBatter(offenseLineup) : undefined;

  const playerLookup = useMemo(() => {
    const map: Record<string, string> = {};
    if (!live) return map;
    Object.values(live.lineups).forEach((team) => {
      team.lineup.forEach((slot) => {
        map[slot.playerId] = slot.identity.displayName;
      });
    });
    return map;
  }, [live]);

  if (!live) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No active game</Text>
          <Text style={styles.emptyCopy}>
            Create a lineup from the setup screen before launching the live scorebook.
          </Text>
          <Pressable style={styles.cta} onPress={() => navigation.replace('GameMode')}>
            <Text style={styles.ctaLabel}>Back to Setup</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const battingTeam = live.teamLabels[live.offenseTeamId];

  const handleComplete = () => {
    completeGame();
    navigation.navigate('Summary');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
        <View style={styles.headingBox}>
          <Text style={styles.badge}>Inning {live.inning}</Text>
          <Text style={styles.heading} numberOfLines={1} ellipsizeMode="tail">
            {halfIcon(live.half)} {battingTeam}
          </Text>
        </View>
          <View style={styles.counters}>
            <Counter label="Strikes" value={live.strikes} />
            <Counter label="Outs" value={live.outs} />
          </View>
        </View>

        <Scoreboard live={live} batterName={currentBatter?.identity.displayName} />
        <Bases bases={live.bases} playerLookup={playerLookup} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Offense Controls</Text>
          <View style={styles.grid}>
            {['single', 'double', 'triple', 'homerun'].map((type) => (
              <Pressable key={type} style={styles.action} onPress={() => logHit(type as any)}>
                <Text style={styles.actionLabel}>{type.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.grid}>
            <Pressable style={styles.actionSecondary} onPress={logStrike}>
              <Text style={styles.actionLabel}>STRIKE</Text>
            </Pressable>
            <Pressable
              style={[styles.actionSecondary, !defenders.length && styles.disabled]}
              disabled={!defenders.length}
              onPress={() => setDefenderPrompt({ type: 'error' })}
            >
              <Text style={styles.actionLabel}>ERROR</Text>
            </Pressable>
            <Pressable
              style={[styles.actionSecondary, !defenders.length && styles.disabled]}
              disabled={!defenders.length}
              onPress={() => setDefenderPrompt({ type: 'caught_out' })}
            >
              <Text style={styles.actionLabel}>CAUGHT OUT</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            <Pressable
              style={[
                styles.actionSecondary,
                (!canSteal || !runnerId || !defenders.length) && styles.disabled,
              ]}
              disabled={!canSteal || !runnerId || !defenders.length}
              onPress={() => setDefenderPrompt({ type: 'steal_success' })}
            >
              <Text style={styles.actionLabel}>STEAL +</Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionSecondary,
                (!canSteal || !runnerId || !defenders.length) && styles.disabled,
              ]}
              disabled={!canSteal || !runnerId || !defenders.length}
              onPress={() => setDefenderPrompt({ type: 'steal_fail' })}
            >
              <Text style={styles.actionLabel}>STEAL ✕</Text>
            </Pressable>
            <Pressable
              style={styles.complete}
              onPress={handleComplete}
            >
              <Text style={styles.completeLabel}>End Game</Text>
            </Pressable>
          </View>
        </View>
        <DefenderPicker
          visible={Boolean(defenderPrompt)}
          defenders={defenders}
          onClose={() => setDefenderPrompt(null)}
          onSelect={(defenderId) => {
            if (!defenderPrompt) return;
            if (defenderPrompt.type === 'error') {
              logError(defenderId);
            } else if (defenderPrompt.type === 'caught_out') {
              logCaughtOut(defenderId);
            } else if (defenderPrompt.type === 'steal_success') {
              if (runnerId) {
                logSteal(runnerId, defenderId, true);
              }
            } else if (defenderPrompt.type === 'steal_fail') {
              if (runnerId) {
                logSteal(runnerId, defenderId, false);
              }
            }
            setDefenderPrompt(null);
          }}
          action={defenderPrompt}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const Counter = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.counterBox}>
    <Text style={styles.counterLabel}>{label}</Text>
    <View style={styles.dotRow}>
      {[0, 1].map((index) => (
        <View
          key={index}
          style={[styles.dot, value > index && styles.dotActive]}
        />
      ))}
    </View>
  </View>
);

const Scoreboard = ({
  live,
  batterName,
}: {
  live?: LiveGameState;
  batterName?: string;
}) => {
  if (!live) return null;
  const entries = Object.entries(live.teamLabels);
  return (
    <View style={styles.card}>
      {entries.map(([teamId, label]) => (
        <View key={teamId} style={styles.scoreRow}>
          <View>
            <Text style={styles.scoreTeam}>{label}</Text>
            <Text style={styles.scoreMeta}>
              Hits {live.scoreboard[teamId].hits} • Errors {live.scoreboard[teamId].errors}
            </Text>
          </View>
          <Text style={styles.scoreValue}>{live.scoreboard[teamId].runs}</Text>
        </View>
      ))}
      <View style={styles.batterRow}>
        <View>
          <Text style={styles.batterLabel}>At Bat</Text>
          <Text style={styles.batterName}>{batterName ?? '—'}</Text>
        </View>
      </View>
    </View>
  );
};

const Bases = ({
  bases,
  playerLookup,
}: {
  bases: { first: string | null; second: string | null; third: string | null };
  playerLookup: Record<string, string>;
}) => (
  <View style={styles.bases}>
    <Base label="2B" occupant={bases.second ? playerLookup[bases.second] : undefined} />
    <View style={styles.baseRow}>
      <Base label="3B" occupant={bases.third ? playerLookup[bases.third] : undefined} />
      <Base label="1B" occupant={bases.first ? playerLookup[bases.first] : undefined} />
    </View>
  </View>
);

const Base = ({ label, occupant }: { label: string; occupant?: string }) => (
  <View style={[styles.base, occupant && styles.baseActive]}>
    <Text style={styles.baseLabel}>{label}</Text>
    {occupant && <Text style={styles.baseOccupant}>{occupant}</Text>}
  </View>
);

const DefenderPicker = ({
  visible,
  defenders,
  onClose,
  onSelect,
  action,
}: {
  visible: boolean;
  defenders: { playerId: string; identity: { displayName: string } }[];
  onClose: () => void;
  onSelect: (defenderId: string) => void;
  action: DefenderAction | null;
}) => {
  const titleMap: Record<DefenderAction['type'], string> = {
    error: 'Who committed the error?',
    caught_out: 'Who made the catch?',
    steal_success: 'Defender on successful steal',
    steal_fail: 'Defender on failed steal',
  };
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {action ? titleMap[action.type] : 'Choose Defender'}
          </Text>
          <ScrollView style={{ maxHeight: 280 }}>
            {defenders.map((slot) => (
              <Pressable
                key={slot.playerId}
                style={styles.modalOption}
                onPress={() => onSelect(slot.playerId)}
              >
                <Text style={styles.modalOptionLabel}>{slot.identity.displayName}</Text>
              </Pressable>
            ))}
            {!defenders.length && (
              <Text style={styles.placeholder}>No defenders available for selection.</Text>
            )}
          </ScrollView>
          <Pressable style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    padding: 20,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headingBox: {
    flex: 1,
  },
  badge: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  heading: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
    flexShrink: 1,
  },
  counters: {
    flexDirection: 'row',
    gap: 16,
  },
  counterLabel: {
    color: '#CBD5F5',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  counterBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1F2937',
  },
  dotActive: {
    backgroundColor: '#34D399',
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreTeam: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FDE047',
  },
  batterRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingTop: 12,
  },
  batterLabel: {
    color: '#94A3B8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  batterName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  bases: {
    alignItems: 'center',
    gap: 12,
  },
  baseRow: {
    flexDirection: 'row',
    gap: 60,
  },
  base: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseActive: {
    borderColor: '#34D399',
  },
  baseLabel: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  baseOccupant: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    color: '#CBD5F5',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  action: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
  },
  actionSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#1F2937',
    alignItems: 'center',
  },
  actionLabel: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.4,
  },
  complete: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  completeLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptyCopy: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  cta: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  modalOptionLabel: {
    color: '#E2E8F0',
    fontSize: 16,
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCloseLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  placeholder: {
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
});
