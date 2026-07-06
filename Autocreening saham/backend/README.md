# Automated DCF Stock Screener — Data Ingestion Pipeline (IHSG F&B)

Backend service (FastAPI) yang menarik data fundamental emiten sektor
**Food & Beverage** di Bursa Efek Indonesia dari Yahoo Finance, mengubahnya
menjadi parameter model **Discounted Cash Flow (DCF)**, dan menyimpannya
ke PostgreSQL secara otomatis (terjadwal mingguan).

## Struktur Proyek

```
backend/
├── main.py                     # Entrypoint FastAPI + lifespan scheduler
├── database.py                 # Koneksi SQLAlchemy (engine, session)
├── models.py                   # Model ORM: Company, FinancialStatement
├── core/
│   └── scheduler.py             # Konfigurasi APScheduler (cron mingguan)
├── services/
│   └── data_ingestion.py        # Fetch yfinance + transformasi + UPSERT
└── requirements.txt
```

## Instalasi

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## Konfigurasi Environment

Buat variabel environment `DATABASE_URL`, contoh:

```
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/dcf_screener_db
```

## Menjalankan Aplikasi

```bash
uvicorn backend.main:app --reload --port 8000
```

Saat startup, aplikasi akan:
1. Membuat tabel `companies` & `financial_statements` jika belum ada.
2. Mendaftarkan & menjalankan cron job `weekly_financial_statement_update`
   yang berjalan otomatis **setiap hari Minggu jam 01:00 WIB**.

## Menambahkan Data Emiten (Master Data)

Sebelum pipeline dapat menarik data, isi dulu tabel `companies`, contoh via SQL:

```sql
INSERT INTO companies (ticker, name, sector, is_active) VALUES
  ('ICBP', 'Indofood CBP Sukses Makmur Tbk', 'Food & Beverage', true),
  ('INDF', 'Indofood Sukses Makmur Tbk', 'Food & Beverage', true),
  ('MYOR', 'Mayora Indah Tbk', 'Food & Beverage', true),
  ('ULTJ', 'Ultrajaya Milk Industry Tbk', 'Food & Beverage', true);
```

## Endpoint

| Method | Path                        | Deskripsi                                             |
|--------|-----------------------------|--------------------------------------------------------|
| GET    | `/api/health`                | Cek status aplikasi, koneksi DB, dan daftar job aktif  |
| POST   | `/admin/trigger-ingestion`   | Memicu pipeline ingestion secara manual (tanpa cron)   |

## Logika Bisnis Utama

- **Ticker mapping**: `ICBP` → `ICBP.JK` (otomatis via suffix `.JK`).
- **EBIT fallback**: jika tidak tersedia langsung, dihitung dari
  `Net Income + Tax Provision + |Interest Expense|`.
- **Tax Rate**: `Tax Provision / EBIT`, fallback ke **22%** (tarif PPh Badan RI)
  jika data tidak tersedia atau di luar rentang wajar (0%–50%).
- **CapEx**: diambil nilai absolut (yfinance melaporkannya sebagai angka negatif).
- **Total Debt**: `Long Term Debt + Short Term Debt`.
- **UPSERT**: berdasarkan kombinasi unik `(company_id, fiscal_year)`,
  dengan `db.commit()` saat sukses dan `db.rollback()` saat exception.
- **Rate-limit protection**: jeda 2.5 detik antar-emiten saat proses batch mingguan.
