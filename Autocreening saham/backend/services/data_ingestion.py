"""
services/data_ingestion.py
---------------------------
Modul inti Data Ingestion Pipeline untuk Automated DCF Stock Screener.

Bertanggung jawab untuk:
1. Menarik data fundamental (Income Statement, Cash Flow, Balance Sheet)
   dari Yahoo Finance (`yfinance`) untuk emiten IHSG.
2. Mentransformasikan data mentah menjadi parameter siap pakai untuk model DCF
   (Revenue, EBIT, Tax Rate, D&A, CapEx, Total Debt, Cash & Equivalents).
3. Melakukan UPSERT (insert/update) hasil transformasi ke tabel
   `FinancialStatement` dengan transaksi database yang aman.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from backend.database import get_db_session
from backend.models import Company, FinancialStatement

logger = logging.getLogger("dcf_screener.data_ingestion")

# Tarif PPh Badan Republik Indonesia (UU HPP) sebagai fallback statis
# apabila data "Tax Provision" tidak tersedia / kosong pada laporan keuangan.
DEFAULT_CORPORATE_TAX_RATE: float = 0.22

# Jeda antar-request ke Yahoo Finance agar tidak terkena rate-limit (detik).
REQUEST_DELAY_SECONDS: float = 2.5

# IHSG ticker suffix.
IDX_TICKER_SUFFIX: str = ".JK"


# --------------------------------------------------------------------------
# Helper: ekstraksi baris data dari DataFrame yfinance secara aman
# --------------------------------------------------------------------------
def _safe_get_row(
    df: pd.DataFrame,
    row_candidates: List[str],
    column: Any,
) -> Optional[float]:
    """
    Mengambil nilai numerik dari sebuah DataFrame laporan keuangan yfinance
    secara aman, dengan mencoba beberapa kemungkinan nama baris (row label)
    karena penamaan pada yfinance dapat berbeda antar versi/emiten.

    Args:
        df: DataFrame laporan keuangan (financials/cashflow/balance_sheet).
        row_candidates: Daftar kemungkinan nama baris, urut dari prioritas.
        column: Label kolom (biasanya Timestamp fiscal year end).

    Returns:
        Nilai float jika ditemukan dan valid, selain itu None.
    """
    if df is None or df.empty or column not in df.columns:
        return None

    for row_name in row_candidates:
        if row_name in df.index:
            try:
                value = df.loc[row_name, column]
            except (KeyError, ValueError):
                continue
            if pd.isna(value):
                continue
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
    return None


def _get_nearest_column(df: pd.DataFrame, target_date: Any) -> Optional[Any]:
    """
    Mencari kolom (fiscal year end date) pada DataFrame lain yang paling
    mendekati `target_date`, karena tanggal penutupan tahun fiskal antara
    Income Statement, Cash Flow, dan Balance Sheet kadang tidak identik
    persis meski merujuk pada periode fiskal yang sama.
    """
    if df is None or df.empty:
        return None
    try:
        diffs = [(abs((col - target_date).days), col) for col in df.columns]
        diffs.sort(key=lambda pair: pair[0])
        closest_diff, closest_col = diffs[0]
        # Toleransi maksimum 45 hari agar tidak salah mencocokkan periode fiskal.
        if closest_diff <= 45:
            return closest_col
    except Exception:  # noqa: BLE001 - kolom mungkin bukan bertipe datetime
        return None
    return None


def _extract_year_metrics(
    fiscal_date: Any,
    financials: pd.DataFrame,
    cashflow: pd.DataFrame,
    balance_sheet: pd.DataFrame,
) -> Dict[str, Optional[float]]:
    """
    Mengekstrak & mentransformasi seluruh metrik fundamental untuk satu
    periode fiskal (satu kolom tahun) dari tiga laporan keuangan yfinance.
    """
    cf_col = _get_nearest_column(cashflow, fiscal_date)
    bs_col = _get_nearest_column(balance_sheet, fiscal_date)

    # --- Income Statement ---
    revenue = _safe_get_row(financials, ["Total Revenue", "TotalRevenue"], fiscal_date)
    ebit = _safe_get_row(financials, ["EBIT", "Operating Income"], fiscal_date)
    net_income = _safe_get_row(
        financials, ["Net Income", "Net Income Common Stockholders"], fiscal_date
    )
    tax_provision = _safe_get_row(financials, ["Tax Provision", "Income Tax Expense"], fiscal_date)
    interest_expense = _safe_get_row(
        financials, ["Interest Expense", "Interest Expense Non Operating"], fiscal_date
    )

    # Fallback EBIT: Net Income + Tax Provision + Interest Expense
    if ebit is None and net_income is not None:
        tax_component = tax_provision or 0.0
        interest_component = abs(interest_expense) if interest_expense is not None else 0.0
        ebit = net_income + tax_component + interest_component
        logger.info(
            "EBIT tidak tersedia langsung, dihitung dari Net Income + Tax + Interest: %.2f",
            ebit,
        )

    # Tax Rate = Tax Provision / EBIT, fallback ke tarif PPh Badan RI (22%).
    tax_rate: float = DEFAULT_CORPORATE_TAX_RATE
    if tax_provision is not None and ebit not in (None, 0):
        computed_rate = tax_provision / ebit
        # Validasi rentang wajar tarif pajak (0% - 50%) untuk menghindari anomali data.
        if 0.0 <= computed_rate <= 0.5:
            tax_rate = computed_rate
        else:
            logger.warning(
                "Tax rate hasil hitung (%.2f%%) di luar rentang wajar, gunakan fallback %.0f%%.",
                computed_rate * 100,
                DEFAULT_CORPORATE_TAX_RATE * 100,
            )

    # --- Cash Flow Statement ---
    depreciation_amortization = _safe_get_row(
        cashflow,
        ["Depreciation And Amortization", "Depreciation Amortization Depletion", "Depreciation"],
        cf_col,
    )
    capital_expenditure_raw = _safe_get_row(
        cashflow, ["Capital Expenditure", "Purchase Of PPE"], cf_col
    )
    capital_expenditure = abs(capital_expenditure_raw) if capital_expenditure_raw is not None else None

    # --- Balance Sheet ---
    long_term_debt = _safe_get_row(
        balance_sheet, ["Long Term Debt", "Long Term Debt And Capital Lease Obligation"], bs_col
    )
    short_term_debt = _safe_get_row(
        balance_sheet,
        ["Current Debt", "Short Long Term Debt", "Current Debt And Capital Lease Obligation"],
        bs_col,
    )
    total_debt = None
    if long_term_debt is not None or short_term_debt is not None:
        total_debt = (long_term_debt or 0.0) + (short_term_debt or 0.0)

    cash_and_equivalents = _safe_get_row(
        balance_sheet,
        ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"],
        bs_col,
    )

    return {
        "revenue": revenue,
        "ebit": ebit,
        "tax_rate": tax_rate,
        "depreciation_amortization": depreciation_amortization,
        "capital_expenditure": capital_expenditure,
        "total_debt": total_debt,
        "cash_and_equivalents": cash_and_equivalents,
    }


# --------------------------------------------------------------------------
# Fungsi utama: fetch data fundamental dari yfinance
# --------------------------------------------------------------------------
def fetch_company_fundamentals(ticker_symbol: str) -> List[Dict[str, Any]]:
    """
    Menarik & mentransformasi data fundamental tahunan sebuah emiten IHSG
    dari Yahoo Finance menjadi parameter siap pakai untuk model DCF.

    Ticker input otomatis diberi suffix `.JK` (format Bursa Efek Indonesia
    pada Yahoo Finance), contoh: "ICBP" -> "ICBP.JK".

    Args:
        ticker_symbol: Kode saham tanpa suffix, contoh "ICBP", "INDF", "MYOR".

    Returns:
        List of dict, masing-masing merepresentasikan satu tahun fiskal:
        {
            "fiscal_year": int,
            "revenue": float | None,
            "ebit": float | None,
            "tax_rate": float,
            "depreciation_amortization": float | None,
            "capital_expenditure": float | None,
            "total_debt": float | None,
            "cash_and_equivalents": float | None,
        }
        Mengembalikan list kosong jika data tidak tersedia sama sekali.
    """
    normalized_ticker = ticker_symbol.strip().upper()
    if not normalized_ticker.endswith(IDX_TICKER_SUFFIX):
        yf_ticker_symbol = f"{normalized_ticker}{IDX_TICKER_SUFFIX}"
    else:
        yf_ticker_symbol = normalized_ticker

    logger.info("Menarik data fundamental untuk ticker: %s", yf_ticker_symbol)

    try:
        ticker = yf.Ticker(yf_ticker_symbol)
        financials = ticker.financials  # Income statement tahunan
        cashflow = ticker.cashflow  # Cash flow tahunan
        balance_sheet = ticker.balance_sheet  # Balance sheet tahunan
    except Exception as exc:  # noqa: BLE001 - yfinance bisa raise banyak jenis exception
        logger.error("Gagal menarik data dari yfinance untuk %s: %s", yf_ticker_symbol, exc)
        return []

    if financials is None or financials.empty:
        logger.warning("Data 'financials' kosong/tidak tersedia untuk %s.", yf_ticker_symbol)
        return []

    results: List[Dict[str, Any]] = []
    for fiscal_date in financials.columns:
        try:
            metrics = _extract_year_metrics(fiscal_date, financials, cashflow, balance_sheet)
            metrics["fiscal_year"] = int(pd.Timestamp(fiscal_date).year)
            results.append(metrics)
        except Exception as exc:  # noqa: BLE001 - jangan hentikan seluruh proses akibat 1 kolom
            logger.error(
                "Gagal mengekstrak metrik tahun %s untuk %s: %s", fiscal_date, yf_ticker_symbol, exc
            )
            continue

    logger.info(
        "Berhasil mengekstrak %d periode fiskal untuk %s.", len(results), yf_ticker_symbol
    )
    return results


# --------------------------------------------------------------------------
# Fungsi UPSERT ke database
# --------------------------------------------------------------------------
def upsert_financial_statement(
    db: Session,
    company_id: int,
    fiscal_year: int,
    metrics: Dict[str, Any],
) -> Optional[FinancialStatement]:
    """
    Melakukan UPSERT (update jika ada, insert jika belum ada) satu baris
    `FinancialStatement` berdasarkan kombinasi unik (company_id, fiscal_year).

    Transaksi bersifat atomik: commit hanya dilakukan jika seluruh proses
    berhasil, dan rollback otomatis dilakukan jika terjadi exception.

    Args:
        db: SQLAlchemy session aktif.
        company_id: ID perusahaan (FK ke tabel companies).
        fiscal_year: Tahun fiskal laporan keuangan.
        metrics: Dict hasil `fetch_company_fundamentals` untuk satu tahun.

    Returns:
        Instance `FinancialStatement` yang sudah tersimpan, atau None jika gagal.
    """
    try:
        existing_record: Optional[FinancialStatement] = (
            db.query(FinancialStatement)
            .filter(
                FinancialStatement.company_id == company_id,
                FinancialStatement.fiscal_year == fiscal_year,
            )
            .one_or_none()
        )

        field_names = (
            "revenue",
            "ebit",
            "tax_rate",
            "depreciation_amortization",
            "capital_expenditure",
            "total_debt",
            "cash_and_equivalents",
        )

        if existing_record is not None:
            for field in field_names:
                setattr(existing_record, field, metrics.get(field))
            record = existing_record
            logger.info(
                "UPDATE FinancialStatement company_id=%s fiscal_year=%s", company_id, fiscal_year
            )
        else:
            record = FinancialStatement(
                company_id=company_id,
                fiscal_year=fiscal_year,
                **{field: metrics.get(field) for field in field_names},
            )
            db.add(record)
            logger.info(
                "INSERT FinancialStatement company_id=%s fiscal_year=%s", company_id, fiscal_year
            )

        db.commit()
        db.refresh(record)
        return record

    except Exception as exc:  # noqa: BLE001 - simpan log detail lalu rollback
        db.rollback()
        logger.error(
            "Gagal UPSERT FinancialStatement company_id=%s fiscal_year=%s: %s",
            company_id,
            fiscal_year,
            exc,
        )
        return None


# --------------------------------------------------------------------------
# Orkestrasi: fetch + upsert untuk satu perusahaan
# --------------------------------------------------------------------------
def process_company_financials(db: Session, company: Company) -> int:
    """
    Menjalankan pipeline lengkap (fetch -> transform -> upsert) untuk satu
    perusahaan, mencakup seluruh periode fiskal yang tersedia dari yfinance.

    Args:
        db: SQLAlchemy session aktif.
        company: Instance `Company` yang akan diproses.

    Returns:
        Jumlah baris `FinancialStatement` yang berhasil di-upsert.
    """
    yearly_metrics = fetch_company_fundamentals(company.ticker)
    if not yearly_metrics:
        logger.warning("Tidak ada data fundamental yang didapat untuk %s.", company.ticker)
        return 0

    success_count = 0
    for metrics in yearly_metrics:
        fiscal_year = metrics.pop("fiscal_year")
        record = upsert_financial_statement(db, company.id, fiscal_year, metrics)
        if record is not None:
            success_count += 1

    return success_count


# --------------------------------------------------------------------------
# Job terjadwal: update seluruh emiten sektor Food & Beverage
# --------------------------------------------------------------------------
def scheduled_financial_update() -> None:
    """
    Job utama yang dijalankan oleh scheduler (APScheduler) secara berkala.

    Melakukan looping terhadap seluruh perusahaan dengan `sector`
    'Food & Beverage' pada tabel `Company`, menarik data fundamental
    terbaru dari Yahoo Finance, lalu meng-UPSERT hasilnya ke database.

    Diberikan jeda (`REQUEST_DELAY_SECONDS`) antar-emiten untuk menghindari
    rate-limit dari Yahoo Finance.
    """
    logger.info("=== Memulai scheduled_financial_update() ===")

    with get_db_session() as db:
        companies: List[Company] = (
            db.query(Company)
            .filter(Company.sector == "Food & Beverage", Company.is_active.is_(True))
            .all()
        )

        if not companies:
            logger.warning("Tidak ditemukan emiten sektor 'Food & Beverage' yang aktif.")
            return

        logger.info("Ditemukan %d emiten Food & Beverage untuk diproses.", len(companies))

        total_success = 0
        total_failed = 0

        for index, company in enumerate(companies, start=1):
            logger.info(
                "[%d/%d] Memproses emiten: %s (%s)",
                index,
                len(companies),
                company.ticker,
                company.name,
            )
            try:
                rows_updated = process_company_financials(db, company)
                if rows_updated > 0:
                    total_success += 1
                    logger.info(
                        "Sukses memproses %s: %d periode fiskal ter-update.",
                        company.ticker,
                        rows_updated,
                    )
                else:
                    total_failed += 1
                    logger.warning("Tidak ada data yang ter-update untuk %s.", company.ticker)
            except Exception as exc:  # noqa: BLE001 - satu emiten gagal tidak boleh hentikan loop
                total_failed += 1
                logger.error("Exception tak terduga saat memproses %s: %s", company.ticker, exc)

            # Hindari rate-limit Yahoo Finance dengan jeda antar-request.
            if index < len(companies):
                time.sleep(REQUEST_DELAY_SECONDS)

        logger.info(
            "=== scheduled_financial_update() selesai. Sukses: %d, Gagal: %d ===",
            total_success,
            total_failed,
        )
