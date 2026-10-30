"""Эмиттер: что и когда отправляется через WebSocket-хаб."""
import random
import unittest

from app.cameras import Camera
from app.emitter import Emitter, UnknownCamera, build_event
from app.watchlist import Watchlist
from app.ws_client import DeliveryError, DeliveryRejected, _http_to_ws
from tests.fakes import FakeHub


def camera(code, active=True):
    return Camera(
        code=code,
        address=f"ул. {code}",
        latitude=1.0,
        longitude=2.0,
        type="Стационарная",
        speed_limit=60,
        active=active,
    )


class HttpToWsTests(unittest.TestCase):
    def test_http_and_https(self):
        self.assertEqual(_http_to_ws("http://localhost:8000"), "ws://localhost:8000")
        self.assertEqual(_http_to_ws("https://example.com/"), "wss://example.com")
        self.assertEqual(_http_to_ws("ws://x"), "ws://x")


class BuildEventTests(unittest.TestCase):
    def test_fields(self):
        event = build_event("А123ВК43", camera("CAM-01"))
        self.assertEqual(event["plate"], "А123ВК43")
        self.assertEqual(event["camera_code"], "CAM-01")
        self.assertIn("event_id", event)
        self.assertIn("detected_at", event)


class EmitterTickTests(unittest.TestCase):
    def setUp(self):
        self.cameras = [camera("CAM-01"), camera("CAM-02", active=False), camera("CAM-03")]
        self.watchlist = Watchlist()
        self.hub = FakeHub(["CAM-01", "CAM-02", "CAM-03"])
        self.emitter = Emitter(self.cameras, self.watchlist, self.hub, 60, rng=random.Random(0))

    def test_tick_does_nothing_without_watchlist(self):
        self.assertIsNone(self.emitter.tick())
        self.assertEqual(self.hub.get("CAM-01").sent, [])

    def test_tick_sends_to_active_camera_only(self):
        self.watchlist.replace(["А123ВК43"])
        result = self.emitter.tick()
        self.assertIsNotNone(result)
        sent_codes = [code for code in ("CAM-01", "CAM-02", "CAM-03") if self.hub.get(code).sent]
        self.assertTrue(sent_codes)
        self.assertNotIn("CAM-02", sent_codes)

    def test_tick_handles_delivery_error(self):
        self.watchlist.replace(["А1"])
        for code in ("CAM-01", "CAM-03"):
            self.hub.get(code).fail = True
        self.assertIsNone(self.emitter.tick())


class EmitterDetectTests(unittest.TestCase):
    def setUp(self):
        self.cameras = [camera("CAM-08"), camera("CAM-09", active=False)]
        self.watchlist = Watchlist()
        self.hub = FakeHub(["CAM-08", "CAM-09"])
        self.emitter = Emitter(self.cameras, self.watchlist, self.hub, 60, rng=random.Random(1))

    def test_detect_known_camera(self):
        out = self.emitter.detect(" а123 вк43 ", "CAM-08")
        self.assertEqual(out["event"]["plate"], "А123ВК43")
        self.assertEqual(out["event"]["camera_code"], "CAM-08")
        self.assertEqual(out["gibdd_response"]["status"], "accepted")
        self.assertEqual(len(self.hub.get("CAM-08").sent), 1)

    def test_detect_unknown_camera(self):
        with self.assertRaises(UnknownCamera):
            self.emitter.detect("А1", "CAM-99")

    def test_detect_inactive_camera(self):
        with self.assertRaises(UnknownCamera):
            self.emitter.detect("А1", "CAM-09")

    def test_detect_random_active_when_no_code(self):
        out = self.emitter.detect("Б2")
        self.assertEqual(out["event"]["camera_code"], "CAM-08")

    def test_detect_rejected_by_backend(self):
        self.hub.get("CAM-08").response = {"type": "ack", "status": "error", "detail": "cooldown"}
        with self.assertRaises(DeliveryRejected):
            self.emitter.detect("А1", "CAM-08")

    def test_detect_no_socket(self):
        hub = FakeHub([])
        emitter = Emitter(self.cameras, self.watchlist, hub, 60)
        with self.assertRaises(DeliveryError):
            emitter.detect("А1", "CAM-08")


if __name__ == "__main__":
    unittest.main()
