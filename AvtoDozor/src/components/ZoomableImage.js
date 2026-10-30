import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';

const MIN = 1;
const MAX = 6;
// Android уменьшает картинку до размера её view, поэтому view делаем в 4 раза больше,
// а на экране уменьшаем обратно через transform: так при приближении картинка остаётся чёткой.
const LAYOUT = 4;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Картинка с масштабированием и перемещением.
 * Жесты: перетаскивание одним пальцем, щипок двумя. Управление из кода: zoomIn / zoomOut / focusOn / reset.
 */
const ZoomableImage = forwardRef(function ZoomableImage({ source, aspect, background = '#E8EEF7' }, ref) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const boxRef = useRef(box);
  const viewRef = useRef(view);
  const origin = useRef({ x: 0, y: 0 });
  const last = useRef(null);
  const containerRef = useRef(null);

  const fit = (b) => {
    const iw = Math.min(b.w, b.h * aspect);
    return { iw, ih: iw / aspect };
  };

  const apply = (v) => {
    const b = boxRef.current;
    const { iw, ih } = fit(b);
    const scale = clamp(v.scale, MIN, MAX);
    const mx = Math.max(0, (iw * scale - b.w) / 2);
    const my = Math.max(0, (ih * scale - b.h) / 2);
    const next = { scale, tx: clamp(v.tx, -mx, mx), ty: clamp(v.ty, -my, my) };
    viewRef.current = next;
    setView(next);
  };

  // масштабирование относительно точки (px, py), заданной от центра области
  const zoomAbout = (factor, px = 0, py = 0) => {
    const { scale, tx, ty } = viewRef.current;
    const ns = clamp(scale * factor, MIN, MAX);
    const r = ns / scale;
    apply({ scale: ns, tx: px - (px - tx) * r, ty: py - (py - ty) * r });
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomAbout(1.6),
    zoomOut: () => zoomAbout(1 / 1.6),
    reset: () => apply({ scale: 1, tx: 0, ty: 0 }),
    // показать точку (nx, ny — доли ширины и высоты картинки) по центру с заданным масштабом
    focusOn: (nx, ny, scale = 2.5) => {
      const { iw, ih } = fit(boxRef.current);
      apply({ scale, tx: -(nx - 0.5) * iw * scale, ty: -(ny - 0.5) * ih * scale });
    },
  }));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        last.current = null;
        containerRef.current?.measureInWindow((x, y) => {
          origin.current = { x, y };
        });
      },
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        if (!t || !t.length) return;
        const two = t.length >= 2;
        const cur = two
          ? {
              x: (t[0].pageX + t[1].pageX) / 2,
              y: (t[0].pageY + t[1].pageY) / 2,
              d: Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY),
            }
          : { x: t[0].pageX, y: t[0].pageY, d: 0 };
        const prev = last.current;
        last.current = cur;
        // при смене числа пальцев пропускаем кадр, чтобы картинка не «прыгала»
        if (!prev || !!prev.d !== !!cur.d) return;

        const v = viewRef.current;
        const b = boxRef.current;
        let next = { scale: v.scale, tx: v.tx + (cur.x - prev.x), ty: v.ty + (cur.y - prev.y) };
        if (cur.d && prev.d) {
          const ns = clamp(v.scale * (cur.d / prev.d), MIN, MAX);
          const r = ns / v.scale;
          const px = cur.x - origin.current.x - b.w / 2;
          const py = cur.y - origin.current.y - b.h / 2;
          next = { scale: ns, tx: px - (px - next.tx) * r, ty: py - (py - next.ty) * r };
        }
        apply(next);
      },
      onPanResponderRelease: () => {
        last.current = null;
      },
    }),
  ).current;

  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    const b = { w: width, h: height };
    boxRef.current = b;
    setBox(b);
    apply(viewRef.current);
  };

  const { iw, ih } = fit(box);
  const lw = iw * LAYOUT;
  const lh = ih * LAYOUT;

  return (
    <View
      ref={containerRef}
      collapsable={false}
      onLayout={onLayout}
      style={[s.box, { backgroundColor: background }]}
      {...pan.panHandlers}
    >
      {box.w > 0 ? (
        <Image
          source={source}
          fadeDuration={0}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: lw,
            height: lh,
            left: (box.w - lw) / 2,
            top: (box.h - lh) / 2,
            transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale / LAYOUT }],
          }}
        />
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden' },
});

export default ZoomableImage;
