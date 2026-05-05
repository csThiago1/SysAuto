import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';

interface SegmentedControlProps {
  tabs: string[];
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export function SegmentedControl({ tabs, activeIndex, onTabChange }: SegmentedControlProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={tab}
          style={[styles.segment, i === activeIndex && styles.segmentActive]}
          onPress={() => onTabChange(i)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, i === activeIndex && styles.labelActive]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  labelActive: {
    color: '#ffffff',
  },
});
