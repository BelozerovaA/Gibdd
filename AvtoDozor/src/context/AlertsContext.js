import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { api, wsUrl } from '../lib/api';
import { load, save } from '../lib/storage';
import { FOLLOWUP_SECONDS } from '../config';
import { useAuth } from './AuthContext';

const AlertsContext = createContext(null);
export const useAlerts = () => useContext(AlertsContext);

const VIBRATION = [0, 500, 250, 500];

/**
 * Оповещения в реальном времени.
 *
 * Поток по ТЗ:
 *  1. По WebSocket приходит {type:'detection', ...} -> окно оповещения (рис. 7), карта переключается на камеру.
 *  2. «Принять» -> PUT /reaction «Принято», окно закрывается, ставится таймер.
 *  3. Через FOLLOWUP_SECONDS -> окно «Найден ли автомобиль?» (рис. 8).
 *     «Да» -> PUT /found «Да» (бэкенд снимает ТС с розыска, оповещений больше нет).
 *     «Нет» -> PUT /found «Нет» (розыск продолжается).
 *  4. Нет ответа в течение интервала -> оповещение повторяется (вибрация + счётчик повторов).
 */
export function AlertsProvider({ children, onFocusCamera }) {
  const { session } = useAuth();
  const [incoming, setIncoming] = useState([]); // ждут «Принять»
  const [followups, setFollowups] = useState([]); // {alertId, plate, address, dueAt, repeats}
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastEvent, setLastEvent] = useState(0); // растёт при каждом новом оповещении — экраны обновляют списки
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const closedByUs = useRef(false);
  const incomingRef = useRef([]);
  const followupsRef = useRef([]);
  const camerasRef = useRef([]);

  incomingRef.current = incoming;
  followupsRef.current = followups;

  // ---------- сохранение таймеров, чтобы пережить перезапуск приложения ----------
  const persistFollowups = (list) => save(`followups:${session?.userId}`, list);

  const addIncoming = useCallback(
    (p) => {
      if (!p?.alert_id) return;
      const known =
        incomingRef.current.some((a) => a.alert_id === p.alert_id) ||
        followupsRef.current.some((f) => f.alertId === p.alert_id);
      if (known) return;
      setIncoming((list) => [...list, p]);
      setLastEvent((n) => n + 1);
      Vibration.vibrate(VIBRATION);
      // карта сама переключается на камеру (требование ТЗ)
      onFocusCamera?.(p);
    },
    [onFocusCamera],
  );

  // ---------- WebSocket ----------
  const connect = useCallback(() => {
    if (!session) return;
    closedByUs.current = false;
    const ws = new WebSocket(wsUrl(session.userId));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // всё, что пришло, пока приложение было закрыто
      api
        .pending()
        .then((rows) => {
          camerasRef.current = camerasRef.current || [];
          rows.reverse().forEach((r) => {
            const cam = camerasRef.current.find((c) => c.address === r.address);
            addIncoming({
              alert_id: r.id,
              plate: r.plate,
              address: r.address,
              date: r.date,
              time: r.time,
              camera_id: cam?.id ?? null,
              camera_number: cam
                ? parseInt(String(cam.camera_id || '').replace(/\D/g, ''), 10) || cam.id
                : null,
            });
          });
        })
        .catch(() => {});
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'detection') addIncoming(msg);
      } catch {
        // игнорируем не-JSON
      }
    };
    ws.onclose = (e) => {
      setConnected(false);
      if (closedByUs.current) return;
      if (e?.code === 4401) return; // токен недействителен — AuthContext разлогинит при ближайшем запросе
      retryRef.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {};
  }, [session, addIncoming]);

  useEffect(() => {
    if (!session) return undefined;
    (async () => {
      const saved = await load(`followups:${session.userId}`, []);
      setFollowups(saved);
      try {
        camerasRef.current = await api.cameras();
      } catch {
        camerasRef.current = [];
      }
      connect();
    })();
    return () => {
      closedByUs.current = true;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
      setIncoming([]);
      setFollowups([]);
      setConnected(false);
    };
  }, [session, connect]);

  // ---------- тикер: проверка сроков повторных оповещений ----------
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const dueFollowup = followups.find((f) => f.dueAt <= now) || null;
  const current = incoming[0] || null;

  // повтор оповещения, если сотрудник не ответил за интервал
  useEffect(() => {
    if (!dueFollowup) return;
    if (now - (dueFollowup.lastPrompt || dueFollowup.dueAt) >= FOLLOWUP_SECONDS * 1000) {
      setFollowups((list) => {
        const next = list.map((f) =>
          f.alertId === dueFollowup.alertId
            ? { ...f, lastPrompt: Date.now(), repeats: (f.repeats || 0) + 1 }
            : f,
        );
        persistFollowups(next);
        return next;
      });
      Vibration.vibrate(VIBRATION);
    } else if (!dueFollowup.lastPrompt) {
      // первый показ окна «результат розыска»
      Vibration.vibrate(VIBRATION);
      setFollowups((list) => {
        const next = list.map((f) =>
          f.alertId === dueFollowup.alertId ? { ...f, lastPrompt: Date.now() } : f,
        );
        persistFollowups(next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, dueFollowup?.alertId]);

  // повтор вибрации для непринятого оповещения
  useEffect(() => {
    if (!current) return undefined;
    const t = setInterval(() => Vibration.vibrate(VIBRATION), FOLLOWUP_SECONDS * 1000);
    return () => clearInterval(t);
  }, [current?.alert_id]);

  // ---------- действия ----------
  const accept = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await api.setReaction(current.alert_id, 'Принято');
      setIncoming((list) => list.filter((a) => a.alert_id !== current.alert_id));
      const item = {
        alertId: current.alert_id,
        plate: current.plate,
        address: current.address,
        dueAt: Date.now() + FOLLOWUP_SECONDS * 1000,
        repeats: 0,
      };
      setFollowups((list) => {
        const next = [...list, item];
        persistFollowups(next);
        return next;
      });
      setLastEvent((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [current]);

  const answerResult = useCallback(
    async (found) => {
      if (!dueFollowup) return;
      setBusy(true);
      setError(null);
      try {
        await api.setFound(dueFollowup.alertId, found ? 'Да' : 'Нет');
        setFollowups((list) => {
          const next = list.filter((f) => f.alertId !== dueFollowup.alertId);
          persistFollowups(next);
          return next;
        });
        setLastEvent((n) => n + 1);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    [dueFollowup],
  );

  const value = {
    connected,
    busy,
    error,
    clearError: () => setError(null),
    current, // окно «Оповещение»
    dueFollowup, // окно «Найден ли автомобиль?»
    accept,
    answerResult,
    lastEvent,
    setCameras: (c) => {
      camerasRef.current = c;
    },
  };

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}
