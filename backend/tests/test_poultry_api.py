"""Backend API tests for Poultry Farm Management App"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chicken-stock-hub.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@poultry.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_session(session):
    # Auth uses httpOnly cookies - session keeps cookies automatically
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    return session


@pytest.fixture(scope="session")
def farms(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/farms")
    assert r.status_code == 200, r.text
    return r.json()


# ---------- AUTH ----------
class TestAuth:
    def test_login_success(self, session):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == ADMIN_EMAIL
        assert "id" in data
        # httpOnly cookies must be set
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

    def test_login_invalid(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": "wrongpass_xyz"})
        assert r.status_code in (400, 401, 429)

    def test_me(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == ADMIN_EMAIL
        assert "password_hash" not in data

    def test_me_unauthorized(self):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ---------- FARMS ----------
class TestFarms:
    def test_get_farms(self, farms):
        assert isinstance(farms, list)
        assert len(farms) >= 3
        names = " ".join([str(f.get("name", "")).lower() for f in farms])
        for keyword in ["badshah", "amayrah", "qismat"]:
            assert keyword in names, f"Missing farm: {keyword}"
        for f in farms:
            assert "id" in f
            assert "_id" not in f


# ---------- STOCK ----------
class TestStock:
    created_id = None

    def test_create_stock(self, auth_session, farms):
        farm_id = farms[0]["id"]
        payload = {
            "farm_id": farm_id,
            "day": 7,
            "date": "2026-01-07",
            "stock": 995,
            "dead": 2,
            "left": 993,
            "notes": "TEST_weekly_separator"
        }
        r = auth_session.post(f"{BASE_URL}/api/stock", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["stock"] == 995
        assert data["dead"] == 2
        assert data["left"] == 993
        assert "id" in data
        TestStock.created_id = data["id"]

    def test_get_stock(self, auth_session, farms):
        farm_id = farms[0]["id"]
        r = auth_session.get(f"{BASE_URL}/api/stock/{farm_id}")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(e.get("id") == TestStock.created_id for e in data)

    def test_update_stock(self, auth_session):
        if not TestStock.created_id:
            pytest.skip("No stock created")
        r = auth_session.put(f"{BASE_URL}/api/stock/{TestStock.created_id}",
                             json={"dead": 10, "left": 985})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["dead"] == 10
        assert data["left"] == 985

    def test_delete_stock(self, auth_session):
        if not TestStock.created_id:
            pytest.skip()
        r = auth_session.delete(f"{BASE_URL}/api/stock/{TestStock.created_id}")
        assert r.status_code in (200, 204)


# ---------- FEED ----------
class TestFeed:
    created_id = None

    def test_create_feed(self, auth_session, farms):
        farm_id = farms[0]["id"]
        payload = {
            "farm_id": farm_id,
            "date": "2026-01-15",
            "feed_name": "Starter",
            "bags": 2,
            "weight": 100.0,
            "used": 20.0,
            "remaining": 80.0,
            "notes": "TEST_feed"
        }
        r = auth_session.post(f"{BASE_URL}/api/feed", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["weight"] == 100.0
        assert data["remaining"] == 80.0
        TestFeed.created_id = data.get("id")

    def test_get_feed(self, auth_session, farms):
        farm_id = farms[0]["id"]
        r = auth_session.get(f"{BASE_URL}/api/feed/{farm_id}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_feed(self, auth_session):
        if not TestFeed.created_id:
            pytest.skip()
        r = auth_session.put(f"{BASE_URL}/api/feed/{TestFeed.created_id}",
                             json={"used": 30.0, "remaining": 70.0})
        assert r.status_code == 200
        data = r.json()
        assert data["used"] == 30.0
        assert data["remaining"] == 70.0

    def test_delete_feed(self, auth_session):
        if not TestFeed.created_id:
            pytest.skip()
        r = auth_session.delete(f"{BASE_URL}/api/feed/{TestFeed.created_id}")
        assert r.status_code in (200, 204)


# ---------- INVOICES ----------
class TestInvoices:
    created_id = None

    def test_create_invoice(self, auth_session, farms):
        payload = {
            "invoice_number": "TEST_INV_001",
            "date": "2026-01-15",
            "customer_name": "TEST_Customer",
            "mobile_number": "9999999999",
            "address": "Test Address",
            "farm_id": farms[0]["id"],
            "items": [
                {"product_name": "Chicken", "quantity": 10, "rate": 200.0, "total": 2000.0}
            ],
            "subtotal": 2000.0,
            "gst_amount": 360.0,
            "total": 2360.0,
            "payment_status": "unpaid",
            "notes": "TEST"
        }
        r = auth_session.post(f"{BASE_URL}/api/invoices", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["invoice_number"] == "TEST_INV_001"
        assert data["total"] == 2360.0
        assert data["payment_status"] == "unpaid"
        TestInvoices.created_id = data["id"]

    def test_list_invoices(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/invoices")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(i.get("id") == TestInvoices.created_id for i in data)

    def test_update_invoice_payment(self, auth_session):
        if not TestInvoices.created_id:
            pytest.skip()
        r = auth_session.put(f"{BASE_URL}/api/invoices/{TestInvoices.created_id}",
                             json={"payment_status": "paid"})
        assert r.status_code == 200, r.text
        assert r.json().get("payment_status") == "paid"

    def test_update_invoice_partial(self, auth_session):
        if not TestInvoices.created_id:
            pytest.skip()
        r = auth_session.put(f"{BASE_URL}/api/invoices/{TestInvoices.created_id}",
                             json={"payment_status": "partial"})
        assert r.status_code == 200
        assert r.json().get("payment_status") == "partial"

    def test_delete_invoice(self, auth_session):
        if not TestInvoices.created_id:
            pytest.skip()
        r = auth_session.delete(f"{BASE_URL}/api/invoices/{TestInvoices.created_id}")
        assert r.status_code in (200, 204)


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_stats(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total_farms" in data
        assert "total_live_stock" in data
        assert "total_dead" in data
        assert "total_invoices" in data
        assert "total_revenue" in data
        assert data["total_farms"] >= 3


# ---------- LOGOUT ----------
class TestLogout:
    def test_logout(self):
        s = requests.Session()
        # Login first
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        # Logout
        r = s.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
