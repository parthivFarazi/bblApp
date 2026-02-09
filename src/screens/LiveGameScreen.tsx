import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PagerView from 'react-native-pager-view';

import { LiveGameStackParamList } from '@/navigation/LiveGameNavigator';
import { useGameStore } from '@/store/gameStore';
import { EventType, GameEvent, GameHalf, LiveGameState } from '@/types';
import { getCurrentBatter } from '@/utils/baseball';
import { LiveStatsPanel } from './LiveStatsPanel';

type Props = NativeStackScreenProps<LiveGameStackParamList, 'LiveGame'>;

const halfIcon = (half: GameHalf) => (half === 'top' ? '▲' : '▼');

const eventLabelMap: Record<EventType, string> = {
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  homerun: 'Home Run',
  strike: 'Strike',
  error: 'Error',
  strikeout: 'Strikeout',
  caught_out: 'Caught Out',
  steal_success: 'Steal +',
  steal_fail: 'Steal ✕',
};

const formatEventSummary = (event: GameEvent, lookup: Record<string, string>) => {
  const label = eventLabelMap[event.eventType] ?? event.eventType;
  const batterName = lookup[event.batterId] ?? 'Unknown';
  const defenderName = event.defenderId ? lookup[event.defenderId] ?? 'Unknown' : undefined;
  const runnerName = event.runnerId ? lookup[event.runnerId] ?? 'Unknown' : undefined;
  let subject = batterName;

  if (event.eventType === 'error' || event.eventType === 'caught_out') {
    subject = defenderName ?? 'Unknown';
  } else if (event.eventType === 'steal_success' || event.eventType === 'steal_fail') {
    subject = runnerName ?? 'Unknown';
  }

  const extraDefender =
    defenderName && (event.eventType === 'steal_success' || event.eventType === 'steal_fail')
      ? ` (Def: ${defenderName})`
      : '';
  const halfLabel = event.half === 'top' ? 'Top' : 'Bottom';
  return `${halfLabel} ${event.inning} • ${label} - ${subject}${extraDefender}`;
};

type DefenderAction =
  | { type: 'error' }
  | { type: 'caught_out' }
  | { type: 'steal_success' }
  | { type: 'steal_fail' };

export const LiveGameScreen = ({ navigation }: Props) => {
  const live = useGameStore((state) => state.live);
  const events = useGameStore((state) => state.events);
  const logHit = useGameStore((state) => state.logHit);
  const logStrike = useGameStore((state) => state.logStrike);
  const logError = useGameStore((state) => state.logError);
  const logCaughtOut = useGameStore((state) => state.logCaughtOut);
  const logSteal = useGameStore((state) => state.logSteal);
  const undoLastAction = useGameStore((state) => state.undoLastAction);
  const canUndo = useGameStore((state) => state.undoStack.length > 0);
  const completeGame = useGameStore((state) => state.completeGame);
  const [defenderPrompt, setDefenderPrompt] = useState<DefenderAction | null>(null);
  const [eventNotice, setEventNotice] = useState<GameEvent | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEventCount = useRef(0);

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

  useEffect(() => {
    if (events.length > prevEventCount.current) {
      const latestEvent = events[events.length - 1];
      setEventNotice(latestEvent);
      setNoticeVisible(true);
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
      noticeTimer.current = setTimeout(() => {
        setNoticeVisible(false);
      }, 1500);
    } else if (events.length < prevEventCount.current) {
      setNoticeVisible(false);
      setEventNotice(null);
    }
    prevEventCount.current = events.length;
  }, [events]);

  useEffect(
    () => () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

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
      <PagerView
        style={styles.pager}
        initialPage={0}
        overdrag
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        <ScrollView key="scoring" contentContainerStyle={styles.container}>
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
            </View>

            <View style={styles.grid}>
              <Pressable
                style={[styles.actionSecondary, !canUndo && styles.disabled]}
                disabled={!canUndo}
                onPress={undoLastAction}
              >
                <Text style={styles.actionLabel}>UNDO</Text>
              </Pressable>
              <Pressable style={styles.complete} onPress={handleComplete}>
                <Text style={styles.completeLabel}>End Game</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View key="stats" style={styles.statsPage}>
          <LiveStatsPanel />
        </View>
      </PagerView>

      {/* Page indicator */}
      <View style={styles.pageIndicator}>
        <View style={[styles.pageDot, activePage === 0 && styles.pageDotActive]} />
        <View style={[styles.pageDot, activePage === 1 && styles.pageDotActive]} />
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
      {noticeVisible && eventNotice && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastCard}>
            <Text style={styles.toastTitle}>Event logged</Text>
            <Text style={styles.toastDetail}>{formatEventSummary(eventNotice, playerLookup)}</Text>
          </View>
        </View>
      )}
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
  const entries = (live.teamOrder.length
    ? live.teamOrder
    : Object.keys(live.teamLabels)
  ).map((teamId) => [teamId, live.teamLabels[teamId]] as const);
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
      <Text style={styles.scoreNote}>Away team (▲ top) bats first; home team (▼ bottom) bats second.</Text>
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
    backgroundColor: '#050D1E',
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
    alignSelf: 'flex-start',
    backgroundColor: '#0F52BA',
    color: '#F2D680',
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
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
    color: '#E0E7FF',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  counterBox: {
    backgroundColor: '#0B1834',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1D3F73',
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
    backgroundColor: '#122548',
  },
  dotActive: {
    backgroundColor: '#CFB53B',
  },
  card: {
    backgroundColor: '#0B1834',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1D3F73',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreTeam: {
    color: '#F2D680',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreMeta: {
    color: '#B6C6E7',
    fontSize: 12,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#CFB53B',
  },
  scoreNote: {
    color: '#F2D680',
    fontSize: 12,
    marginTop: 4,
  },
  batterRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingTop: 12,
  },
  batterLabel: {
    color: '#B6C6E7',
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
    backgroundColor: '#0B1834',
    borderWidth: 1,
    borderColor: '#1D3F73',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseActive: {
    borderColor: '#CFB53B',
  },
  baseLabel: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  baseOccupant: {
    color: '#E0E7FF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    color: '#F2D680',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  action: {
    flexBasis: '48%',
    minWidth: 148,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#0F52BA',
    alignItems: 'center',
  },
  actionSecondary: {
    flexBasis: '48%',
    minWidth: 148,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#0B1834',
    borderWidth: 1,
    borderColor: '#1D3F73',
    alignItems: 'center',
  },
  actionLabel: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.4,
  },
  complete: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#CFB53B',
    alignItems: 'center',
  },
  completeLabel: {
    color: '#0B1834',
    fontWeight: '800',
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
    backgroundColor: '#0F52BA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaLabel: {
    color: '#F2D680',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0B1834',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1D3F73',
  },
  modalTitle: {
    color: '#F2D680',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1D3F73',
  },
  modalOptionLabel: {
    color: '#F8FAFC',
    fontSize: 16,
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCloseLabel: {
    color: '#B6C6E7',
    fontWeight: '700',
  },
  placeholder: {
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  toastContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  toastCard: {
    backgroundColor: '#0B1834',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1D3F73',
  },
  toastTitle: {
    color: '#F2D680',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  toastDetail: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  pager: {
    flex: 1,
  },
  statsPage: {
    flex: 1,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1D3F73',
  },
  pageDotActive: {
    backgroundColor: '#CFB53B',
  },
});
