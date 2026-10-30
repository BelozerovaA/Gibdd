import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertsContext';
import { Button, ErrorText, ScreenTitle } from '../components/ui';
import { colors, radius, shadow } from '../theme';

export default function ProfileScreen() {
  const { logout, session } = useAuth();
  const { connected } = useAlerts();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMe(await api.me());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const rows = me
    ? [
        ['person-outline', 'ФИО', me.full_name],
        ['calendar-outline', 'Дата рождения', me.birth_date],
        ['call-outline', 'Номер телефона', me.phone],
        ['mail-outline', 'Служебная почта', me.email],
        ['business-outline', 'Подразделение', me.department_name],
      ]
    : [];

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <ScreenTitle>Личный кабинет</ScreenTitle>
      <View style={{ paddingHorizontal: 16 }}>
        <View style={s.hero}>
          <View style={s.avatar}>
            <Ionicons name="shield-half" size={34} color="#fff" />
          </View>
          <Text style={s.position}>{me?.position || session?.position || 'Сотрудник'}</Text>
          <Text style={s.name}>{me?.full_name || session?.fullName}</Text>
          <View style={s.conn}>
            <View style={[s.dot, { backgroundColor: connected ? '#4ADE80' : '#FBBF24' }]} />
            <Text style={s.connText}>{connected ? 'Оповещения подключены' : 'Подключение к серверу…'}</Text>
          </View>
        </View>

        <ErrorText>{error}</ErrorText>
        {!me && !error ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} /> : null}

        {me ? (
          <View style={s.card}>
            {rows.map(([icon, label, value], i) => (
              <View key={label} style={[s.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.iconBox}>
                  <Ionicons name={icon} size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{label}</Text>
                  <Text style={s.value}>{value || '—'}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Button title="Выйти из аккаунта" variant="danger" icon="log-out-outline" onPress={logout} style={{ marginTop: 20 }} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: 22, padding: 22, alignItems: 'center', ...shadow },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  position: { color: '#BBD0F5', fontSize: 13, fontWeight: '600', marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 },
  name: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  conn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  connText: { color: '#fff', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: radius.l, marginTop: 14, paddingHorizontal: 14, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  label: { fontSize: 12, color: colors.muted },
  value: { fontSize: 16, color: colors.text, fontWeight: '600', marginTop: 1 },
});
