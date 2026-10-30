"""Лёгкий e2e: Emitter + FakeHub без реального backend."""
import random
import unittest

from app.cameras import Camera
from app.emitter import Emitter
from app.watchlist import Watchlist
from tests.fakes import FakeHub


def make_camera(code):
    return Camera(
        code=code,
        address=f"адрес {code}",
        latitude=58.6,
        longitude=49.6,
        type="Стационарная",
        speed_limit=60,
        active=True,
    )


class EndToEndProtocolTests(unittest.TestCase):
    def test_watchlist_then_detection_flow(self):
        cameras = [make_camera("CAM-01"), make_camera("CAM-02")]
        hub = FakeHub([c.code for c in cameras])
        watchlist = Watchlist()
        emitter = Emitter(cameras, watchlist, hub, 60, rng=random.Random(42))

        watchlist.replace(["А111АА43", "В222ВВ43"])
        self.assertEqual(len(watchlist), 2)

        result = emitter.tick()
        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "accepted")

        out = emitter.detect("А111АА43", "CAM-01")
        self.assertEqual(out["event"]["plate"], "А111АА43")
        self.assertEqual(out["gibdd_response"]["status"], "accepted")
        self.assertGreaterEqual(len(hub.get("CAM-01").sent), 1)

    def test_empty_watchlist_no_auto_detection(self):
        cameras = [make_camera("CAM-01")]
        hub = FakeHub(["CAM-01"])
        emitter = Emitter(cameras, Watchlist(), hub, 60)
        self.assertIsNone(emitter.tick())
        self.assertEqual(hub.get("CAM-01").sent, [])


if __name__ == "__main__":
    unittest.main()
