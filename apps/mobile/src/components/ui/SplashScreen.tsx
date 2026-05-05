import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { NeonLines } from './NeonLines';
import { Text } from './Text';
import { Colors, Typography } from '@/constants/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dscarLogo = require('../../../assets/dscar-logo.png') as number;

export function SplashScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <NeonLines />
      <View style={styles.content}>
        <Image source={dscarLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.powered}>PADDOCK SOLUTIONS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 80,
    tintColor: '#ffffff',
  },
  powered: {
    ...Typography.labelMono,
    color: 'rgba(255,255,255,0.15)',
    position: 'absolute',
    bottom: 40,
  },
});
