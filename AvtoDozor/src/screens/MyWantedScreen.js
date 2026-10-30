import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAlerts } from '../context/AlertsContext';
import { Button, Dialog, ErrorText, ScreenTitle, Select } from '../components/ui';
import WantedTable, { MY_COLUMNS } from '../components/WantedTable';
import { colors } from '../theme';

export default function MyWantedScreen() {
  const { lastEvent } = useAlerts();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [dlg, setDlg] = useState(false);
  const [plates, setPlates] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [plate, setPlate] = useState(null);
  const [reason, setReason] = useState(null);
  const [dlgError, setDlgError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api.myWanted());
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

  const openAdd = async () => {
    setDlgError(null);
    setPlate(null);
    setDlg(true);
    try {
      const [p, r] = await Promise.all([api.availablePlates(), api.violationCategories()]);
      setPlates(p);
      setReasons(r);
      setReason(r[0] ?? 'Угон');
    } catch (e) {
      setDlgError(e.message);
    }
  };

  const add = async () => {
    if (!plate) {
      setDlgError('Выберите ГРЗ автомобиля');
      return;
    }
    setSaving(true);
    setDlgError(null);
    try {
      await api.addWanted(plate, reason || 'Угон');
      setDlg(false);
      await load();
    } catch (e) {
      setDlgError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    const row = rows.find((r) => r.id === selected);
    if (!row) return;
    Alert.alert('Удалить из розыска', `Удалить автомобиль ${row.plate} из вашего списка розыска?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteWanted(row.plate);
            setSelected(null);
            await load();
          } catch (e) {
            setError(e.message);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenTitle>Мой розыск</ScreenTitle>
      <View style={s.actions}>
        <Button title="Добавить в розыск" icon="add-circle-outline" onPress={openAdd} small style={{ flex: 1, marginRight: 8 }} />
        <Button
          title="Удалить из розыска"
          icon="trash-outline"
          variant="danger"
          onPress={remove}
          disabled={selected == null}
          loading={deleting}
          small
          style={{ flex: 1 }}
        />
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <ErrorText>{error}</ErrorText>
        <Text style={s.hint}>Чтобы удалить запись, коснитесь строки в таблице</Text>
      </View>

      <WantedTable
        columns={MY_COLUMNS}
        rows={rows}
        selectedKey={selected}
        onRowPress={(r) => setSelected((cur) => (cur === r.id ? null : r.id))}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        emptyText="В вашем списке розыска пока пусто. Нажмите «Добавить в розыск»."
      />
      <View style={{ height: 10 }} />

      <Dialog visible={dlg} title="Добавление данных" onRequestClose={() => setDlg(false)}>
        <Text style={s.fieldLabel}>ГРЗ</Text>
        <Select
          value={plate}
          onChange={setPlate}
          options={plates.map((p) => ({ value: p, label: p }))}
          placeholder="Выберите ГРЗ"
        />
        <Text style={[s.fieldLabel, { marginTop: 12 }]}>Причина розыска</Text>
        <Select value={reason} onChange={setReason} options={reasons.map((r) => ({ value: r, label: r }))} />
        <ErrorText>{dlgError}</ErrorText>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Button title="Добавить" onPress={add} loading={saving} style={{ flex: 1, marginRight: 6 }} />
          <Button title="Отмена" variant="ghost" onPress={() => setDlg(false)} style={{ flex: 1, marginLeft: 6 }} />
        </View>
      </Dialog>
    </View>
  );
}

const s = StyleSheet.create({
  actions: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  fieldLabel: { fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 6 },
});
