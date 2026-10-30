import React from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';

export function Button({ title, onPress, icon, variant = 'primary', disabled, loading, style, small }) {
  const v = {
    primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
    outline: { bg: '#fff', fg: colors.primary, border: colors.primary },
    danger: { bg: '#fff', fg: colors.danger, border: colors.danger },
    dangerSolid: { bg: colors.danger, fg: '#fff', border: colors.danger },
    success: { bg: colors.success, fg: '#fff', border: colors.success },
    ghost: { bg: 'transparent', fg: colors.muted, border: colors.border },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={s.btnRow}>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} style={{ marginRight: 6 }} /> : null}
          <Text style={[s.btnText, small && { fontSize: 13 }, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ScreenTitle({ children, right }) {
  return (
    <View style={s.titleRow}>
      <Text style={s.title}>{children}</Text>
      {right}
    </View>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <View style={s.error}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={s.errorText}>{children}</Text>
    </View>
  );
}

export function Empty({ icon = 'file-tray-outline', text }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={42} color={colors.border} />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

/** Диалог по центру экрана (как на прототипах ТЗ). */
export function Dialog({ visible, title, children, tone = 'default', onRequestClose }) {
  const accent = tone === 'alarm' ? colors.danger : colors.primary;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={s.backdrop}>
        <View style={[s.dialog, { borderTopColor: accent }]}>
          {title ? (
            <View style={s.dialogHead}>
              {tone === 'alarm' ? <Ionicons name="warning" size={22} color={accent} style={{ marginRight: 8 }} /> : null}
              <Text style={[s.dialogTitle, tone === 'alarm' && { color: accent }]}>{title}</Text>
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function InfoRow({ label, value, strong }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, strong && { fontWeight: '800', letterSpacing: 1 }]}>{value || '—'}</Text>
    </View>
  );
}

/** Выпадающий список (поле со стрелкой, как на рис. 4 и 9). */
export function Select({ value, options, onChange, placeholder = 'Выберите', style }) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[s.select, style]}>
        <Text style={[s.selectText, !current && { color: colors.muted }]} numberOfLines={1}>
          {current ? current.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.list}>
            <ScrollView>
              {options.length === 0 ? (
                <Text style={{ padding: 16, color: colors.muted }}>Список пуст</Text>
              ) : null}
              {options.map((o) => (
                <Pressable
                  key={String(o.value)}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={[s.listItem, o.value === value && { backgroundColor: colors.primarySoft }]}
                >
                  <Text style={[s.listText, o.value === value && { fontWeight: '700', color: colors.primary }]}>
                    {o.label}
                  </Text>
                  {o.value === value ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Таблица с горизонтальной прокруткой: столбцы по ТЗ не сокращаются, а прокручиваются. */
export function DataTable({ columns, rows, keyOf, selectedKey, onRowPress, refreshControl, empty }) {
  const width = columns.reduce((sum, c) => sum + c.width, 0);
  return (
    <View style={s.table}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <View style={{ width }}>
          <View style={s.tHead}>
            {columns.map((c) => (
              <Text key={c.key} style={[s.th, { width: c.width }]} numberOfLines={1}>
                {c.title}
              </Text>
            ))}
          </View>
          <ScrollView refreshControl={refreshControl} showsVerticalScrollIndicator={false}>
            {rows.length === 0 ? empty : null}
            {rows.map((r, i) => {
              const k = keyOf(r);
              const selected = selectedKey != null && selectedKey === k;
              return (
                <Pressable
                  key={k}
                  onPress={onRowPress ? () => onRowPress(r) : undefined}
                  style={[s.tRow, i % 2 === 1 && { backgroundColor: '#F8FAFD' }, selected && s.tRowSel]}
                >
                  {columns.map((c) => (
                    <View key={c.key} style={[s.td, { width: c.width }]}>
                      {c.render ? c.render(r) : <Text style={s.tdText} numberOfLines={2}>{String(r[c.key] ?? '—')}</Text>}
                    </View>
                  ))}
                </Pressable>
              );
            })}
            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

export function Badge({ text, tone = 'neutral' }) {
  const t = {
    neutral: [colors.bg, colors.muted],
    danger: [colors.dangerSoft, colors.danger],
    success: [colors.successSoft, colors.success],
    warn: [colors.warnSoft, '#A86A00'],
    info: [colors.primarySoft, colors.primary],
  }[tone];
  return (
    <View style={[s.badge, { backgroundColor: t[0] }]}>
      <Text style={[s.badgeText, { color: t[1] }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 46, borderRadius: radius.m, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnSmall: { minHeight: 38, paddingHorizontal: 12 },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  error: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerSoft, padding: 10, borderRadius: radius.s, marginVertical: 6 },
  errorText: { color: colors.danger, marginLeft: 8, flex: 1, fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: colors.muted, marginTop: 8, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,20,40,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: radius.l, padding: 20, borderTopWidth: 5, ...shadow },
  dialogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  dialogTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { width: 110, color: colors.muted, fontSize: 14 },
  infoValue: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  select: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.m, paddingHorizontal: 12, backgroundColor: '#fff' },
  selectText: { fontSize: 15, color: colors.text, flex: 1, marginRight: 8 },
  list: { width: '100%', maxWidth: 420, maxHeight: '60%', backgroundColor: '#fff', borderRadius: radius.l, overflow: 'hidden' },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  listText: { fontSize: 15, color: colors.text },
  table: { flex: 1, marginHorizontal: 12, backgroundColor: '#fff', borderRadius: radius.m, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tHead: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 2, borderBottomColor: colors.primary },
  th: { paddingHorizontal: 10, paddingVertical: 12, fontWeight: '800', fontSize: 13, color: colors.text },
  tRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, minHeight: 48, alignItems: 'center' },
  tRowSel: { backgroundColor: colors.primarySoft },
  td: { paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },
  tdText: { fontSize: 13, color: colors.text },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
