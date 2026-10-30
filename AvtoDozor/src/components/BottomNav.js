import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export const TABS = [
  { key: 'profile', label: 'Личный кабинет', icon: 'person-circle-outline', iconOn: 'person-circle' },
  { key: 'my', label: 'Мой розыск', icon: 'search-outline', iconOn: 'search' },
  { key: 'all', label: 'База розыска', icon: 'albums-outline', iconOn: 'albums' },
  { key: 'map', label: 'Карта', icon: 'map-outline', iconOn: 'map' },
  { key: 'history', label: 'История оповещений', icon: 'notifications-outline', iconOn: 'notifications' },
];

/** Нижнее меню навигации из пяти кнопок; активная выделена цветом (прототипы ТЗ). */
export default function BottomNav({ active, onChange, badge }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={[s.item, on && s.itemOn]}>
            <View>
              <Ionicons name={on ? t.iconOn : t.icon} size={22} color={on ? colors.primary : colors.muted} />
              {badge && t.key === 'history' ? <View style={s.dot} /> : null}
            </View>
            <Text style={[s.label, on && s.labelOn]} numberOfLines={2}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, paddingHorizontal: 4 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, marginHorizontal: 2, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  itemOn: { backgroundColor: colors.primarySoft, borderColor: '#B9CFF5' },
  label: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 2, lineHeight: 12 },
  labelOn: { color: colors.primary, fontWeight: '700' },
  dot: { position: 'absolute', top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
});
