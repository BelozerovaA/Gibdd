import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAlerts } from '../context/AlertsContext';
import { ErrorText, ScreenTitle } from '../components/ui';
import WantedTable, { ALL_COLUMNS } from '../components/WantedTable';
import { colors } from '../theme';

/** Рис. 5 — «База розыска»: только просмотр. */
export default function AllWantedScreen() {
  const { lastEvent } = useAlerts();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api.allWanted());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, lastEvent]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenTitle>База розыска</ScreenTitle>
      <View style={{ paddingHorizontal: 16 }}>
        <ErrorText>{error}</ErrorText>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
          Всего записей: {rows.length}. Только просмотр.
        </Text>
      </View>
      <WantedTable
        columns={ALL_COLUMNS}
        rows={rows}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        emptyText="В базе розыска нет записей."
      />
      <View style={{ height: 10 }} />
    </View>
  );
}
