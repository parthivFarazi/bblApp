import { StyleSheet, View } from 'react-native';

type Props = {
  contentHeight: number;
  containerHeight: number;
  offsetY: number;
};

export const PersistentScrollbar = ({ contentHeight, containerHeight, offsetY }: Props) => {
  if (contentHeight <= containerHeight + 4) return null;
  const availableHeight = Math.max(1, containerHeight);
  const thumbHeight = Math.max(28, (availableHeight * containerHeight) / contentHeight);
  const maxThumbTop = Math.max(0, availableHeight - thumbHeight);
  const maxOffset = Math.max(1, contentHeight - containerHeight);
  const thumbTop = Math.min(maxThumbTop, Math.max(0, (offsetY / maxOffset) * maxThumbTop));

  return (
    <View pointerEvents="none" style={styles.track}>
      <View
        style={[
          styles.thumb,
          { height: thumbHeight, transform: [{ translateY: thumbTop }] },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 999,
    backgroundColor: '#0E2046',
    opacity: 0.9,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 999,
    backgroundColor: '#CFB53B',
  },
});
