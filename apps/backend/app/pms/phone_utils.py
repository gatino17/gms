from __future__ import annotations

from typing import Iterable


COUNTRY_PHONE_PRESETS: dict[str, dict[str, str]] = {
    "CHILE": {"prefix": "+56", "currency": "CLP"},
    "ARGENTINA": {"prefix": "+54", "currency": "ARS"},
    "PERU": {"prefix": "+51", "currency": "PEN"},
    "COLOMBIA": {"prefix": "+57", "currency": "COP"},
    "MEXICO": {"prefix": "+52", "currency": "MXN"},
    "ESTADOS UNIDOS": {"prefix": "+1", "currency": "USD"},
    "ESPANA": {"prefix": "+34", "currency": "EUR"},
}


def sanitize_phone_prefix(prefix: str | None) -> str:
    digits = "".join(ch for ch in (prefix or "") if ch.isdigit())
    return f"+{digits}" if digits else "+56"


def infer_phone_prefix(country: str | None, currency: str | None = None) -> str:
    normalized_country = (country or "").strip().upper()
    if normalized_country in COUNTRY_PHONE_PRESETS:
        return COUNTRY_PHONE_PRESETS[normalized_country]["prefix"]

    normalized_currency = (currency or "").strip().upper()
    for preset in COUNTRY_PHONE_PRESETS.values():
        if preset["currency"] == normalized_currency:
            return preset["prefix"]

    return "+56"


def resolve_tenant_phone_prefix(
    explicit_prefix: str | None,
    country: str | None,
    currency: str | None = None,
) -> str:
    if explicit_prefix and explicit_prefix.strip():
        return sanitize_phone_prefix(explicit_prefix)
    return infer_phone_prefix(country, currency)


def normalize_phone_value(
    phone: str | None,
    default_prefix: str | None = None,
    known_prefixes: Iterable[str] | None = None,
) -> str | None:
    raw = (phone or "").strip()
    if not raw:
        return None

    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None

    if raw.startswith("+"):
        return f"+{digits}"

    if digits.startswith("00") and len(digits) > 2:
        return f"+{digits[2:]}"

    if known_prefixes:
        for prefix in known_prefixes:
            prefix_digits = "".join(ch for ch in prefix if ch.isdigit())
            if prefix_digits and digits.startswith(prefix_digits):
                return f"+{digits}"

    prefix_digits = "".join(ch for ch in sanitize_phone_prefix(default_prefix) if ch.isdigit())
    if digits.startswith(prefix_digits):
        return f"+{digits}"

    if digits.startswith("0"):
        digits = digits[1:]

    return f"+{prefix_digits}{digits}"
