import React from 'react';
import { Text } from 'react-native';
import { Badge, DataTable, Empty } from './ui';
import { colors } from '../theme';

export const statusTone = (st) =>
  st === 'В розыске' ? 'danger' : st === 'Найден' ? 'success' : st === 'Передан' ? 'warn' : 'neutral';

const plateCol = {
  key: 'plate',
  title: 'ГРЗ',
  width: 110,
  render: (r) => <Text style={{ fontWeight: '800', letterSpacing: 0.5, color: colors.text }}>{r.plate}</Text>,
};
const statusCol = {
  key: 'status',
  title: 'Статус',
  width: 110,
  render: (r) => <Badge text={r.status} tone={statusTone(r.status)} />,
};

export const MY_COLUMNS = [
  plateCol,
  statusCol,
  { key: 'model', title: 'Модель', width: 130 },
  { key: 'color', title: 'Цвет', width: 90 },
  { key: 'fix_time', title: 'Время', width: 90 },
  { key: 'fix_date', title: 'Дата', width: 100 },
  { key: 'fix_address', title: 'Адрес фиксации', width: 230 },
];

// рис. 5: ГРЗ, Статус, Цвет, Сотрудник, Время, Дата, Адрес (+ модель, она есть в ТЗ как столбец)
export const ALL_COLUMNS = [
  plateCol,
  statusCol,
  { key: 'model', title: 'Модель', width: 130 },
  { key: 'color', title: 'Цвет', width: 90 },
  { key: 'employee_name', title: 'Сотрудник', width: 190 },
  { key: 'fix_time', title: 'Время', width: 90 },
  { key: 'fix_date', title: 'Дата', width: 100 },
  { key: 'fix_address', title: 'Адрес фиксации', width: 230 },
];

export default function WantedTable({ columns, rows, selectedKey, onRowPress, refreshControl, emptyText }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      keyOf={(r) => r.id}
      selectedKey={selectedKey}
      onRowPress={onRowPress}
      refreshControl={refreshControl}
      empty={<Empty icon="car-outline" text={emptyText} />}
    />
  );
}
