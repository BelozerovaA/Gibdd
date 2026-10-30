import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ZoomableImage from '../components/ZoomableImage';
import { Button, ScreenTitle } from '../components/ui';
import { MAP_ALL, MAP_CAMERAS } from '../data/mapImages';
import { CAMERA_POS, MAP_ASPECT } from '../data/cameraPositions';
import { colors, radius } from '../theme';

/**
 * Рис. 6 — «Карта». Показывает общую карту с камерами (All_map).
 * При тревоге переключается на изображение сработавшей камеры (cam_N) и приближает к ней.
 */
export default function MapScreen({ focus }) {
  const zoom = useRef(null);
  const [alarm, setAlarm] = useState(null); // { number, address, plate, time }

  useEffect(() => {
    if (!focus) return;
    const n = Number(focus.camera_number);
    if (!MAP_CAMERAS[n]) return; // для камеры нет картинки — остаётся общая карта
    setAlarm({ number: n, address: focus.address, plate: focus.plate, time: focus.time });
    // даём картинке смениться, затем приближаем к метке камеры
    const t = setTimeout(() => zoom.current?.focusOn(CAMERA_POS[n].x, CAMERA_POS[n].y, 2.5), 150);
    return () => clearTimeout(t);
  }, [focus?.nonce]);

  const showAll = () => {
    setAlarm(null);
    zoom.current?.reset();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenTitle>Карта</ScreenTitle>
      <View style={s.actions}>
        <Button title="Увеличить" icon="add" variant="outline" small onPress={() => zoom.current?.zoomIn()} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Уменьшить" icon="remove" variant="outline" small onPress={() => zoom.current?.zoomOut()} style={{ flex: 1 }} />
      </View>

      {alarm ? (
        <View style={s.banner}>
          <Ionicons name="warning" size={22} color={colors.danger} />
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={s.bannerTitle}>
              Камера № {alarm.number}
              {alarm.plate ? ` · ${alarm.plate}` : ''}
            </Text>
            <Text style={s.bannerText} numberOfLines={2}>
              {alarm.address}
              {alarm.time ? `, ${alarm.time}` : ''}
            </Text>
          </View>
          <Button title="Все камеры" variant="ghost" small onPress={showAll} />
        </View>
      ) : null}

      <View style={s.mapBox}>
        <ZoomableImage
          ref={zoom}
          source={alarm ? MAP_CAMERAS[alarm.number] : MAP_ALL}
          aspect={MAP_ASPECT}
        />
      </View>
      <Text style={s.hint}>Перетаскивайте карту пальцем, масштаб — щипком или кнопками</Text>
    </View>
  );
}

const s = StyleSheet.create({
  actions: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 10 },
  banner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: radius.m, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#F3B8B8' },
  bannerTitle: { color: colors.danger, fontWeight: '800', fontSize: 14 },
  bannerText: { color: colors.text, fontSize: 12, marginTop: 1 },
  mapBox: { flex: 1, marginHorizontal: 12, borderRadius: radius.m, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
});
