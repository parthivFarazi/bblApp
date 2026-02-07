import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { IndividualStatsRow } from '@/types';

const STAT_COLUMN_WIDTH = 70;

const playerStatColumns: Array<{
  key: keyof IndividualStatsRow['stats'];
  label: string;
  short: string;
  precision?: number;
  width: number;
}> = [
  { key: 'gamesPlayed', label: 'Games Played', short: 'GP', width: STAT_COLUMN_WIDTH },
  { key: 'atBats', label: 'At Bats', short: 'AB', width: STAT_COLUMN_WIDTH },
  { key: 'hits', label: 'Hits', short: 'H', width: STAT_COLUMN_WIDTH },
  { key: 'singles', label: 'Singles', short: '1B', width: STAT_COLUMN_WIDTH },
  { key: 'doubles', label: 'Doubles', short: '2B', width: STAT_COLUMN_WIDTH },
  { key: 'triples', label: 'Triples', short: '3B', width: STAT_COLUMN_WIDTH },
  { key: 'homeruns', label: 'Homeruns', short: 'HR', width: STAT_COLUMN_WIDTH },
  { key: 'battingAverage', label: 'Batting Average', short: 'AVG', precision: 3, width: STAT_COLUMN_WIDTH },
  { key: 'slugging', label: 'Slugging', short: 'SLG', precision: 3, width: STAT_COLUMN_WIDTH },
  { key: 'rbi', label: 'Runs Batted In', short: 'RBI', width: STAT_COLUMN_WIDTH },
  { key: 'strikeouts', label: 'Strikeouts', short: 'K', width: STAT_COLUMN_WIDTH },
  { key: 'catches', label: 'Catches', short: 'C', width: STAT_COLUMN_WIDTH },
  { key: 'errors', label: 'Errors', short: 'E', width: STAT_COLUMN_WIDTH },
  { key: 'stealsAttempted', label: 'Steals Attempted', short: 'SA', width: STAT_COLUMN_WIDTH },
  { key: 'stealsWon', label: 'Steals Won', short: 'SW', width: STAT_COLUMN_WIDTH },
  { key: 'stealsLost', label: 'Steals Lost', short: 'SL', width: STAT_COLUMN_WIDTH },
  { key: 'basesStolen', label: 'Bases Stolen', short: 'BS', width: STAT_COLUMN_WIDTH },
  { key: 'basesDefended', label: 'Bases Defended', short: 'BD', width: STAT_COLUMN_WIDTH },
  { key: 'basesDefendedSuccessful', label: 'Bases Defended (Successful)', short: 'BD+', width: STAT_COLUMN_WIDTH },
];

const formatStatValue = (value: number | undefined, precision?: number) => {
  const numericValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  if (precision !== undefined) {
    return numericValue.toFixed(precision);
  }
  return numericValue.toString();
};

type PlayerStatsTableProps = {
  rows: IndividualStatsRow[];
  sortBy: keyof IndividualStatsRow['stats'];
  onSort?: (key: keyof IndividualStatsRow['stats']) => void;
};

export const PlayerStatsTable = ({ rows, sortBy, onSort }: PlayerStatsTableProps) => (
  <View style={styles.tableWrapper}>
    <View style={styles.fixedColumn}>
      <View style={[styles.headerRow, styles.fixedHeader]}>
        <Text style={[styles.cell, styles.playerCell]}>Player</Text>
      </View>
      {rows.map((row, index) => (
        <View
          key={row.playerId}
          style={[styles.row, styles.fixedRow, index % 2 === 0 && styles.rowAlt]}
        >
          <Text style={[styles.cell, styles.playerCell]}>{row.displayName}</Text>
        </View>
      ))}
    </View>
    <ScrollView
      horizontal
      style={styles.tableScroll}
      contentContainerStyle={styles.tableContent}
      showsHorizontalScrollIndicator
    >
      <View style={styles.scrollableTable}>
        <View style={styles.headerRow}>
          {playerStatColumns.map((column, colIndex) => (
            <Pressable
              key={column.key}
              style={[
                styles.cell,
                styles.numericCell,
                { width: column.width },
                sortBy === column.key && styles.activeHeader,
                colIndex === playerStatColumns.length - 1 && styles.lastCell,
              ]}
              onPress={onSort ? () => onSort(column.key) : undefined}
            >
              <Text style={styles.headerLabel}>{column.short}</Text>
            </Pressable>
          ))}
        </View>
        {rows.map((row, index) => (
          <View key={row.playerId} style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
            {playerStatColumns.map((column, colIndex) => (
              <Text
                key={column.key}
                style={[
                  styles.cell,
                  styles.numericCell,
                  { width: column.width },
                  colIndex === playerStatColumns.length - 1 && styles.lastCell,
                ]}
              >
                {formatStatValue(row.stats[column.key], column.precision)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  tableWrapper: {
    flexDirection: 'row',
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    overflow: 'hidden',
  },
  fixedColumn: {
    backgroundColor: '#0B1220',
    borderRightWidth: 2,
    borderRightColor: '#1F2937',
    zIndex: 10,
  },
  fixedHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  fixedRow: {
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  tableScroll: {
    flex: 1,
  },
  tableContent: {
    flexGrow: 1,
  },
  scrollableTable: {
    backgroundColor: '#0B1220',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  rowAlt: {
    backgroundColor: '#0D1527',
  },
  cell: {
    minWidth: 60,
    height: 48,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: '#E2E8F0',
    fontSize: 12,
    borderRightWidth: 1,
    borderRightColor: '#1F2937',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
    flexGrow: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numericCell: {
    textAlign: 'right',
    paddingRight: 12,
    paddingLeft: 8,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  playerCell: {
    width: 160,
    height: 48,
    paddingLeft: 14,
    paddingRight: 10,
    textAlign: 'left',
    fontWeight: '700',
    borderRightWidth: 0,
  },
  headerLabel: {
    color: '#CBD5E1',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  activeHeader: {
    backgroundColor: '#1E3A8A',
  },
});
