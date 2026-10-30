"""Общие подделки для тестов camera-service."""
from __future__ import annotations

import time
from typing import List, Optional


class FakeSocket:
    """Имитация CameraSocket: send_detection сразу возвращает ответ."""

    def __init__(self, code: str, response=None, fail: bool = False):
        self.camera_code = code
        self.response = response or {"type": "ack", "status": "accepted", "event_id": "x"}
        self.fail = fail
        self.sent = []
        self.connected = True

    def send_detection(self, event: dict, timeout: float = 10.0) -> dict:
        from app.ws_client import DeliveryError, DeliveryRejected

        if self.fail:
            raise DeliveryError(f"камера {self.camera_code}: нет соединения")
        self.sent.append(event)
        result = dict(self.response)
        result.setdefault("event_id", event.get("event_id"))
        if result.get("status") == "error":
            raise DeliveryRejected(result.get("detail", "error"))
        return result


class FakeHub:
    """Подмена CameraHub для Emitter и HTTP-сервера."""

    def __init__(self, codes=None, response=None):
        codes = codes or []
        self._sockets = {c: FakeSocket(c, response=response) for c in codes}

    def get(self, camera_code: str):
        return self._sockets.get(camera_code)

    def connected_count(self) -> int:
        return sum(1 for s in self._sockets.values() if s.connected)

    def add(self, code: str, **kw):
        sock = FakeSocket(code, **kw)
        self._sockets[code] = sock
        return sock

    def start(self) -> None:
        pass

    def stop(self) -> None:
        pass


def wait_until(predicate, timeout=3.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False
