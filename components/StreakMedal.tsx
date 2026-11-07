import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getStreakTier, STREAK_META, type StreakTier } from '@/lib/flipStreak';

// The Flip a Record streak as a coin that comes alive as the run grows.
// Shared by the Flip a Record screen and My Stats so they always match.
//
// Every tier moves, and each one moves in its own way:
//   1 Ember Run           flame flickers, sparks drift up
//   2 Vinyl Run           the record spins
//   3 Discovery Streak    compass needle swings, a ring turns
//   4 Collector Run       star twinkles, two rings, one orbiting spark
//   5 Digging Streak      diamond glints, faster glow, two sparks
//   6 Legendary Collector trophy bobs, brightest glow, three sparks
// No streak is a dim, still coin.
//
// Everything runs on the native driver.

// Darken a #rrggbb colour for the coin's lower edge.
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

const HALF = new Animated.Value(0.5);

const loop = (anim: Animated.Value, steps: [number, number][], easing = Easing.inOut(Easing.sin)) =>
  Animated.loop(Animated.sequence(steps.map(([toValue, duration]) =>
    Animated.timing(anim, { toValue, duration, easing, useNativeDriver: true }))));

export function StreakMedal({ streak, size = 54, dimColor = '#6B4C35' }: {
  streak: number;
  size?: number;
  /** Coin colour with no streak. */
  dimColor?: string;
}) {
  const tier = getStreakTier(streak);
  const meta = STREAK_META[tier];
  const color = tier === 0 ? dimColor : meta.color;

  const glow  = useRef(new Animated.Value(0)).current;  // 0–1 pulse
  const icon  = useRef(new Animated.Value(0)).current;  // per-tier icon motion
  const spin  = useRef(new Animated.Value(0)).current;  // rings + orbit, 0–1 per turn
  const spark = useRef(new Animated.Value(0)).current;  // Ember sparks rising, 0–1

  useEffect(() => {
    glow.setValue(0); icon.setValue(0); spin.setValue(0); spark.setValue(0);
    if (tier === 0) return;
    const anims: Animated.CompositeAnimation[] = [];
    const pulse = tier >= 5 ? 800 : tier >= 3 ? 1200 : 1700;
    anims.push(loop(glow, [[1, pulse], [0, pulse]]));

    switch (tier) {
      case 1: // irregular flicker
        anims.push(loop(icon, [[1, 140], [0.35, 110], [0.85, 160], [0.1, 130], [0.7, 120], [0, 180]], Easing.linear));
        anims.push(Animated.loop(Animated.timing(spark, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })));
        break;
      case 2: // a record on the platter
        anims.push(Animated.loop(Animated.timing(icon, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true })));
        break;
      case 3: // needle settling north
        anims.push(loop(icon, [[1, 700], [-1, 1100], [0.4, 600], [0, 500]]));
        break;
      case 4: case 5: // twinkle / glint
        anims.push(loop(icon, [[1, tier === 5 ? 350 : 500], [0, tier === 5 ? 350 : 500], [0, tier === 5 ? 900 : 1400]]));
        break;
      case 6: // trophy lifted
        anims.push(loop(icon, [[1, 900], [0, 900]]));
        break;
    }
    if (tier >= 3) {
      anims.push(Animated.loop(Animated.timing(spin, { toValue: 1, duration: Math.max(3500, 10000 - tier * 1100), easing: Easing.linear, useNativeDriver: true })));
    }
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [tier]);

  const ring1 = size + 12;
  const ring2 = size + 24;
  const box   = size + 28;

  // Icon motion for this tier.
  const iconTransform: any[] = (() => {
    switch (tier) {
      case 1: return [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.14] }) },
                      { rotate: icon.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '5deg'] }) }];
      case 2: return [{ rotate: icon.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }];
      case 3: return [{ rotate: icon.interpolate({ inputRange: [-1, 1], outputRange: ['-28deg', '28deg'] }) }];
      case 4: case 5: return [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [1, tier === 5 ? 1.22 : 1.16] }) }];
      case 6: return [{ translateY: icon.interpolate({ inputRange: [0, 1], outputRange: [1.5, -2.5] }) },
                      { scale: icon.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }];
      default: return [];
    }
  })();

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, tier >= 5 ? 0.62 : tier === 1 ? 0.5 : 0.42] });
  const glowScale   = glow.interpolate({ inputRange: [0, 1], outputRange: [0.95, tier >= 5 ? 1.45 : 1.3] });
  const ringOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });
  const rot  = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rot2 = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const orbiters = tier === 4 ? 1 : tier === 5 ? 2 : tier === 6 ? 3 : 0;

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {/* Glow */}
      {tier > 0 && (
        <Animated.View style={[st.abs, {
          width: size, height: size, borderRadius: size / 2, backgroundColor: color,
          opacity: glowOpacity, transform: [{ scale: glowScale }],
        }]} />
      )}

      {/* Vinyl grooves sit still behind the spinning record */}
      {tier === 2 && (
        <View style={[st.abs, { width: ring1, height: ring1, borderRadius: ring1 / 2, borderWidth: 1, borderColor: color + '70' }]} />
      )}

      {/* Rings */}
      {tier >= 3 && (
        <Animated.View style={[st.abs, {
          width: ring1, height: ring1, borderRadius: ring1 / 2, borderWidth: 1.5, borderStyle: 'dashed',
          borderColor: color + 'AA', opacity: ringOpacity, transform: [{ rotate: rot }],
        }]} />
      )}
      {tier >= 4 && (
        <Animated.View style={[st.abs, {
          width: ring2, height: ring2, borderRadius: ring2 / 2, borderWidth: 1, borderStyle: 'dashed',
          borderColor: color + '66', opacity: ringOpacity, transform: [{ rotate: rot2 }],
        }]} />
      )}

      {/* Sparks orbiting on the outer ring */}
      {Array.from({ length: orbiters }, (_, i) => (
        <Animated.View key={i} style={[st.abs, {
          width: ring2, height: ring2,
          transform: [{ rotate: rot }, { rotate: `${(360 / orbiters) * i}deg` }],
        }]}>
          <View style={{ position: 'absolute', top: -3, left: ring2 / 2 - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF4D0', shadowColor: color, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
        </Animated.View>
      ))}

      {/* Ember sparks drifting up */}
      {tier === 1 && [0, 1].map(i => {
        const t = i === 0 ? spark : Animated.modulo(Animated.add(spark, HALF), 1);
        return (
          <Animated.View key={i} style={[st.abs, {
            width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFB066',
            opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: i === 0 ? -size * 0.22 : size * 0.2 },
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.25, -size * 0.75] }) },
            ],
          }]} />
        );
      })}

      {/* The coin */}
      <LinearGradient
        colors={tier === 0 ? [color + '40', color + '20'] : [shade(color, 1.18), color, shade(color, 0.62)]}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={{
          width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1.5, borderColor: tier === 0 ? color + '55' : shade(color, 1.35),
        }}>
        {/* A mark on the record so the spin reads */}
        {tier === 2 && (
          <Animated.View style={[st.abs, { width: size - 12, height: size - 12, transform: iconTransform }]}>
            <View style={{ position: 'absolute', top: 3, left: (size - 12) / 2 - 2.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF4D0', opacity: 0.85 }} />
          </Animated.View>
        )}
        {/* Inner rim */}
        <View style={[st.abs, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2, borderWidth: 1, borderColor: tier === 0 ? 'transparent' : '#00000030' }]} />
        <Animated.View style={{ transform: iconTransform }}>
          <FontAwesome name={meta.icon as any} size={Math.round(size * 0.42)} color={tier === 0 ? color : '#2A1608'} />
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

export type { StreakTier };

const st = StyleSheet.create({
  abs: { position: 'absolute' },
});
