import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Dialog, ErrorText, InfoRow } from './ui';
import { useAlerts } from '../context/AlertsContext';
import { colors } from '../theme';

/** Рис. 7 — окно оповещения и рис. 8 — окно «результат розыска». */
export default function AlertDialogs() {
  const { current, dueFollowup, accept, answerResult, busy, error } = useAlerts();

  // окно результата показываем только когда нет непринятого оповещения
  const showAlert = !!current;
  const showResult = !current && !!dueFollowup;

  return (
    <>
      <Dialog visible={showAlert} title="Оповещение" tone="alarm" onRequestClose={() => {}}>
        {current ? (
          <>
            <InfoRow label="Автомобиль:" value={current.plate} strong />
            <InfoRow label="Место:" value={current.address} />
            <InfoRow label="Время:" value={current.time} />
            <InfoRow label="Дата:" value={current.date} />
            <ErrorText>{error}</ErrorText>
            <Button title="Принять" icon="checkmark-circle" onPress={accept} loading={busy} style={{ marginTop: 16 }} />
          </>
        ) : null}
      </Dialog>

      <Dialog visible={showResult} title="Результат розыска" onRequestClose={() => {}}>
        {dueFollowup ? (
          <>
            <Text style={s.q}>Удалось ли найти автомобиль?</Text>
            <Text style={s.plate}>{dueFollowup.plate}</Text>
            <Text style={s.sub}>{dueFollowup.address}</Text>
            {dueFollowup.repeats > 0 ? (
              <Text style={s.repeat}>Повторное оповещение № {dueFollowup.repeats}: ответа пока нет</Text>
            ) : null}
            <ErrorText>{error}</ErrorText>
            <View style={s.row}>
              <Button title="Да" variant="success" onPress={() => answerResult(true)} disabled={busy} style={s.half} />
              <Button title="Нет" variant="outline" onPress={() => answerResult(false)} disabled={busy} style={s.half} />
            </View>
          </>
        ) : null}
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  q: { fontSize: 16, color: colors.text, textAlign: 'center' },
  plate: { fontSize: 28, fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginTop: 10, color: colors.primaryDark },
  sub: { textAlign: 'center', color: colors.muted, marginTop: 4, marginBottom: 6 },
  repeat: { textAlign: 'center', color: colors.danger, fontWeight: '600', marginTop: 6 },
  row: { flexDirection: 'row', marginTop: 16 },
  half: { flex: 1, marginHorizontal: 5 },
});
