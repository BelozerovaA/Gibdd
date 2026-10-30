import React, { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api, buildExportUrl } from '../lib/api';
import { useAlerts } from '../context/AlertsContext';
import { Badge, Button, DataTable, Dialog, Empty, ErrorText, ScreenTitle, Select } from '../components/ui';
import { colors } from '../theme';

const PERIODS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'За 7 дней' },
  { value: 'month', label: 'За 30 дней' },
  { value: 'all', label: 'За всё время' },
];

const COLUMNS = [
  { key: 'vehicle_plate', title: 'ГРЗ', width: 110, render: (r) => <Text style={{ fontWeight: '800', color: colors.text }}>{r.vehicle_plate}</Text> },
  { key: 'alert_date', title: 'Дата', width: 100 },
  { key: 'alert_time', title: 'Время', width: 90 },
  { key: 'address', title: 'Адрес', width: 230 },
  {
    key: 'reaction_status',
    title: 'Реакция',
    width: 110,
    render: (r) => <Badge text={r.reaction_status} tone={r.reaction_status === 'Принято' ? 'info' : 'warn'} />,
  },
  {
    key: 'found_status',
    title: 'Найден',
    width: 90,
    render: (r) => <Badge text={r.found_status} tone={r.found_status === 'Да' ? 'success' : 'neutral'} />,
  },
];

/** Рис. 9 и 10 — «История оповещений»: период, обновить, экспорт в docx / xlsx. */
export default function HistoryScreen() {
  const { lastEvent } = useAlerts();
  const [period, setPeriod] = useState('today');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.history(period));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load, lastEvent]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const doExport = async (format) => {
    setExporting(format);
    setExportError(null);
    try {
      // одноразовая ссылка на скачивание (действует 2 минуты) — файл откроется/скачается в браузере телефона
      const url = await buildExportUrl(format, period);
      await Linking.openURL(url);
      setExportOpen(false);
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenTitle>История оповещений</ScreenTitle>
      <View style={s.bar}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.lbl}>Период</Text>
          <Select value={period} onChange={setPeriod} options={PERIODS} />
        </View>
        <View style={s.btns}>
          <Button title="Обновить" icon="refresh" variant="outline" small onPress={refresh} loading={refreshing} />
          <Button
            title="Экспорт"
            icon="download-outline"
            small
            onPress={() => {
              setExportError(null);
              setExportOpen(true);
            }}
            style={{ marginLeft: 8 }}
          />
        </View>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <ErrorText>{error}</ErrorText>
      </View>

      <DataTable
        columns={COLUMNS}
        rows={rows}
        keyOf={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        empty={<Empty icon="notifications-off-outline" text="За выбранный период оповещений нет." />}
      />
      <View style={{ height: 10 }} />

      <Dialog visible={exportOpen} title="Выбор формата" onRequestClose={() => setExportOpen(false)}>
        <Text style={s.q}>В каком формате сохранить отчёт?</Text>
        <Text style={s.sub}>Период: {PERIODS.find((p) => p.value === period)?.label}</Text>
        <ErrorText>{exportError}</ErrorText>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Button title="Word" icon="document-text-outline" onPress={() => doExport('docx')} loading={exporting === 'docx'} disabled={!!exporting} style={s.fmt} />
          <Button title="Excel" icon="grid-outline" onPress={() => doExport('xlsx')} loading={exporting === 'xlsx'} disabled={!!exporting} style={s.fmt} />
        </View>
        <Button title="Отмена" variant="ghost" onPress={() => setExportOpen(false)} style={{ marginTop: 10 }} />
      </Dialog>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 10 },
  lbl: { fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: '600' },
  btns: { flexDirection: 'row', paddingBottom: 4 },
  q: { textAlign: 'center', fontSize: 16, color: colors.text },
  sub: { textAlign: 'center', color: colors.muted, marginTop: 4 },
  fmt: { flex: 1, marginHorizontal: 5 },
});
