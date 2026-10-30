"""Согласованность сервиса камер и сервиса ГИБДД (WebSocket-протокол)."""
import ast
import os
import re
import unittest

from app.cameras import load_cameras
from app.emitter import build_event

SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(os.path.dirname(SERVICE_DIR), "backend")
CAMERAS_JSON = os.path.join(SERVICE_DIR, "app", "cameras.json")


def read(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as f:
        return f.read()


@unittest.skipUnless(os.path.isdir(BACKEND_DIR), "папка backend не найдена")
class ContractTests(unittest.TestCase):
    def test_cameras_match_the_gibdd_database_seed(self):
        tree = ast.parse(read(BACKEND_DIR, "seed.py"))
        seed = next(
            ast.literal_eval(n.value)
            for n in ast.walk(tree)
            if isinstance(n, ast.Assign)
            and any(getattr(t, "id", "") == "CAMERAS" for t in n.targets)
        )
        seed_by_code = {
            code: (address, lat, lon) for code, address, lat, lon, _type, _speed in seed
        }
        service_by_code = {
            c.code: (c.address, c.latitude, c.longitude) for c in load_cameras(CAMERAS_JSON)
        }
        self.assertEqual(
            service_by_code,
            seed_by_code,
            "Камеры в camera-service/app/cameras.json и в backend/seed.py разошлись",
        )

    def test_event_fields_match_backend_expectations(self):
        # Backend принимает detection по WebSocket с полями event_id, plate, camera_code, detected_at
        main = read(BACKEND_DIR, "app", "main.py")
        for field in ("event_id", "plate", "camera_code", "detected_at"):
            self.assertIn(field, main)
        camera = load_cameras(CAMERAS_JSON)[0]
        self.assertEqual(
            set(build_event("А1", camera)),
            {"event_id", "plate", "camera_code", "detected_at"},
        )

    def test_camera_websocket_path_matches(self):
        main = read(BACKEND_DIR, "app", "main.py")
        ws_client = read(SERVICE_DIR, "app", "ws_client.py")
        self.assertIn('/ws/cameras/{camera_code}', main)
        self.assertIn("/ws/cameras/", ws_client)

    def test_watchlist_message_type_matches(self):
        publisher = read(BACKEND_DIR, "app", "services", "camera_client.py")
        ws_client = read(SERVICE_DIR, "app", "ws_client.py")
        self.assertIn('"type": "watchlist"', publisher)
        self.assertIn('"watchlist"', ws_client)

    def test_detection_message_type_matches(self):
        ws_client = read(SERVICE_DIR, "app", "ws_client.py")
        main = read(BACKEND_DIR, "app", "main.py")
        self.assertIn('"type": "detection"', ws_client)
        self.assertIn('"detection"', main)

    def test_service_token_query_param(self):
        ws_client = read(SERVICE_DIR, "app", "ws_client.py")
        main = read(BACKEND_DIR, "app", "main.py")
        self.assertIn("token=", ws_client)
        self.assertIn("token", main)
        self.assertIn("_service_token_ok", main)

    def test_ignore_reasons_still_defined(self):
        rules = read(BACKEND_DIR, "app", "services", "detection_rules.py")
        for reason in ("not_wanted", "pending_alert", "cooldown", "duplicate"):
            self.assertIn(f'"{reason}"', rules)

    def test_websocket_payload_keys_match_what_clients_read(self):
        detections = read(BACKEND_DIR, "app", "services", "detections.py")
        start = detections.index("payload=")
        keys = set(re.findall(r'"(\w+)":', detections[start : start + 500]))
        self.assertTrue(
            {"alert_id", "plate", "camera_number", "address", "date", "time"} <= keys
        )


if __name__ == "__main__":
    unittest.main()
