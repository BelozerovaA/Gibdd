"""HTTP-интерфейс сервиса камер (health, cameras, watchlist GET, ручная фиксация)."""
import json
import os
import threading
import unittest
import urllib.error
import urllib.request

from app.cameras import load_cameras
from app.config import load_settings
from app.emitter import Emitter
from app.server import CameraApp, make_server
from app.watchlist import Watchlist
from tests.fakes import FakeHub

PACKAGED = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "cameras.json"
)
TOKEN = "test-token"


class ServerTestCase(unittest.TestCase):
    manual = "true"
    token = TOKEN

    def setUp(self):
        settings = load_settings(
            {
                "GIBDD_URL": "http://localhost:8000",
                "SERVICE_TOKEN": self.token,
                "ENABLE_MANUAL_DETECTIONS": self.manual,
            }
        )
        cameras = load_cameras(PACKAGED)
        self.watchlist = Watchlist()
        codes = [c.code for c in cameras if c.active]
        self.hub = FakeHub(codes)
        emitter = Emitter(cameras, self.watchlist, self.hub, 60)
        self.server = make_server(
            CameraApp(settings, cameras, self.watchlist, emitter, self.hub),
            "127.0.0.1",
            0,
        )
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(
            target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
        ).start()
        self.addCleanup(self.stop)

    def stop(self):
        self.server.shutdown()
        self.server.server_close()

    def call(self, method, path, body=None, token=TOKEN, raw=None, headers=None):
        data = (
            raw
            if raw is not None
            else (json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None)
        )
        h = {"Content-Type": "application/json"}
        if token is not None:
            h["X-Service-Token"] = token
        h.update(headers or {})
        request = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(request, timeout=3) as r:
                return r.status, json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode("utf-8"))


class PublicAndAuthTests(ServerTestCase):
    def test_health_is_public(self):
        status, body = self.call("GET", "/health", token=None)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["cameras"], 15)
        self.assertEqual(body["watchlist"], 0)
        self.assertEqual(body["transport"], "websocket")

    def test_protected_routes_need_the_token(self):
        for method, path in (
            ("GET", "/v1/cameras"),
            ("GET", "/v1/watchlist"),
            ("POST", "/v1/detections"),
        ):
            self.assertEqual(self.call(method, path, {}, token=None)[0], 401, path)
            self.assertEqual(self.call(method, path, {}, token="wrong-token")[0], 401, path)

    def test_unknown_path(self):
        self.assertEqual(self.call("GET", "/v1/nothing")[0], 404)

    def test_put_watchlist_is_gone(self):
        # Список розыска приходит только по WebSocket от backend
        status, body = self.call("PUT", "/v1/watchlist", {"plates": ["А1"]})
        self.assertIn(status, (404, 405))


class NoTokenConfiguredTests(ServerTestCase):
    token = ""

    def test_everything_protected_is_closed(self):
        status, body = self.call("GET", "/v1/watchlist", token="any-token")
        self.assertEqual(status, 503)
        self.assertIn("SERVICE_TOKEN", body["detail"])
        self.assertEqual(self.call("GET", "/health", token=None)[0], 200)


class WatchlistGetTests(ServerTestCase):
    def test_get_returns_current_list(self):
        self.watchlist.replace(["а123вк43", "Е456КМ43"])
        status, body = self.call("GET", "/v1/watchlist")
        self.assertEqual(status, 200)
        self.assertEqual(body["count"], 2)
        self.assertEqual(body["plates"], ["А123ВК43", "Е456КМ43"])


class CamerasTests(ServerTestCase):
    def test_list_cameras(self):
        status, body = self.call("GET", "/v1/cameras")
        self.assertEqual(status, 200)
        self.assertEqual(len(body["cameras"]), 15)
        codes = {c["code"] for c in body["cameras"]}
        self.assertIn("CAM-08", codes)


class ManualDetectionTests(ServerTestCase):
    def test_detect_sends_via_hub(self):
        status, body = self.call(
            "POST", "/v1/detections", {"plate": "А123ВК43", "camera_code": "CAM-08"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["event"]["plate"], "А123ВК43")
        self.assertEqual(body["event"]["camera_code"], "CAM-08")
        self.assertEqual(body["gibdd_response"]["status"], "accepted")
        self.assertEqual(len(self.hub.get("CAM-08").sent), 1)

    def test_detect_unknown_camera(self):
        status, body = self.call(
            "POST", "/v1/detections", {"plate": "А1", "camera_code": "CAM-99"}
        )
        self.assertEqual(status, 422)

    def test_detect_requires_plate(self):
        self.assertEqual(self.call("POST", "/v1/detections", {})[0], 400)
        self.assertEqual(self.call("POST", "/v1/detections", {"plate": ""})[0], 400)

    def test_broken_json(self):
        self.assertEqual(self.call("POST", "/v1/detections", raw=b"{bad")[0], 400)

    def test_too_large_body(self):
        self.assertEqual(self.call("POST", "/v1/detections", raw=b"x" * (70 * 1024))[0], 413)


class ManualDisabledTests(ServerTestCase):
    manual = "false"

    def test_detections_disabled(self):
        status, body = self.call("POST", "/v1/detections", {"plate": "А1", "camera_code": "CAM-08"})
        self.assertEqual(status, 404)
        self.assertIn("отключена", body["detail"].lower())


if __name__ == "__main__":
    unittest.main()
