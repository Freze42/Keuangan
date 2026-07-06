"""
models.py
---------
Model SQLAlchemy ORM untuk aplikasi Automated DCF Stock Screener.

Tabel utama:
- `Company`             : Master data emiten (ticker, nama, sektor).
- `FinancialStatement`  : Data fundamental tahunan per emiten, hasil ekstraksi
                          dari yfinance, yang menjadi input parameter model DCF.
"""

from __future__ import annotations

import datetime as dt
from typing import List, Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Company(Base):
    """Master data emiten yang terdaftar di BEI (IHSG)."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    sector: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    financial_statements: Mapped[List["FinancialStatement"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover - representasi debug
        return f"<Company id={self.id} ticker={self.ticker} sector={self.sector}>"


class FinancialStatement(Base):
    """
    Data fundamental tahunan sebuah emiten, yang menjadi bahan baku
    perhitungan parameter DCF (Discounted Cash Flow):
      - Free Cash Flow to Firm (FCFF)
      - WACC (melalui Total Debt & Cash)
      - Terminal Value, dsb.
    """

    __tablename__ = "financial_statements"
    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_year", name="uq_company_fiscal_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    revenue: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ebit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tax_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    depreciation_amortization: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    capital_expenditure: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_debt: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cash_and_equivalents: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    company: Mapped["Company"] = relationship(back_populates="financial_statements")

    def __repr__(self) -> str:  # pragma: no cover - representasi debug
        return (
            f"<FinancialStatement company_id={self.company_id} "
            f"fiscal_year={self.fiscal_year} revenue={self.revenue}>"
        )
