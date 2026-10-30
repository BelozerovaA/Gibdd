"""Тесты WatchlistPublisher: рассылка списка розыска камерам по WebSocket."""
from __future__ import annotations

import asyncio
import os
import sys
import threading
import time
import unittest
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.camera_client import WatchlistPublisher  # noqa: E402
from app.websocket.camera_manager import CameraConnectionManager  # noqa: E402


def wait_until(predicate, timeout=3.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


class FakeManager:
    """Подмена camera_manager: запоминает broadcast/send_to без реального WebSocket."""

    def __init__(self):
        self.broadcasts: List[dict] = []
        self.sent_to: List[tuple] = []
        self.fail_broadcast = False

    async def broadcast(self, message: dict) -> int:
        if self.fail_broadcast:
            raise RuntimeError("broadcast failed")
        self.broadcasts.append(message)
        return 1

    async def send_to(self, camera_code: str, message: dict) -> bool:
        self.sent_to.append((camera_code, message))
        return True


class PublisherWithManager(WatchlistPublisher):
    """Publisher, который шлёт через подставной менеджер (без singleton import)."""

    def __init__(self, plates_provider, manager: FakeManager):
        super().__init__(plates_provider=plates_provider)
        self._fake_manager = manager

    def publish_once(self) -> bool:
        try:
            plates = self._plates_provider()
        except Exception as error:
            print(f"Ошибка при подготовке списка розыска: {error}")
            self._last_ok = False
            return False

        message = {"type": "watchlist", "plates": plates}
        loop = self._loop
        if loop is None or not loop.is_running():
            self._last_ok = False
            return False

        try:
            future = asyncio.run_coroutine_threadsafe(
                self._fake_manager.broadcast(message), loop
            )
            future.result(timeout=5)
        except Exception as error:
            if self._last_ok is not False:
                print(f"Не удалось разослать список розыска камерам: {error}")
            self._last_ok = False
            return False

        self._last_ok = True
        return True

    async def send_to_camera(self, camera_code: str) -> bool:
        try:
            plates = self._plates_provider()
        except Exception:
            return False
        return await self._fake_manager.send_to(
            camera_code, {"type": "watchlist", "plates": plates}
        )


class RunningLoopMixin:
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        self._loop_thread = threading.Thread(target=self.loop.run_forever, daemon=True)
        self._loop_thread.start()
        self.addCleanup(self._stop_loop)

    def _stop_loop(self):
        self.loop.call_soon_threadsafe(self.loop.stop)
        self._loop_thread.join(timeout=2)
        self.loop.close()


class PublishOnceTests(RunningLoopMixin, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.manager = FakeManager()

    def publisher(self, plates):
        p = PublisherWithManager(lambda: plates, self.manager)
        p.bind_loop(self.loop)
        return p

    def test_broadcast_contains_watchlist_message(self):
        ok = self.publisher(["А123ВК43", "Е456КМ43"]).publish_once()
        self.assertTrue(ok)
        self.assertEqual(len(self.manager.broadcasts), 1)
        self.assertEqual(
            self.manager.broadcasts[0],
            {"type": "watchlist", "plates": ["А123ВК43", "Е456КМ43"]},
        )

    def test_empty_list_is_sent_too(self):
        self.assertTrue(self.publisher([]).publish_once())
        self.assertEqual(self.manager.broadcasts[0]["plates"], [])

    def test_no_loop_means_failure(self):
        p = PublisherWithManager(lambda: ["А1"], self.manager)
        # loop не привязан
        self.assertFalse(p.publish_once())
        self.assertEqual(self.manager.broadcasts, [])

    def test_broadcast_failure_does_not_raise(self):
        self.manager.fail_broadcast = True
        self.assertFalse(self.publisher(["А1"]).publish_once())

    def test_failure_of_plates_provider_does_not_raise(self):
        def broken():
            raise RuntimeError("БД недоступна")

        p = PublisherWithManager(broken, self.manager)
        p.bind_loop(self.loop)
        self.assertFalse(p.publish_once())
        self.assertEqual(self.manager.broadcasts, [])

    def test_send_to_camera(self):
        p = self.publisher(["А1", "Б2"])

        async def run():
            return await p.send_to_camera("CAM-08")

        future = asyncio.run_coroutine_threadsafe(run(), self.loop)
        self.assertTrue(future.result(timeout=2))
        self.assertEqual(self.manager.sent_to[0][0], "CAM-08")
        self.assertEqual(self.manager.sent_to[0][1]["plates"], ["А1", "Б2"])


class BackgroundThreadTests(RunningLoopMixin, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.manager = FakeManager()
        self.plates = ["А1"]
        self.publisher = PublisherWithManager(lambda: list(self.plates), self.manager)
        self.publisher.bind_loop(self.loop)
        self.addCleanup(self.publisher.stop)

    def test_publishes_immediately_on_start(self):
        self.publisher.start(resync_seconds=60)
        self.assertTrue(wait_until(lambda: len(self.manager.broadcasts) >= 1))

    def test_kick_publishes_new_list_without_waiting_for_resync(self):
        self.publisher.start(resync_seconds=60)
        self.assertTrue(wait_until(lambda: len(self.manager.broadcasts) == 1))
        self.plates.append("Б2")
        self.publisher.kick()
        self.assertTrue(wait_until(lambda: len(self.manager.broadcasts) == 2))
        self.assertEqual(self.manager.broadcasts[-1]["plates"], ["А1", "Б2"])

    def test_periodic_resync(self):
        self.publisher.start(resync_seconds=0.1)
        self.assertTrue(wait_until(lambda: len(self.manager.broadcasts) >= 3))

    def test_stop_terminates_the_thread(self):
        self.publisher.start(resync_seconds=60)
        self.assertTrue(self.publisher.running)
        self.publisher.stop()
        self.assertFalse(self.publisher.running)

    def test_kick_before_start_is_harmless(self):
        p = PublisherWithManager(lambda: [], self.manager)
        p.kick()
        self.assertFalse(p.running)

    def test_start_twice_does_not_create_second_thread(self):
        self.publisher.start(resync_seconds=60)
        first = self.publisher._thread
        self.publisher.start(resync_seconds=60)
        self.assertIs(self.publisher._thread, first)

    def test_retry_is_never_longer_than_resync(self):
        self.publisher.start(resync_seconds=2, retry_seconds=10)
        self.assertEqual(self.publisher._retry_seconds, 2)


class StartFromEnvTests(unittest.TestCase):
    def setUp(self):
        self.saved = {k: os.environ.get(k) for k in ("WATCHLIST_RESYNC_SECONDS",)}
        self.addCleanup(self.restore)

    def restore(self):
        for k, v in self.saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_start_from_env_always_starts_thread(self):
        # В WebSocket-архитектуре publisher всегда запускается:
        # камеры сами подключаются, URL сервиса камер больше не нужен.
        os.environ["WATCHLIST_RESYNC_SECONDS"] = "60"
        p = WatchlistPublisher(plates_provider=lambda: [])
        self.addCleanup(p.stop)
        p.start_from_env()
        self.assertTrue(p.running)

    def test_resync_seconds_from_environment(self):
        os.environ["WATCHLIST_RESYNC_SECONDS"] = "42"
        p = WatchlistPublisher(plates_provider=lambda: [])
        self.addCleanup(p.stop)
        p.start_from_env()
        self.assertEqual(p._resync_seconds, 42)


class CameraManagerUnitTests(unittest.IsolatedAsyncioTestCase):
    async def test_broadcast_and_disconnect(self):
        mgr = CameraConnectionManager()
        self.assertEqual(mgr.count(), 0)
        self.assertEqual(await mgr.broadcast({"type": "watchlist", "plates": []}), 0)


if __name__ == "__main__":
    unittest.main()
