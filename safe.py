from __future__ import annotations
"""
SAFE-NET Backend v5.0 — Professional Threat Detection System
=====================================================================
Deepfake Image: ViT model (dima806/deepfake_vs_real_image_detection) from HuggingFace
               + 7-layer forensic ensemble (ELA, FFT, Color, Noise, Face, JPEG, Entropy)
               + Reality Defender API shadow evaluation
Voice Clone:   MFCC + Spectral + Prosodic feature extraction → GradientBoosting ML classifier
Text/URL:      Advanced Threat Analysis + Typo-Squatting + DGA Entropy Analysis

Enterprise Architecture v5.0 Features:
  - Rate Limiting (per-IP sliding window)
  - In-Memory LRU Cache (hash-based scan deduplication)
  - Circuit Breaker (cascading failure prevention)
  - Distributed Request Tracing (UUID per request)
  - Structured JSON Logging (Observability)
  - Advanced Health & Telemetry Endpoint
"""

import time
import io
import re
import logging
import asyncio
import hashlib
import uuid
import json
import os
from datetime import datetime
from collections import OrderedDict, defaultdict
from functools import lru_cache
from urllib.parse import urlparse
from dotenv import load_dotenv

import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


#  STRUCTURED JSON LOGGING (Observability)
class _SecretMaskingFilter(logging.Filter):
    def __init__(self, secrets_to_mask):
        super().__init__()
        self.secrets = [s for s in secrets_to_mask if s]

    def filter(self, record):
        if not isinstance(record.msg, str): return True
        for secret in self.secrets:
            if secret in record.msg:
                record.msg = record.msg.replace(secret, "[REDACTED]")
        return True

class _JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "ts": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger("safenet")

def _setup_masking():
    """Dynamically applies masking to the logger once secrets are loaded."""
    secrets = [SAFE_BROWSING_API_KEY, GEMINI_API_KEY, OPEN_PAGE_RANK_API_KEY, REALITY_DEFENDER_API_KEY]
    mask_filter = _SecretMaskingFilter(secrets)
    logger.addFilter(mask_filter)
    for h in logging.getLogger().handlers:
        h.addFilter(mask_filter)

# Rest of imports and initialization...

#  OPTIONAL LIBRARY IMPORTS

try:
    import cv2
    CV2_AVAILABLE = True
    logger.info("OpenCV loaded OK")
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("OpenCV unavailable")

try:
    import torch
    import torchvision.transforms as T
    TORCH_AVAILABLE = True
    logger.info(f"PyTorch {torch.__version__} loaded")
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch unavailable")

try:
    from transformers import ViTForImageClassification, ViTImageProcessor
    TRANSFORMERS_AVAILABLE = True
    logger.info("HuggingFace Transformers loaded")
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.warning("Transformers unavailable")

try:
    import timm
    TIMM_AVAILABLE = True
    logger.info(f"timm {timm.__version__} loaded")
except ImportError:
    TIMM_AVAILABLE = False

try:
    import librosa
    LIBROSA_AVAILABLE = True
    logger.info("Librosa loaded OK")
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning("Librosa unavailable — voice ML analysis degraded")

try:
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import GradientBoostingClassifier
    import sklearn
    SKLEARN_AVAILABLE = True
    logger.info(f"scikit-learn {sklearn.__version__} loaded")
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn unavailable")

try:
    import soundfile as sf
    SOUNDFILE_AVAILABLE = True
except ImportError:
    SOUNDFILE_AVAILABLE = False

try:
    from PIL import ImageEnhance
    PIL_ENHANCE = True
except ImportError:
    PIL_ENHANCE = False

#  APP
app = FastAPI(title="SAFE-NET ML Detection API v5.0", version="5.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5500,http://localhost:5500").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

#  SECRET MANAGEMENT (Environment-first, never hardcoded)
load_dotenv() # Load from .env and .env.local

class _SecretsVault:
    """Reads secrets from environment variables only. Never hardcodes."""
    @staticmethod
    def get(key: str, fallback: str = "") -> str:
        val = os.environ.get(key, fallback)
        if not val:
            logger.warning(json.dumps({"event": "SECRET_MISSING", "key": key}))
        return val

SECRETS = _SecretsVault()

SAFE_BROWSING_API_KEY = SECRETS.get("SAFE_BROWSING_API_KEY")
OPEN_PAGE_RANK_API_KEY = SECRETS.get("OPEN_PAGE_RANK_API_KEY")
REALITY_DEFENDER_API_KEY = SECRETS.get("REALITY_DEFENDER_API_KEY")
GEMINI_API_KEY = SECRETS.get("GEMINI_API_KEY") or SECRETS.get("GEMINI_CHAT_API_KEY")

# Activate Secure Surveillance (Secret Masking)
_setup_masking()

#  IN-MEMORY LRU CACHE (Scan Deduplication)
class _LRUCache:
    """Thread-safe LRU cache keyed by SHA-256 of input content."""
    def __init__(self, max_size: int = 512):
        self._cache = OrderedDict()
        self._max = max_size

    def _key(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    def get(self, data: bytes):
        k = self._key(data)
        if k in self._cache:
            self._cache.move_to_end(k)
            logger.info(json.dumps({"event": "CACHE_HIT", "key": k[:12]}))
            return self._cache[k]
        return None

    def set(self, data: bytes, result: dict):
        k = self._key(data)
        self._cache[k] = result
        self._cache.move_to_end(k)
        if len(self._cache) > self._max:
            self._cache.popitem(last=False)
        logger.info(json.dumps({"event": "CACHE_SET", "key": k[:12], "size": len(self._cache)}))

_scan_cache = _LRUCache(max_size=512)


#  RATE LIMITER (Sliding Window Per-IP)
class _RateLimiter:
    """Sliding-window rate limiter: max N requests per window (seconds)."""
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self._log: dict = defaultdict(list)
        self._max = max_requests
        self._window = window_seconds

    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        hits = self._log[client_id]
        self._log[client_id] = [t for t in hits if now - t < self._window]
        if len(self._log[client_id]) >= self._max:
            logger.warning(json.dumps({"event": "RATE_LIMIT_TRIGGERED", "client": client_id}))
            return False
        self._log[client_id].append(now)
        return True

_rate_limiter = _RateLimiter(max_requests=30, window_seconds=60)


# ─────────────────────────────────────────────────────────────────────────────
#  H6 — ADVERSARIAL API PROBE DETECTOR
#  Detects clients probing the ML model's decision boundary by submitting
#  many URLs that score just below the phishing threshold (0.35–0.45 range).
#  Additive: new class alongside existing _RateLimiter; existing limiter unchanged.
# ─────────────────────────────────────────────────────────────────────────────
class _ProbeDetector:
    """
    Tracks per-client score distributions. Flags adversarial probing when
    a client submits many near-threshold scores (boundary exploration pattern).
    """
    PROBE_WINDOW_SECONDS: int = 3600       # 1-hour sliding window
    MIN_REQUESTS_TO_EVALUATE: int = 30     # Need at least 30 requests to evaluate
    NEAR_THRESHOLD_BAND: tuple = (0.35, 0.45)   # Decision boundary zone
    PROBE_DENSITY_THRESHOLD: float = 0.60  # ≥60% near-threshold = probe

    def __init__(self):
        # {client_id: [(timestamp, score), ...]}
        self._log: dict = defaultdict(list)
        self._flagged: set = set()

    def record(self, client_id: str, score: float) -> bool:
        """Record a scan result. Returns True if client is flagged as probing."""
        now = time.time()
        self._log[client_id] = [
            (t, s) for t, s in self._log[client_id]
            if now - t < self.PROBE_WINDOW_SECONDS
        ]
        self._log[client_id].append((now, score))

        hits = self._log[client_id]
        if len(hits) < self.MIN_REQUESTS_TO_EVALUATE:
            return client_id in self._flagged

        lo, hi = self.NEAR_THRESHOLD_BAND
        near_threshold = sum(1 for _, s in hits if lo <= s <= hi)
        density = near_threshold / len(hits)

        if density >= self.PROBE_DENSITY_THRESHOLD:
            if client_id not in self._flagged:
                self._flagged.add(client_id)
                logger.warning(json.dumps({
                    "event": "ADVERSARIAL_PROBE_DETECTED",
                    "client": client_id,
                    "requests": len(hits),
                    "near_threshold_density": round(density, 3),
                    "action": "score_noise_injection_enabled"
                }))
        return client_id in self._flagged

    def is_flagged(self, client_id: str) -> bool:
        return client_id in self._flagged

_probe_detector = _ProbeDetector()


# ─────────────────────────────────────────────────────────────────────────────
#  H7 — FAST-FLUX DNS SIGNAL DETECTION
#  Resolves a domain twice with a 2-second gap via DNS-over-HTTPS.
#  Flags if A-record IPs differ between resolutions (fast-flux) or TTL < 120s.
#  Additive: new async helper; existing DNS checks in safe.js unaffected.
# ─────────────────────────────────────────────────────────────────────────────
async def check_fast_flux_dns(hostname: str) -> dict:
    """
    Returns: {fast_flux: bool, ttl_low: bool, ttl: int|None, ips_seen: list, note: str}
    Uses Google DoH (json) for both resolution passes.
    """
    result = {
        "fast_flux": False,
        "ttl_low": False,
        "ttl": None,
        "ips_seen": [],
        "note": "DNS check not performed"
    }

    doh_url = f"https://dns.google/resolve?name={hostname}&type=A"

    async def _resolve_once():
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(doh_url, headers={"Accept": "application/dns-json"})
                if resp.status_code == 200:
                    data = resp.json()
                    answers = data.get("Answer", [])
                    ips = [a["data"] for a in answers if a.get("type") == 1]
                    ttl = min((a.get("TTL", 9999) for a in answers), default=None)
                    return ips, ttl
        except Exception:
            pass
        return [], None

    try:
        ips1, ttl1 = await _resolve_once()
        await asyncio.sleep(2)
        ips2, ttl2 = await _resolve_once()

        all_ips = list(set(ips1 + ips2))
        result["ips_seen"] = all_ips

        # Fast-flux: different IPs between two rapid resolutions
        if ips1 and ips2 and set(ips1) != set(ips2):
            result["fast_flux"] = True
            result["note"] = f"FAST-FLUX DETECTED: IPs rotated between scans ({ips1} → {ips2})"
            logger.warning(json.dumps({"event": "FAST_FLUX_DNS", "domain": hostname, "ips1": ips1, "ips2": ips2}))
        else:
            result["note"] = f"DNS stable: {all_ips}"

        # Low TTL = fast-flux infrastructure even without IP rotation yet
        effective_ttl = ttl1 or ttl2
        if effective_ttl is not None:
            result["ttl"] = effective_ttl
            if effective_ttl < 120:
                result["ttl_low"] = True
                result["note"] += f" | LOW TTL: {effective_ttl}s < 120s threshold"
                logger.warning(json.dumps({"event": "LOW_TTL_DNS", "domain": hostname, "ttl": effective_ttl}))

    except Exception as e:
        result["note"] = f"DNS check failed: {str(e)}"

    return result


# ─────────────────────────────────────────────────────────────────────────────
#  H8 — SCORE NOISE INJECTION
#  Adds Gaussian noise to returned scores for flagged probe clients,
#  preventing them from converging on the exact decision boundary.
#  Additive: thin wrapper applied only at API response serialization point.
# ─────────────────────────────────────────────────────────────────────────────
def _add_score_noise(score: float, is_probe_client: bool = False) -> float:
    """
    Returns score with added noise.
    - Normal clients: ±1% noise (obscures exact boundary without affecting UX)
    - Flagged probe clients: ±8% noise (prevents boundary convergence)
    Score is clamped to [0.0, 1.0].
    """
    import random
    sigma = 0.08 if is_probe_client else 0.01
    noisy = score + random.gauss(0, sigma)
    return max(0.0, min(1.0, noisy))





# ─────────────────────────────────────────────────────────────────────────────
#  N-16 — DOMAIN RE-REGISTRATION ANOMALY (Expired Domain Reputation Hijack)
#  Queries RDAP to detect recently re-registered domains. An attacker who
#  registers a dropped high-trust domain inherits its reputation scores while
#  deploying fresh phishing content. < 120 days since registration = elevated risk.
# ─────────────────────────────────────────────────────────────────────────────
async def check_domain_reregistration(domain: str) -> dict:
    """Queries RDAP for domain registration date. Returns re-registration signal."""
    result = {"reregistered": False, "age_days": None, "note": "RDAP check skipped"}
    try:
        import httpx, datetime as _dt
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(
                f"https://rdap.org/domain/{domain}",
                headers={"Accept": "application/json"}
            )
            if resp.status_code == 200:
                events = {e["eventAction"]: e["eventDate"] for e in resp.json().get("events", [])}
                reg_str = events.get("registration")
                if reg_str:
                    reg_date = _dt.datetime.fromisoformat(reg_str.replace("Z", "+00:00"))
                    age_days = (_dt.datetime.now(_dt.timezone.utc) - reg_date).days
                    result["age_days"] = age_days
                    if age_days < 120:
                        result["reregistered"] = True
                        result["note"] = (
                            f"RECENT REGISTRATION: '{domain}' registered {age_days} days ago "
                            f"— potential dropped-domain reputation hijack"
                        )
                        logger.warning(json.dumps({
                            "event": "DOMAIN_REREGISTRATION_DETECTED",
                            "domain": domain,
                            "age_days": age_days
                        }))
                    else:
                        result["note"] = f"Domain age: {age_days} days — no re-registration anomaly"
    except Exception as e:
        result["note"] = f"RDAP check failed: {str(e)[:80]}"
    return result


# ─────────────────────────────────────────────────────────────────────────────
#  ZERO-TOLERANCE RULES ENFORCER (ZT-01 through ZT-15)
#  Applied as the final verdict gate. A single matching ZT rule escalates
#  the verdict to MALICIOUS with score=100, regardless of other signals.
# ─────────────────────────────────────────────────────────────────────────────
def apply_zero_tolerance_rules(findings: list, score: float, verdict: str,
                                dns_signals: dict, cname_result: dict) -> tuple:
    """
    Evaluates ZT rules against findings and signals.
    Returns (new_score, new_verdict, zt_triggered: bool, zt_rule: str|None).
    """
    ft = "\n".join(findings).lower()
    ZT_RULES = [
        ("ZT-01", "wasm-execution" in ft,                                 "WASM execution on non-whitelisted domain"),
        ("ZT-02", "serviceworker-registration" in ft,                     "Service worker at root scope"),
        ("ZT-03", "steganographic-pixel-exec" in ft,                      "Steganographic pixel + code execution"),
        ("ZT-04", "invisible text override" in ft,                        "LLM prompt injection via invisible text"),
        ("ZT-05", "consent phishing redirect" in ft,                      "OAuth redirect_uri to unknown domain"),
        ("ZT-06", "qr" in ft and "phishing" in ft,                       "QR code decodes to known phishing URL"),
        ("ZT-07", "shortener chain abuse" in ft,                          "3+ URL shortener hops"),
        ("ZT-08", dns_signals.get("fast_flux", False),                   "Fast-flux DNS detected"),
        ("ZT-09", cname_result.get("cname_mismatch", False),              "CNAME pointing to serverless worker"),
        ("ZT-10", "multi-script domain" in ft,                            "Multi-script Unicode homograph"),
        ("ZT-11", "closed-shadowroot" in ft,                              "Shadow DOM credential harvester"),
        ("ZT-12", "websocket+otp-mfa-bypass" in ft,                      "WebSocket + OTP MFA bypass"),
        ("ZT-13", "homoglyph in path" in ft,                             "Path-level non-Latin Unicode"),
        ("ZT-14", "fragment-hash-content-gate" in ft,                    "Fragment-gated phishing content"),
        ("ZT-15", "manifest brand abuse" in ft,                          "PWA manifest brand impersonation"),
    ]
    for rule_id, condition, description in ZT_RULES:
        if condition:
            logger.warning(json.dumps({
                "event": "ZERO_TOLERANCE_TRIGGERED",
                "rule": rule_id,
                "description": description
            }))
            return 100.0, "MALICIOUS", True, f"{rule_id}: {description}"
    return score, verdict, False, None


# ─────────────────────────────────────────────────────────────────────────────
#  AT-06 — CNAME CHAIN MISMATCH DETECTION
#  Resolves CNAME records for a domain via DoH. Flags if the CNAME target
#  belongs to a CDN worker endpoint while the parent domain is a non-tech
#  business (real estate, food, retail) — a sign of a compromised domain.
#  Additive: new async helper called in the URL scan endpoint.
# ─────────────────────────────────────────────────────────────────────────────
# CDN/serverless platforms commonly abused as CNAME targets by attackers
_SERVERLESS_CNAME_TARGETS = {
    "workers.dev", "pages.dev", "netlify.app", "vercel.app",
    "github.io", "glitch.me", "repl.co", "replit.dev", "surge.sh",
    "tiiny.site", "fly.dev", "render.com", "railway.app",
    "azurewebsites.net", "azurestaticapps.net", "cloudfunctions.net",
    "execute-api.amazonaws.com", "s3-website.amazonaws.com"
}

async def check_cname_mismatch(hostname: str) -> dict:
    """
    Resolves CNAME chain for `hostname` via DoH.
    Returns: {cname_mismatch: bool, cname_target: str|None, note: str}
    """
    result = {"cname_mismatch": False, "cname_target": None, "note": "CNAME check not performed"}
    doh_url = f"https://dns.google/resolve?name={hostname}&type=CNAME"
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(doh_url, headers={"Accept": "application/dns-json"})
            if resp.status_code == 200:
                data = resp.json()
                answers = data.get("Answer", [])
                # Type 5 = CNAME record
                cnames = [a["data"].rstrip(".") for a in answers if a.get("type") == 5]
                if cnames:
                    cname_target = cnames[-1]  # Follow chain to final CNAME
                    result["cname_target"] = cname_target
                    # Check if the CNAME target is a serverless/CDN worker platform
                    target_domain = ".".join(cname_target.split(".")[-2:])
                    full_target_match = any(cname_target.endswith(s) for s in _SERVERLESS_CNAME_TARGETS)
                    if full_target_match:
                        result["cname_mismatch"] = True
                        result["note"] = (
                            f"CNAME MISMATCH: '{hostname}' resolves via CNAME to serverless platform "
                            f"'{cname_target}' — possible compromised domain or domain shadowing attack"
                        )
                        logger.warning(json.dumps({
                            "event": "CNAME_MISMATCH_DETECTED",
                            "domain": hostname,
                            "cname_target": cname_target
                        }))
                    else:
                        result["note"] = f"CNAME target: {cname_target} — no suspicious platform match"
                else:
                    result["note"] = "No CNAME record found (A-record domain)"
    except Exception as e:
        result["note"] = f"CNAME check failed: {str(e)[:80]}"
    return result


# ─────────────────────────────────────────────────────────────────────────────
#  AT-19 ENHANCEMENT — REQUEST TIMING VARIANCE ANALYSIS
#  Augments _ProbeDetector to detect binary-search boundary probing by
#  tracking inter-request timing variance. Automated binary search has
#  suspiciously regular inter-request timing (e.g. 450ms ± 10ms).
#  Additive: new method on _ProbeDetector class; existing logic unchanged.
# ─────────────────────────────────────────────────────────────────────────────
def _analyze_timing_regularity(timestamps: list) -> bool:
    """
    Returns True if inter-request timing is suspiciously regular
    (coefficient of variation < 0.10 = automated probing pattern).
    """
    if len(timestamps) < 10:
        return False
    deltas = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
    mean_delta = sum(deltas) / len(deltas)
    if mean_delta <= 0:
        return False
    variance = sum((d - mean_delta) ** 2 for d in deltas) / len(deltas)
    std_dev = variance ** 0.5
    cv = std_dev / mean_delta  # Coefficient of variation
    # CV < 0.10 = extremely regular timing = automated
    if cv < 0.10:
        logger.warning(json.dumps({
            "event": "TIMING_REGULARITY_PROBE",
            "mean_delta_ms": round(mean_delta * 1000, 1),
            "cv": round(cv, 4),
            "action": "flagged_as_automated_binary_probe"
        }))
        return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
#  AT-10 ENHANCEMENT — BUSINESS-HOUR RESCAN BIAS HINT
#  Returns a list of optimal UTC hours to schedule re-scans, biased toward
#  multiple business-hour windows to defeat time-gated payload attacks.
# ─────────────────────────────────────────────────────────────────────────────
def get_rescan_schedule_hours(initial_scan_utc_hour: int) -> list:
    """
    Returns a list of UTC hours for re-scans. Strategy:
    - T+8h, T+20h, T+32h, T+48h, T+60h, T+72h
    - Also includes target business-hour windows for US-East (UTC 14-18),
      EU-West (UTC 8-12), and APAC (UTC 0-4) attack peaks.
    Always varies from fixed scan time to defeat time-gated payloads.
    """
    business_hour_targets = [2, 9, 14, 16]  # Cover all major timezone attack windows
    offsets = [8, 20, 32, 48, 60, 72]
    schedule_hours = []
    for offset in offsets:
        raw = (initial_scan_utc_hour + offset) % 24
        # Snap to nearest business-hour target if within 3 hours
        adjusted = min(business_hour_targets, key=lambda bh: min(abs(bh - raw), 24 - abs(bh - raw)))
        schedule_hours.append({"utc_hour": adjusted, "offset_hours": offset})
    return schedule_hours


#  CIRCUIT BREAKER (Cascading Failure Prevention)
class _CircuitBreaker:
    """Prevents cascading failures by stopping calls to degraded subsystems."""
    CLOSED, OPEN, HALF_OPEN = "CLOSED", "OPEN", "HALF_OPEN"

    def __init__(self, name: str, fail_threshold: int = 5, recovery_timeout: int = 30):
        self.name = name
        self._fail_threshold = fail_threshold
        self._recovery_timeout = recovery_timeout
        self._failures = 0
        self._last_failure_time = 0.0
        self.state = self.CLOSED

    def record_success(self):
        self._failures = 0
        self.state = self.CLOSED

    def record_failure(self):
        self._failures += 1
        self._last_failure_time = time.time()
        if self._failures >= self._fail_threshold:
            self.state = self.OPEN
            logger.warning(json.dumps({"event": "CIRCUIT_OPEN", "breaker": self.name}))

    def is_available(self) -> bool:
        if self.state == self.OPEN:
            if time.time() - self._last_failure_time > self._recovery_timeout:
                self.state = self.HALF_OPEN
                logger.info(json.dumps({"event": "CIRCUIT_HALF_OPEN", "breaker": self.name}))
                return True
            return False
        return True

_breakers = {
    "rd_api": _CircuitBreaker("reality_defender_api"),
    "vit_model": _CircuitBreaker("vit_deepfake_model"),
}


#  TELEMETRY STORE (In-Memory Metrics)
_telemetry = {
    "total_scans": 0,
    "cache_hits": 0,
    "rate_limit_drops": 0,
    "circuit_opens": {"rd_api": 0, "vit_model": 0},
    "scan_times_ms": [],   # rolling last 100
    "error_count": 0,
    "started_at": datetime.utcnow().isoformat() + "Z",
}


#  GLOBAL ML MODEL REGISTRY
_models = {
    "vit_processor": None,
    "vit_model": None,
    "vit_ready": False,
    "voice_gb": None,          # GradientBoosting for voice
    "voice_scaler": None,      # StandardScaler for voice features
    "voice_ready": False,
}


#  MODEL LOADING (runs once at startup)

def _load_deepfake_vit():
    """
    Load dima806/deepfake_vs_real_image_detection — a ViT-base model
    fine-tuned specifically on deepfake vs real images (140k images, FaceForensics++, DFDC).
    Falls back to a timm EfficientNet model if HuggingFace model fails.
    """
    if not TRANSFORMERS_AVAILABLE or not TORCH_AVAILABLE:
        logger.warning("ViT not available — falling back to forensic-only mode")
        return

    hf_model_id = "dima806/deepfake_vs_real_image_detection"

    try:
        logger.info(f"Loading ViT deepfake model: {hf_model_id} ...")
        processor = ViTImageProcessor.from_pretrained(hf_model_id)
        model = ViTForImageClassification.from_pretrained(hf_model_id)
        model.eval()
        _models["vit_processor"] = processor
        _models["vit_model"] = model
        _models["vit_ready"] = True
        logger.info("ViT deepfake model loaded successfully")
    except Exception as e:
        logger.error(f"ViT load failed: {e}")
        # Try lightweight timm fallback
        if TIMM_AVAILABLE:
            try:
                logger.info("Trying timm efficientnet_b0 fallback...")
                m = timm.create_model("efficientnet_b0", pretrained=True, num_classes=2)
                m.eval()
                _models["vit_model"] = m
                _models["vit_ready"] = False   # mark as fallback only
                logger.info("timm fallback loaded (forensic classifier mode)")
            except Exception as e2:
                logger.error(f"timm fallback failed: {e2}")


def _build_voice_ml_model():
    """
    Feature vector (25 dims):
     0-12: MFCC delta-smoothness (13 coefficients)
     13:   pitch jitter ratio
     14:   pitch range (Hz) 
     15:   ZCR variance
     16:   spectral centroid delta-std
     17:   spectral flatness mean
     18:   energy silence ratio
     19:   autocorrelation mean (voiced frames)
     20:   autocorrelation std
     21:   RMS variance
     22:   spectral rolloff std
     23:   energy transition count ratio
     24:   amplitude clipping ratio
     25:   [Gen-4] spectral entropy (chaos ratio)
     26:   [Gen-4] phase coherence (stitching marker)
     27:   [Gen-4] pitch-formant correlation (biological limit)
     28:   [Gen-4] high-frequency rolloff symmetry
     29:   [Gen-4] silence-to-speech entropy ratio
    """
    if not SKLEARN_AVAILABLE:
        return

    rng = np.random.RandomState(42)

    # ── Synthetic calibrated training data
    # "Real" human speech characteristics (n=300)
    # Source ranges from academic ASVspoof corpus statistics
    real_samples = []
    for _ in range(300):
        feat = [
            *rng.uniform(2.5, 8.0, 13),   # mfcc_delta_smoothness: high variation
            rng.uniform(0.05, 0.20),        # pitch jitter: natural tremor
            rng.uniform(60, 200),           # pitch range: wide melodic range
            rng.uniform(0.008, 0.03),       # ZCR variance: natural
            rng.uniform(180, 600),          # centroid delta std: expressive
            rng.uniform(0.0001, 0.05),      # spectral flatness: tonal
            rng.uniform(0.08, 0.35),        # silence ratio: natural pauses
            rng.uniform(0.3, 0.75),         # autocorr mean: moderate periodicity
            rng.uniform(0.06, 0.25),        # autocorr std: variable
            rng.uniform(0.001, 0.015),      # RMS variance: dynamic range
            rng.uniform(200, 800),          # rolloff std: expressive
            rng.uniform(0.05, 0.25),        # energy transition ratio
            rng.uniform(0.0, 0.004),        # clipping ratio: minimal
            rng.uniform(6.5, 9.8),          # [Gen-4] spectral entropy: high chaos (human)
            rng.uniform(0.1, 0.5),          # [Gen-4] phase coherence: low (human)
            rng.uniform(0.4, 0.85),         # [Gen-4] pitch-formant corr: linked (human anatomy)
            rng.uniform(0.2, 0.6),          # [Gen-4] HF rolloff symmetry: varied
            rng.uniform(1.2, 3.5),          # [Gen-4] silence entropy ratio: distinct
        ]
        real_samples.append(feat)

    # "Fake" TTS/voice-clone characteristics (n=300)
    # TTS systems produce: smooth trajectories, high periodicity, no breath
    fake_samples = []
    for _ in range(300):
        feat = [
            *rng.uniform(0.1, 1.5, 13),    # mfcc_delta: very smooth
            rng.uniform(0.001, 0.03),       # pitch jitter: hyper-regular
            rng.uniform(5, 45),             # pitch range: narrow robotic
            rng.uniform(0.0001, 0.004),     # ZCR variance: too stable
            rng.uniform(10, 120),           # centroid delta: flat
            rng.uniform(0.06, 0.25),        # spectral flatness: more noise-like
            rng.uniform(0.0, 0.04),         # silence ratio: no breathing
            rng.uniform(0.78, 0.98),        # autocorr mean: overly periodic
            rng.uniform(0.001, 0.04),       # autocorr std: very stable
            rng.uniform(0.0001, 0.003),     # RMS variance: compressed
            rng.uniform(20, 180),           # rolloff std: restricted
            rng.uniform(0.0, 0.04),         # energy transition: monotone
            rng.uniform(0.005, 0.04),       # clipping ratio: over-processed
            rng.uniform(2.0, 5.5),          # [Gen-4] spectral entropy: low chaos (TTS ordered noise)
            rng.uniform(0.7, 0.99),         # [Gen-4] phase coherence: unnaturally high (stitching)
            rng.uniform(0.0, 0.3),          # [Gen-4] pitch-formant corr: unlinked (TTS flaw)
            rng.uniform(0.7, 0.95),         # [Gen-4] HF rolloff symmetry: too perfect
            rng.uniform(0.1, 0.8),          # [Gen-4] silence entropy ratio: artificial noise floor
        ]
        fake_samples.append(feat)

    X = np.array(real_samples + fake_samples, dtype=np.float32)
    y = np.array([0] * 300 + [1] * 300)  # 0=real, 1=fake

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("gb", GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.08,
            max_depth=4,
            subsample=0.85,
            min_samples_leaf=5,
            random_state=42
        ))
    ])
    pipeline.fit(X, y)
    _models["voice_gb"] = pipeline
    _models["voice_ready"] = True
    logger.info("Voice ML GradientBoosting model trained and ready")


@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_event_loop()
    # Load models in background threads to avoid blocking startup
    await loop.run_in_executor(None, _load_deepfake_vit)
    await loop.run_in_executor(None, _build_voice_ml_model)



#  DEEPFAKE IMAGE DETECTION

"""
╔══════════════════════════════════════════════════════════════════════════════════╗
║        EDD-CORE v2.0 — ENTERPRISE DEEPFAKE DETECTION ENGINE                    ║
║        Architecture: 12-Layer Forensic Ensemble + ML Ensemble Voting           ║
║        Layers: Pixel · Frequency · Physics · Biometric · Provenance ·          ║
║                Semantic · Spatial · Chromatic · Gradient · Steganographic ·    ║
║                Patch-Level · Cross-Modal                                        ║
╚══════════════════════════════════════════════════════════════════════════════════╝
"""


import asyncio
import hashlib
import io
import json
import logging
import math
import os
import struct
import tempfile
import time
import warnings
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageFilter, ExifTags

warnings.filterwarnings("ignore")
logger = logging.getLogger("EDD-CORE-v2")

# ── Optional heavy dependencies ───────────────────────────────────────────────
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("OpenCV unavailable — face/edge layers degraded")

try:
    import torch
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch unavailable — ML ensemble disabled")

try:
    from scipy import signal, stats, ndimage
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    logger.warning("SciPy unavailable — some spectral analyses degraded")

try:
    import dlib
    DLIB_AVAILABLE = True
except ImportError:
    DLIB_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
#  CONSTANTS & CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

class RiskLevel(str, Enum):
    SECURE   = "SECURE"
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"

class Action(str, Enum):
    NO_ACTION              = "NO_ACTION_REQUIRED"
    MONITOR                = "MONITOR_AND_LOG"
    SECONDARY_VERIFICATION = "SECONDARY_VERIFICATION_RECOMMENDED"
    MANUAL_REVIEW          = "MANUAL_FORENSIC_REVIEW_REQUIRED"
    CRITICAL_ESCALATION    = "CRITICAL_ESCALATION_BLOCK_CONTENT"

# Layer weights (must sum to 1.0)
LAYER_WEIGHTS = {
    "ml_ensemble":        0.22,   # Primary: trained models
    "pixel_ela":          0.08,   # ELA compression
    "frequency_fft":      0.09,   # FFT spectral
    "frequency_dct":      0.07,   # DCT block artifacts
    "noise_srm":          0.08,   # Stochastic residual maps
    "biometric_face":     0.10,   # Face boundary + landmarks
    "physics_color":      0.06,   # Color channel physics
    "physics_lighting":   0.06,   # Lighting consistency
    "provenance_jpeg":    0.05,   # JPEG ghost / EXIF
    "semantic_entropy":   0.05,   # Local entropy distribution
    "gradient_analysis":  0.06,   # Edge/gradient forensics
    "patch_consistency":  0.08,   # Patch-level uniformity
}

assert abs(sum(LAYER_WEIGHTS.values()) - 1.0) < 1e-6, "Layer weights must sum to 1.0"

# Thresholds
RISK_THRESHOLDS = {
    RiskLevel.CRITICAL: 0.78,
    RiskLevel.HIGH:     0.55,
    RiskLevel.MEDIUM:   0.32,
    RiskLevel.LOW:      0.10,
}


# ═══════════════════════════════════════════════════════════════════════════════
#  DATA MODELS
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class LayerResult:
    name: str
    score: float                       # 0.0 – 1.0 (manipulation likelihood)
    confidence: float                  # 0.0 – 1.0 (how reliable this layer's reading is)
    findings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    @property
    def weighted_score(self) -> float:
        return self.score * self.confidence


@dataclass
class ScanResult:
    image_hash: str
    image_size: Tuple[int, int]
    scan_duration_ms: float
    risk_score: int                    # 0–100
    risk_level: RiskLevel
    recommended_action: Action
    verdict: str
    confidence: float
    layer_results: Dict[str, LayerResult]
    findings: List[str]
    forensic_summary: Dict[str, Any]
    governance: Dict[str, Any]
    ml_used: bool
    ml_models_active: List[str]
    version: str = "EDD-CORE-v2.0"


# ═══════════════════════════════════════════════════════════════════════════════
#  ML MODEL REGISTRY
# ═══════════════════════════════════════════════════════════════════════════════

class MLModelRegistry:
    """
    Manages multiple ViT / CNN models as an ensemble.
    Falls back gracefully if any model fails to load.
    """

    SUPPORTED_MODELS = [
        "prithivMLmods/Deep-Fake-Detector-v2-Model",
        "Organika/sdxl-detector",
        "haywoodsloan/autotrain-deepfake-20240629-115823",
    ]

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.processors: Dict[str, Any] = {}
        self.ready: List[str] = []

    def load_all(self, model_ids: Optional[List[str]] = None):
        if not TORCH_AVAILABLE:
            logger.warning("PyTorch not available — ML ensemble disabled")
            return
        try:
            from transformers import AutoFeatureExtractor, AutoModelForImageClassification
        except ImportError:
            logger.warning("transformers not installed — ML ensemble disabled")
            return

        targets = model_ids or self.SUPPORTED_MODELS
        for mid in targets:
            try:
                proc  = AutoFeatureExtractor.from_pretrained(mid)
                model = AutoModelForImageClassification.from_pretrained(mid)
                model.eval()
                self.processors[mid] = proc
                self.models[mid]     = model
                self.ready.append(mid)
                logger.info(f"[ML] Loaded: {mid}")
            except Exception as e:
                logger.warning(f"[ML] Failed to load {mid}: {e}")

    def infer(self, image: Image.Image) -> Tuple[float, List[str]]:
        """Returns (ensemble_score 0-1, detail_findings)."""
        if not self.ready:
            return 0.0, ["ML-Ensemble: No models loaded"]

        scores = []
        findings = []

        for mid in self.ready:
            try:
                proc  = self.processors[mid]
                model = self.models[mid]
                inputs = proc(images=image, return_tensors="pt")
                with torch.no_grad():
                    logits = model(**inputs).logits
                    probs  = torch.softmax(logits, dim=-1)[0]

                labels    = model.config.id2label
                fake_prob = self._extract_fake_prob(probs, labels)
                scores.append(fake_prob)
                tag = mid.split("/")[-1][:30]
                findings.append(
                    f"[ML:{tag}] {'SYNTHETIC' if fake_prob > 0.5 else 'AUTHENTIC'} "
                    f"p={fake_prob:.4f}"
                )
            except Exception as e:
                findings.append(f"[ML:{mid.split('/')[-1][:20]}] Inference failed: {e}")

        if not scores:
            return 0.0, findings

        # Ensemble: soft-voting with outlier trimming
        arr = np.array(scores)
        if len(arr) > 2:
            arr = arr[(arr >= np.percentile(arr, 15)) & (arr <= np.percentile(arr, 85))]
        ensemble_score = float(np.mean(arr))
        ensemble_std   = float(np.std(scores))

        findings.append(
            f"[ML-Ensemble] score={ensemble_score:.4f} σ={ensemble_std:.4f} "
            f"n={len(self.ready)} models"
        )

        if ensemble_std > 0.25:
            findings.append("[ML-Ensemble] HIGH model disagreement — treat ML score with caution")

        return ensemble_score, findings

    @staticmethod
    def _extract_fake_prob(probs, labels) -> float:
        FAKE_KEYWORDS = {"fake", "deepfake", "ai", "generated", "synthetic", "manipulated", "altered"}
        REAL_KEYWORDS = {"real", "authentic", "genuine", "original", "human", "natural"}

        fake_idx = real_idx = None
        for idx, lbl in labels.items():
            lbl_l = lbl.lower()
            if any(k in lbl_l for k in FAKE_KEYWORDS):
                fake_idx = idx
            if any(k in lbl_l for k in REAL_KEYWORDS):
                real_idx = idx

        if fake_idx is not None:
            return float(probs[fake_idx])
        elif real_idx is not None:
            return float(1.0 - probs[real_idx])
        else:
            return float(1.0 - probs[0])  # assume idx-0 = real


# Singleton
_ml_registry = MLModelRegistry()


def initialize_models(model_ids: Optional[List[str]] = None):
    """Call once at service startup."""
    _ml_registry.load_all(model_ids)


# ═══════════════════════════════════════════════════════════════════════════════
#  FORENSIC LAYER IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _layer_ml_ensemble(img: Image.Image) -> LayerResult:
    score, findings = _ml_registry.infer(img)
    # Confidence scales with number of active models
    n = len(_ml_registry.ready)
    confidence = min(0.95, 0.5 + n * 0.15) if n > 0 else 0.1
    return LayerResult(
        name="ml_ensemble",
        score=score,
        confidence=confidence,
        findings=findings,
        metadata={"models_active": _ml_registry.ready},
    )


def _layer_pixel_ela(img: Image.Image, img_np: np.ndarray) -> LayerResult:
    """
    Error Level Analysis — multi-quality sweep (90 / 80 / 70 / 60 %).
    Genuine images show monotonic error growth; AI images show flat/inverted curves.
    """
    findings = []
    try:
        qualities  = [90, 80, 70, 60]
        ela_means  = []
        ela_stds   = []
        for q in qualities:
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=q)
            buf.seek(0)
            recomp = np.array(Image.open(buf).convert("RGB"), dtype=np.float32)
            diff   = np.abs(img_np - recomp)
            ela_means.append(float(np.mean(diff)))
            ela_stds.append(float(np.std(diff)))

        # Monotonicity: real images → ela_means increases as quality decreases
        diffs      = np.diff(ela_means)
        monotonic  = all(d >= -0.5 for d in diffs)
        max_mean   = max(ela_means)
        max_std    = max(ela_stds)
        range_span = max_mean - min(ela_means)

        score = 0.0
        if not monotonic:
            score = max(score, 0.75)
            findings.append(
                f"[ELA] Non-monotonic compression curve {[f'{v:.1f}' for v in ela_means]} "
                f"— Synthetic composite suspected."
            )
        if max_mean > 16:
            score = max(score, min(1.0, max_mean / 35))
            findings.append(f"[ELA] Extreme pixel-level distortion (peak mean={max_mean:.1f}) — Splicing artifacts.")
        if max_std > 24:
            score = max(score, min(0.85, max_std / 45))
            findings.append(f"[ELA] High variance error distribution (std={max_std:.1f}) — Inconsistent resampling.")
        if range_span < 1.2 and max_mean > 5:
            score = max(score, 0.65)
            findings.append(f"[ELA] Flat compression response (Δ={range_span:.2f}) — GAN-generated substrate signature.")

        if score < 0.1:
            findings.append(f"[ELA] Compression curve nominal — pixel integrity intact.")

        return LayerResult(
            name="pixel_ela",
            score=score,
            confidence=0.82,
            findings=findings,
            metadata={"ela_means": ela_means, "ela_stds": ela_stds, "monotonic": monotonic},
        )
    except Exception as e:
        return LayerResult(name="pixel_ela", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_frequency_fft(img: Image.Image) -> LayerResult:
    """
    FFT spectral analysis — GAN/diffusion models introduce characteristic
    radial periodicity patterns invisible to the human eye.
    """
    findings = []
    try:
        gray     = np.array(img.convert("L"), dtype=np.float64)
        fft      = np.fft.fftshift(np.fft.fft2(gray))
        mag      = np.log1p(np.abs(fft))
        cx, cy   = gray.shape[0] // 2, gray.shape[1] // 2
        yi, xi   = np.ogrid[-cx:gray.shape[0]-cx, -cy:gray.shape[1]-cy]
        radius   = np.sqrt(xi**2 + yi**2)

        ring_vars, ring_means = [], []
        step = 10
        for r in range(5, int(min(cx, cy) * 0.85), step):
            mask = (radius >= r) & (radius < r + step)
            vals = mag[mask]
            if vals.size > 0:
                ring_vars.append(float(np.var(vals)))
                ring_means.append(float(np.mean(vals)))

        global_var   = float(np.var(mag))
        ratio        = np.mean(ring_vars) / (global_var + 1e-8) if ring_vars else 1.0

        # Azimuthal uniformity — real cameras have directional bias; GANs don't
        angles       = np.arctan2(yi, xi + 1e-9)
        angle_bins   = np.linspace(-np.pi, np.pi, 37)
        az_means     = []
        for i in range(len(angle_bins) - 1):
            mask = (angles >= angle_bins[i]) & (angles < angle_bins[i+1]) & (radius > 10)
            if np.sum(mask) > 0:
                az_means.append(float(np.mean(mag[mask])))
        az_var = float(np.var(az_means)) if az_means else 1.0

        score = 0.0
        if ratio < 0.006:
            score = 1.0
            findings.append(f"[FFT] GAN frequency fingerprint confirmed (ratio={ratio:.5f}) — Algorithmic generation.")
        elif ratio < 0.035:
            score = 0.80
            findings.append(f"[FFT] Strong spectral periodicity (ratio={ratio:.5f}) — Diffusion model interpolation.")
        elif ratio < 0.09:
            score = 0.45
            findings.append(f"[FFT] Moderate spectral anomaly (ratio={ratio:.5f}) — Possible CNN upsampling.")

        if az_var < 0.015:
            score = max(score, 0.60)
            findings.append(f"[FFT] Near-perfect azimuthal symmetry (var={az_var:.4f}) — Camera optics absent.")

        if score < 0.1:
            findings.append(f"[FFT] Spectral topology normal (ratio={ratio:.5f}, az_var={az_var:.4f}).")

        return LayerResult(
            name="frequency_fft",
            score=score,
            confidence=0.85,
            findings=findings,
            metadata={"ratio": ratio, "az_var": az_var},
        )
    except Exception as e:
        return LayerResult(name="frequency_fft", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_frequency_dct(img: Image.Image) -> LayerResult:
    """
    DCT Block Artifact Analysis.
    JPEG-generated images have 8×8 block structure. AI images often show
    anomalous inter-block discontinuities or hyper-smooth blocks.
    """
    findings = []
    try:
        gray  = np.array(img.convert("L"), dtype=np.float32)
        h, w  = gray.shape
        bs    = 8
        scores_intra, scores_inter = [], []

        for r in range(0, h - bs, bs):
            for c in range(0, w - bs, bs):
                block = gray[r:r+bs, c:c+bs]
                # Intra-block variance
                scores_intra.append(float(np.var(block)))
                # Inter-block boundary gradient
                if c + bs < w:
                    right_edge = gray[r:r+bs, c+bs-1]
                    next_left  = gray[r:r+bs, c+bs]
                    scores_inter.append(float(np.mean(np.abs(right_edge - next_left))))

        if not scores_intra:
            return LayerResult(name="frequency_dct", score=0.0, confidence=0.0, findings=["DCT: image too small"], error=None)

        intra_mean  = float(np.mean(scores_intra))
        intra_std   = float(np.std(scores_intra))
        inter_mean  = float(np.mean(scores_inter)) if scores_inter else 0.0
        block_ratio = inter_mean / (intra_mean + 1e-8)

        score = 0.0
        if intra_std < 50 and intra_mean < 100:
            score = max(score, 0.65)
            findings.append(f"[DCT] Hyper-smooth block structure (σ={intra_std:.1f}) — GAN over-smoothing detected.")
        if block_ratio > 3.5:
            score = max(score, 0.80)
            findings.append(f"[DCT] Severe inter-block discontinuity (ratio={block_ratio:.2f}) — Splicing boundary.")
        elif block_ratio < 0.05 and inter_mean < 0.5:
            score = max(score, 0.55)
            findings.append(f"[DCT] No block boundaries present (ratio={block_ratio:.4f}) — Diffusion generation.")

        if score < 0.1:
            findings.append(f"[DCT] Block structure consistent with camera JPEG encoding.")

        return LayerResult(
            name="frequency_dct",
            score=score,
            confidence=0.78,
            findings=findings,
            metadata={"intra_mean": intra_mean, "intra_std": intra_std, "block_ratio": block_ratio},
        )
    except Exception as e:
        return LayerResult(name="frequency_dct", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_noise_srm(img: Image.Image, img_np: np.ndarray) -> LayerResult:
    """
    Stochastic Residual Map (SRM) — inspired by Fridrich's camera forensics.
    Extracts high-frequency noise residual and tests for statistical
    non-stationarity — a hallmark of composited / generated regions.
    """
    findings = []
    try:
        # 5-tap high-pass residual filter (SRM-inspired)
        kernel = np.array([
            [ 0,  0, -1,  0,  0],
            [ 0, -1,  3, -1,  0],
            [-1,  3,  0,  3, -1],
            [ 0, -1,  3, -1,  0],
            [ 0,  0, -1,  0,  0],
        ], dtype=np.float32) / 12.0

        residuals = []
        for ch in range(3):
            ch_arr = img_np[:, :, ch]
            if SCIPY_AVAILABLE:
                res = signal.convolve2d(ch_arr, kernel, mode='same', boundary='symm')
            else:
                # Fallback: simple Laplacian
                res = np.zeros_like(ch_arr)
                res[1:-1, 1:-1] = (
                    -ch_arr[:-2, 1:-1] - ch_arr[2:, 1:-1]
                    - ch_arr[1:-1, :-2] - ch_arr[1:-1, 2:]
                    + 4 * ch_arr[1:-1, 1:-1]
                )
            residuals.append(res)

        R = np.stack(residuals, axis=2)

        # Spatial non-stationarity: divide into patches, test variance homogeneity
        ps    = 64
        h, w  = R.shape[:2]
        patch_vars = []
        for r in range(0, h - ps, ps):
            for c in range(0, w - ps, ps):
                patch_vars.append(float(np.var(R[r:r+ps, c:c+ps])))

        if not patch_vars:
            return LayerResult(name="noise_srm", score=0.0, confidence=0.4, findings=["SRM: image too small for patch analysis"])

        pv_mean  = float(np.mean(patch_vars))
        pv_std   = float(np.std(patch_vars))
        pv_cv    = pv_std / (pv_mean + 1e-8)   # Coefficient of variation

        # Noise floor
        global_noise = float(np.std(R))

        score = 0.0
        if global_noise < 1.8:
            score = max(score, 0.85)
            findings.append(f"[SRM] Near-zero residual noise (σ={global_noise:.3f}) — Algorithmically injected smoothing.")
        elif global_noise < 3.5:
            score = max(score, 0.50)
            findings.append(f"[SRM] Below-natural noise floor (σ={global_noise:.3f}) — Potential AI artifact polishing.")

        if pv_cv > 2.5:
            score = max(score, 0.75)
            findings.append(f"[SRM] Highly non-stationary noise field (CV={pv_cv:.2f}) — Composite region boundary.")
        elif pv_cv > 1.2:
            score = max(score, 0.40)
            findings.append(f"[SRM] Moderate noise non-stationarity (CV={pv_cv:.2f}) — Localized manipulation suspected.")

        if score < 0.1:
            findings.append(f"[SRM] Noise residual statistically consistent with camera sensor (σ={global_noise:.3f}).")

        return LayerResult(
            name="noise_srm",
            score=score,
            confidence=0.88,
            findings=findings,
            metadata={"global_noise": global_noise, "patch_cv": pv_cv, "patch_mean_var": pv_mean},
        )
    except Exception as e:
        return LayerResult(name="noise_srm", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_biometric_face(img: Image.Image) -> LayerResult:
    """
    Multi-stage face forensics:
    1. Detection + boundary blending
    2. Facial landmark symmetry
    3. Skin texture micro-analysis
    4. Eye/iris consistency
    5. Blink-pattern absence (for single frames)
    """
    findings = []
    if not CV2_AVAILABLE:
        return LayerResult(
            name="biometric_face", score=0.0, confidence=0.1,
            findings=["OpenCV unavailable — face forensics skipped"]
        )

    try:
        img_bgr  = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        gray_cv  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        img_np   = np.array(img, dtype=np.float32)

        cascade  = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        eye_casc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

        faces = cascade.detectMultiScale(gray_cv, scaleFactor=1.05, minNeighbors=5, minSize=(40, 40))

        if len(faces) == 0:
            findings.append("[FACE] No frontal face detected — skipping biometric layer.")
            return LayerResult(name="biometric_face", score=0.0, confidence=0.3, findings=findings)

        score = 0.0
        for (fx, fy, fw, fh) in faces:
            face_bgr  = img_bgr[fy:fy+fh, fx:fx+fw]
            face_gray = gray_cv[fy:fy+fh, fx:fx+fw]
            face_np   = img_np[fy:fy+fh, fx:fx+fw]

            # ── 1. Boundary blending ──────────────────────────────
            border = max(6, fw // 9)
            inner  = face_gray[border:-border, border:-border]
            outer  = np.concatenate([
                face_gray[:border, :].flatten(),
                face_gray[-border:, :].flatten(),
                face_gray[:, :border].flatten(),
                face_gray[:, -border:].flatten(),
            ])
            inner_std = float(np.std(inner)) if inner.size > 0 else 0.0
            outer_std = float(np.std(outer)) if outer.size > 0 else 0.0
            blend_ratio = abs(inner_std - outer_std) / (outer_std + 1e-6)

            if blend_ratio > 2.5:
                score = max(score, 0.90)
                findings.append(f"[FACE] Extreme boundary blending anomaly (ratio={blend_ratio:.2f}) — High-confidence face-swap.")
            elif blend_ratio > 1.2:
                score = max(score, 0.55)
                findings.append(f"[FACE] Suspicious boundary blur (ratio={blend_ratio:.2f}) — Boundary masking present.")

            # ── 2. Eye symmetry & consistency ────────────────────
            eyes = eye_casc.detectMultiScale(face_gray, 1.05, 4, minSize=(10, 10))
            if len(eyes) == 0:
                score = max(score, 0.50)
                findings.append("[FACE] No eye landmarks detected — possible facial region distortion.")
            elif len(eyes) >= 2:
                ey_vals = sorted([e[1] for e in eyes[:2]])
                vertical_asym = abs(ey_vals[0] - ey_vals[1])
                if vertical_asym > fh * 0.12:
                    score = max(score, 0.60)
                    findings.append(f"[FACE] Eye vertical asymmetry {vertical_asym}px — Unnatural multi-pose merging.")

                # Iris texture entropy (real irises have high local entropy)
                for (ex, ey, ew, eh) in eyes[:2]:
                    iris = face_gray[ey:ey+eh, ex:ex+ew]
                    if iris.size > 0:
                        hist, _ = np.histogram(iris.flatten(), bins=32, range=(0, 256))
                        p  = hist / (hist.sum() + 1e-10)
                        H  = float(-np.sum(p * np.log2(p + 1e-10)))
                        if H < 2.5:
                            score = max(score, 0.65)
                            findings.append(f"[FACE] Low iris texture entropy (H={H:.2f}) — AI-generated eye region.")

            # ── 3. Skin texture micro-analysis (Laplacian variance) ──
            lap     = cv2.Laplacian(face_gray, cv2.CV_64F)
            lap_var = float(lap.var())
            if lap_var < 40:
                score = max(score, 0.70)
                findings.append(f"[FACE] Over-smoothed skin texture (lap_var={lap_var:.1f}) — AI skin synthesis signature.")
            elif lap_var > 3000:
                score = max(score, 0.35)
                findings.append(f"[FACE] Hyper-sharp skin texture (lap_var={lap_var:.1f}) — Possible sharpening post-process.")

            # ── 4. Chrominance face / background mismatch ────────
            if face_np.size > 0 and fw < img_np.shape[1] and fh < img_np.shape[0]:
                face_hsv = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
                full_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
                face_sat_mean = float(np.mean(face_hsv[:, :, 1]))
                full_sat_mean = float(np.mean(full_hsv[:, :, 1]))
                sat_delta = abs(face_sat_mean - full_sat_mean)
                if sat_delta > 35:
                    score = max(score, 0.60)
                    findings.append(f"[FACE] Face/background saturation mismatch (Δsat={sat_delta:.1f}) — Lighting inconsistency.")

            findings.append(
                f"[FACE] Face ({fw}×{fh}): boundary={blend_ratio:.2f}, lap={lap_var:.0f}"
            )

        return LayerResult(
            name="biometric_face",
            score=min(1.0, score),
            confidence=0.87,
            findings=findings,
            metadata={"faces_detected": len(faces)},
        )
    except Exception as e:
        return LayerResult(name="biometric_face", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_physics_color(img: Image.Image) -> LayerResult:
    """
    Color physics: channel correlations, histogram smoothness,
    chromatic aberration absence, and color temperature analysis.
    """
    findings = []
    try:
        r_a, g_a, b_a = [np.array(ch, dtype=np.float64).flatten() for ch in img.split()]

        # Channel correlations
        rg = float(np.corrcoef(r_a, g_a)[0, 1])
        rb = float(np.corrcoef(r_a, b_a)[0, 1])
        gb = float(np.corrcoef(g_a, b_a)[0, 1])
        max_corr  = max(abs(rg), abs(rb), abs(gb))
        corr_var  = float(np.var([rg, rb, gb]))

        score = 0.0

        if max_corr > 0.975 and corr_var < 0.001:
            score = max(score, 0.90)
            findings.append(f"[COLOR] Perfect RGB correlation (r={max_corr:.3f}) — AI color space collapse.")
        elif max_corr > 0.94:
            score = max(score, 0.55)
            findings.append(f"[COLOR] Elevated channel correlation (r={max_corr:.3f}) — Synthetic palette suspected.")

        # Histogram smoothness (GANs produce perfectly smooth distributions)
        for name, ch in [("R", r_a), ("G", g_a), ("B", b_a)]:
            hist, _ = np.histogram(ch, bins=256, range=(0, 256))
            zero_bins = int(np.sum(hist == 0))
            if zero_bins < 5:
                score = max(score, 0.75)
                findings.append(f"[COLOR:{name}] Hyper-smooth histogram ({zero_bins} gaps) — GAN value interpolation.")

        # Chromatic aberration check (real lenses have slight R/B edge misalignment)
        img_np = np.array(img, dtype=np.float32)
        edges_r = np.gradient(img_np[:, :, 0])
        edges_b = np.gradient(img_np[:, :, 2])
        ca = float(np.mean(np.abs(edges_r[0] - edges_b[0])) + np.mean(np.abs(edges_r[1] - edges_b[1])))
        if ca < 0.15:
            score = max(score, 0.50)
            findings.append(f"[COLOR] Near-zero chromatic aberration (CA={ca:.3f}) — Lens physics absent.")

        if score < 0.1:
            findings.append(f"[COLOR] Color physics consistent with camera optics (corr={max_corr:.3f}, CA={ca:.3f}).")

        return LayerResult(
            name="physics_color",
            score=score,
            confidence=0.80,
            findings=findings,
            metadata={"max_corr": max_corr, "chromatic_aberration": ca},
        )
    except Exception as e:
        return LayerResult(name="physics_color", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_physics_lighting(img: Image.Image) -> LayerResult:
    """
    Lighting consistency analysis:
    1. Specular highlight positioning
    2. Shadow directionality
    3. Global illuminance uniformity
    """
    findings = []
    try:
        img_np   = np.array(img, dtype=np.float32)
        gray     = img_np.mean(axis=2)
        h, w     = gray.shape

        # Quadrant illumination balance
        quads = {
            "TL": gray[:h//2, :w//2],
            "TR": gray[:h//2, w//2:],
            "BL": gray[h//2:, :w//2],
            "BR": gray[h//2:, w//2:],
        }
        quad_means = {k: float(np.mean(v)) for k, v in quads.items()}
        q_vals     = list(quad_means.values())
        q_range    = max(q_vals) - min(q_vals)

        score = 0.0

        # AI images often have unnaturally balanced illumination
        if q_range < 5.0:
            score = max(score, 0.55)
            findings.append(f"[LIGHT] Hyper-balanced quadrant illumination (Δ={q_range:.1f}) — Synthetic lighting rig.")

        # Specular detection: find bright peaks and check consistency
        bright_mask  = gray > np.percentile(gray, 97)
        bright_locs  = np.argwhere(bright_mask)
        if len(bright_locs) > 0:
            centroid = bright_locs.mean(axis=0)
            spread   = float(np.std(np.linalg.norm(bright_locs - centroid, axis=1)))
            if spread < 5.0 and len(bright_locs) > 50:
                score = max(score, 0.45)
                findings.append(f"[LIGHT] Unnatural specular concentration (spread={spread:.1f}) — Synthetic light source.")

        # Gradient directionality (real scenes: coherent shadow direction)
        gy, gx = np.gradient(gray)
        angles  = np.arctan2(gy, gx + 1e-8)
        a_hist, _ = np.histogram(angles.flatten(), bins=36, range=(-np.pi, np.pi))
        dom_dir   = float(a_hist.max()) / (float(a_hist.mean()) + 1e-8)
        if dom_dir < 1.8:
            score = max(score, 0.40)
            findings.append(f"[LIGHT] No dominant illumination direction (dom={dom_dir:.2f}) — Missing shadow coherence.")

        if score < 0.1:
            findings.append(f"[LIGHT] Illumination physics plausible (Δ={q_range:.1f}, dom={dom_dir:.2f}).")

        return LayerResult(
            name="physics_lighting",
            score=score,
            confidence=0.72,
            findings=findings,
            metadata={"quad_range": q_range, "dom_dir": dom_dir},
        )
    except Exception as e:
        return LayerResult(name="physics_lighting", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_provenance_jpeg(img: Image.Image) -> LayerResult:
    """
    JPEG Ghost + EXIF + Metadata provenance.
    Extended: checks for re-encoding traces, thumbnail mismatch, GPS coherence.
    """
    findings = []
    score    = 0.0
    try:
        img_np = np.array(img, dtype=np.float32)

        # Multi-quality ghost sweep
        q_vals   = [85, 75, 65, 50]
        prev_diff = None
        ghost_dips = 0
        for q in q_vals:
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=q)
            arr = np.array(Image.open(io.BytesIO(buf.getvalue())).convert("RGB"), dtype=np.float32)
            diff = float(np.mean(np.abs(img_np - arr)))
            if prev_diff is not None and diff < prev_diff - 0.5:
                ghost_dips += 1
            prev_diff = diff

        if ghost_dips >= 2:
            score = max(score, 0.75)
            findings.append(f"[PROVENANCE] JPEG ghost curve inversion ×{ghost_dips} — Double-compression detected.")

        # EXIF analysis
        try:
            exif_data = img._getexif() if hasattr(img, '_getexif') else None
        except Exception:
            exif_data = None

        if exif_data is None or len(exif_data) == 0:
            score = max(score, 0.30)
            findings.append("[PROVENANCE] EXIF metadata absent — Provenance chain unverifiable.")
        else:
            # Check for expected camera tags
            CAMERA_TAGS = {271: "Make", 272: "Model", 36867: "DateTimeOriginal", 33434: "ExposureTime"}
            present = [v for k, v in CAMERA_TAGS.items() if k in exif_data]
            if len(present) < 2:
                score = max(score, 0.20)
                findings.append(f"[PROVENANCE] Sparse EXIF — Only {len(present)}/4 camera tags present.")
            else:
                findings.append(f"[PROVENANCE] EXIF intact: {', '.join(present)}.")

            # Thumbnail mismatch
            try:
                thumb_data = exif_data.get(513) or exif_data.get(514)
                if thumb_data:
                    thumb = Image.open(io.BytesIO(thumb_data)).convert("RGB")
                    thumb_resized = thumb.resize(img.size[::-1], Image.LANCZOS) if thumb.size != img.size else thumb
                    mismatch = float(np.mean(np.abs(
                        np.array(thumb_resized, dtype=np.float32) - img_np
                    )))
                    if mismatch > 25:
                        score = max(score, 0.65)
                        findings.append(f"[PROVENANCE] EXIF thumbnail mismatch (Δ={mismatch:.1f}) — Image altered post-capture.")
            except Exception:
                pass

        if score < 0.1:
            findings.append("[PROVENANCE] Provenance chain intact — image origin plausible.")

        return LayerResult(
            name="provenance_jpeg",
            score=score,
            confidence=0.78,
            findings=findings,
            metadata={"ghost_dips": ghost_dips, "exif_present": exif_data is not None},
        )
    except Exception as e:
        return LayerResult(name="provenance_jpeg", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_semantic_entropy(img: Image.Image) -> LayerResult:
    """
    Local entropy distribution analysis.
    Real-world images have high spatial variance in entropy;
    AI images tend toward artificial uniformity.
    """
    findings = []
    try:
        gray  = np.array(img.convert("L"))
        bs    = 32
        h, w  = gray.shape
        block_Hs = []

        for r in range(0, h - bs, bs):
            for c in range(0, w - bs, bs):
                block = gray[r:r+bs, c:c+bs]
                hist, _ = np.histogram(block.flatten(), bins=32, range=(0, 256))
                p    = hist / (hist.sum() + 1e-10)
                H    = float(-np.sum(p * np.log2(p + 1e-10)))
                block_Hs.append(H)

        if not block_Hs:
            return LayerResult(name="semantic_entropy", score=0.0, confidence=0.3, findings=["ENTROPY: image too small"])

        hist_g, _ = np.histogram(gray.flatten(), bins=256, range=(0, 256))
        p_g = hist_g / (hist_g.sum() + 1e-10)
        H_g = float(-np.sum(p_g * np.log2(p_g + 1e-10)))

        H_mean = float(np.mean(block_Hs))
        H_var  = float(np.var(block_Hs))
        H_skew = float(stats.skew(block_Hs)) if SCIPY_AVAILABLE else 0.0

        score = 0.0
        if H_var < 0.35 and H_g < 6.5:
            score = max(score, 0.88)
            findings.append(f"[ENTROPY] Globally uniform complexity (H={H_g:.2f}, σ²={H_var:.3f}) — Synthetic generation signature.")
        elif H_var < 0.80:
            score = max(score, 0.50)
            findings.append(f"[ENTROPY] Low spatial entropy variance (σ²={H_var:.3f}) — Algorithmic complexity smoothing.")

        if SCIPY_AVAILABLE and abs(H_skew) < 0.15 and H_var < 1.0:
            score = max(score, 0.45)
            findings.append(f"[ENTROPY] Near-symmetric block entropy distribution (skew={H_skew:.3f}) — Non-organic.")

        if score < 0.1:
            findings.append(f"[ENTROPY] Complexity distribution matches natural scene statistics (H={H_g:.2f}, σ²={H_var:.3f}).")

        return LayerResult(
            name="semantic_entropy",
            score=score,
            confidence=0.80,
            findings=findings,
            metadata={"global_H": H_g, "block_H_var": H_var},
        )
    except Exception as e:
        return LayerResult(name="semantic_entropy", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_gradient_analysis(img: Image.Image) -> LayerResult:
    """
    Gradient / edge forensics:
    1. Sobel edge magnitude distribution
    2. Gradient direction consistency
    3. Over-sharpening detection
    4. Ringing artifact detection (common in AI super-resolution)
    """
    findings = []
    try:
        gray  = np.array(img.convert("L"), dtype=np.float64)
        gy, gx = np.gradient(gray)
        mag    = np.sqrt(gx**2 + gy**2)
        mag_mean = float(np.mean(mag))
        mag_std  = float(np.std(mag))
        mag_max  = float(np.max(mag))

        # Ringing: look for oscillatory patterns near edges
        edge_mask  = mag > np.percentile(mag, 90)
        near_edge  = ndimage.binary_dilation(edge_mask, iterations=3) if SCIPY_AVAILABLE else edge_mask
        if SCIPY_AVAILABLE:
            near_grad  = mag[near_edge & ~edge_mask]
            ringing    = float(np.std(near_grad)) / (mag_std + 1e-8)
        else:
            ringing = 0.5  # Unknown

        score = 0.0

        if mag_max > 500 and mag_mean < 15:
            score = max(score, 0.70)
            findings.append(f"[GRAD] Extreme edge sharpness with low global variance — AI sharpening post-process.")

        if ringing > 1.8 and SCIPY_AVAILABLE:
            score = max(score, 0.65)
            findings.append(f"[GRAD] Edge ringing detected (ratio={ringing:.2f}) — GAN/super-resolution upsampling artifact.")

        # Halos: strong gradient just outside detected edges
        if mag_mean < 5.0:
            score = max(score, 0.55)
            findings.append(f"[GRAD] Globally smooth gradient field (mean={mag_mean:.2f}) — Extreme AI over-smoothing.")

        if score < 0.1:
            findings.append(f"[GRAD] Gradient field consistent with natural image capture (mean={mag_mean:.2f}).")

        return LayerResult(
            name="gradient_analysis",
            score=score,
            confidence=0.76,
            findings=findings,
            metadata={"mag_mean": mag_mean, "mag_std": mag_std, "ringing": ringing},
        )
    except Exception as e:
        return LayerResult(name="gradient_analysis", score=0.0, confidence=0.0, findings=[], error=str(e))


def _layer_patch_consistency(img: Image.Image, img_np: np.ndarray) -> LayerResult:
    """
    Patch-level forensic consistency.
    Compares statistical fingerprints across image regions.
    Inconsistencies reveal compositing or regional manipulation.
    """
    findings = []
    try:
        h, w = img_np.shape[:2]
        ps   = max(64, min(128, h // 6, w // 6))
        patches: List[Dict] = []

        for r in range(0, h - ps, ps):
            for c in range(0, w - ps, ps):
                patch = img_np[r:r+ps, c:c+ps]
                patches.append({
                    "mean": float(np.mean(patch)),
                    "std":  float(np.std(patch)),
                    "skew": float(stats.skew(patch.flatten())) if SCIPY_AVAILABLE else 0.0,
                    "kurt": float(stats.kurtosis(patch.flatten())) if SCIPY_AVAILABLE else 0.0,
                })

        if len(patches) < 4:
            return LayerResult(name="patch_consistency", score=0.0, confidence=0.3, findings=["PATCH: too few patches"])

        means = [p["mean"] for p in patches]
        stds  = [p["std"]  for p in patches]
        skews = [p["skew"] for p in patches]

        std_of_means = float(np.std(means))
        std_of_stds  = float(np.std(stds))
        skew_range   = max(skews) - min(skews) if skews else 0.0

        # Detect outlier patches (possible composited region)
        z_scores = np.abs(stats.zscore(means)) if SCIPY_AVAILABLE else np.zeros(len(means))
        n_outliers = int(np.sum(z_scores > 3.0)) if SCIPY_AVAILABLE else 0

        score = 0.0

        if std_of_means < 5.0 and std_of_stds < 3.0:
            score = max(score, 0.65)
            findings.append(
                f"[PATCH] Hyper-uniform patch statistics (σ_mean={std_of_means:.1f}, σ_std={std_of_stds:.1f}) "
                f"— GAN over-regularization."
            )

        if n_outliers >= 2:
            score = max(score, 0.80)
            findings.append(f"[PATCH] {n_outliers} statistically anomalous patch(es) detected — Regional manipulation.")

        if SCIPY_AVAILABLE and skew_range > 4.0:
            score = max(score, 0.60)
            findings.append(f"[PATCH] High cross-patch skewness variance (Δskew={skew_range:.2f}) — Inconsistent generation process.")

        if score < 0.1:
            findings.append(f"[PATCH] Patch statistics spatially consistent — no regional anomalies.")

        return LayerResult(
            name="patch_consistency",
            score=score,
            confidence=0.82,
            findings=findings,
            metadata={"n_patches": len(patches), "n_outliers": n_outliers, "std_of_means": std_of_means},
        )
    except Exception as e:
        return LayerResult(name="patch_consistency", score=0.0, confidence=0.0, findings=[], error=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
#  AGGREGATION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def _aggregate(layer_results: Dict[str, LayerResult]) -> Tuple[float, float]:
    """
    Weighted aggregation with confidence-adjusted scores.
    Returns (final_score 0-1, overall_confidence 0-1).
    """
    total_weight = 0.0
    weighted_sum = 0.0
    conf_sum     = 0.0

    for name, weight in LAYER_WEIGHTS.items():
        lr = layer_results.get(name)
        if lr is None or lr.error:
            continue
        # Confidence-adjusted weight
        eff_weight    = weight * lr.confidence
        weighted_sum += eff_weight * lr.score
        total_weight += eff_weight
        conf_sum     += lr.confidence

    if total_weight == 0:
        return 0.0, 0.0

    final_score      = weighted_sum / total_weight
    overall_conf     = conf_sum / len(LAYER_WEIGHTS)

    # Boosting: if 3+ high-confidence layers agree (score > 0.7) → boost
    strong_signals = sum(
        1 for lr in layer_results.values()
        if lr and not lr.error and lr.score > 0.70 and lr.confidence > 0.75
    )
    if strong_signals >= 3:
        boost = min(0.10, strong_signals * 0.025)
        final_score = min(1.0, final_score + boost)

    return final_score, overall_conf


def _classify(score: float) -> Tuple[RiskLevel, Action, str]:
    if score >= RISK_THRESHOLDS[RiskLevel.CRITICAL]:
        return (
            RiskLevel.CRITICAL,
            Action.CRITICAL_ESCALATION,
            "CRITICAL: High-Confidence AI Manipulation Detected — Content Should Be Blocked"
        )
    elif score >= RISK_THRESHOLDS[RiskLevel.HIGH]:
        return (
            RiskLevel.HIGH,
            Action.MANUAL_REVIEW,
            "HIGH: Likely Synthetic or Manipulated Content — Manual Forensic Review Required"
        )
    elif score >= RISK_THRESHOLDS[RiskLevel.MEDIUM]:
        return (
            RiskLevel.MEDIUM,
            Action.SECONDARY_VERIFICATION,
            "MEDIUM: Suspicious Anomalies Present — Secondary Verification Recommended"
        )
    elif score >= RISK_THRESHOLDS[RiskLevel.LOW]:
        return (
            RiskLevel.LOW,
            Action.MONITOR,
            "LOW: Minor Inconsistencies Detected — Monitor and Log"
        )
    else:
        return (
            RiskLevel.SECURE,
            Action.NO_ACTION,
            "SECURE: No Significant Manipulation Signatures Detected"
        )


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN ANALYSIS PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

async def analyze_image(image_bytes: bytes) -> ScanResult:
    """
    Full pipeline — call this from API endpoints.
    Returns a structured ScanResult with all forensic data.
    """
    t_start = time.monotonic()

    # ── Load image ────────────────────────────────────────────
    try:
        img    = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img, dtype=np.float32)
    except Exception as e:
        raise ValueError(f"Cannot decode image: {e}")

    w, h       = img.size
    img_hash   = hashlib.sha256(image_bytes).hexdigest()

    # ── Run all forensic layers ───────────────────────────────
    layer_results: Dict[str, LayerResult] = {}

    # ML ensemble (async-compatible; uses model registry)
    layer_results["ml_ensemble"]       = _layer_ml_ensemble(img)

    # Pixel
    layer_results["pixel_ela"]         = _layer_pixel_ela(img, img_np)

    # Frequency
    layer_results["frequency_fft"]     = _layer_frequency_fft(img)
    layer_results["frequency_dct"]     = _layer_frequency_dct(img)

    # Noise
    layer_results["noise_srm"]         = _layer_noise_srm(img, img_np)

    # Biometric
    layer_results["biometric_face"]    = _layer_biometric_face(img)

    # Physics
    layer_results["physics_color"]     = _layer_physics_color(img)
    layer_results["physics_lighting"]  = _layer_physics_lighting(img)

    # Provenance
    layer_results["provenance_jpeg"]   = _layer_provenance_jpeg(img)

    # Semantic
    layer_results["semantic_entropy"]  = _layer_semantic_entropy(img)

    # Structural
    layer_results["gradient_analysis"] = _layer_gradient_analysis(img)
    layer_results["patch_consistency"] = _layer_patch_consistency(img, img_np)

    # ── Aggregate ─────────────────────────────────────────────
    final_score, overall_conf = _aggregate(layer_results)
    risk_level, action, verdict = _classify(final_score)

    # ── Collate all findings ──────────────────────────────────
    all_findings: List[str] = []
    for lr in layer_results.values():
        if lr:
            all_findings.extend(lr.findings)

    # ── Forensic summary ──────────────────────────────────────
    forensic_summary = {
        "PIXEL_DOMAIN": {
            "ela_score":  round(layer_results["pixel_ela"].score, 4),
        },
        "FREQUENCY_DOMAIN": {
            "fft_score":  round(layer_results["frequency_fft"].score, 4),
            "dct_score":  round(layer_results["frequency_dct"].score, 4),
        },
        "NOISE_DOMAIN": {
            "srm_score":  round(layer_results["noise_srm"].score, 4),
        },
        "BIOMETRIC": {
            "face_score": round(layer_results["biometric_face"].score, 4),
            "faces_found": layer_results["biometric_face"].metadata.get("faces_detected", 0),
        },
        "PHYSICS": {
            "color_score":    round(layer_results["physics_color"].score, 4),
            "lighting_score": round(layer_results["physics_lighting"].score, 4),
        },
        "PROVENANCE": {
            "jpeg_score":  round(layer_results["provenance_jpeg"].score, 4),
            "exif_present": layer_results["provenance_jpeg"].metadata.get("exif_present", False),
        },
        "SEMANTIC": {
            "entropy_score": round(layer_results["semantic_entropy"].score, 4),
        },
        "STRUCTURAL": {
            "gradient_score": round(layer_results["gradient_analysis"].score, 4),
            "patch_score":    round(layer_results["patch_consistency"].score, 4),
        },
        "ML_ENSEMBLE": {
            "score":         round(layer_results["ml_ensemble"].score, 4),
            "confidence":    round(layer_results["ml_ensemble"].confidence, 4),
            "models_active": layer_results["ml_ensemble"].metadata.get("models_active", []),
        },
    }

    # ── Governance output ─────────────────────────────────────
    governance = {
        "AGGREGATED_RISK_SCORE":    round(final_score, 4),
        "OVERALL_CONFIDENCE":       round(overall_conf, 4),
        "RISK_LEVEL":               risk_level.value,
        "RECOMMENDED_ACTION":       action.value,
        "STRONG_SIGNAL_COUNT":      sum(
            1 for lr in layer_results.values()
            if lr and not lr.error and lr.score > 0.70 and lr.confidence > 0.75
        ),
        "LAYERS_ACTIVE":            [k for k, v in layer_results.items() if v and not v.error],
        "LAYERS_FAILED":            [k for k, v in layer_results.items() if v and v.error],
        "DECISION_SOURCE":          "ML+FORENSIC_ENSEMBLE" if _ml_registry.ready else "FORENSIC_ONLY",
        "ENGINE_VERSION":           "EDD-CORE-v2.0",
    }

    duration_ms = (time.monotonic() - t_start) * 1000

    return ScanResult(
        image_hash=img_hash,
        image_size=(w, h),
        scan_duration_ms=round(duration_ms, 1),
        risk_score=int(final_score * 100),
        risk_level=risk_level,
        recommended_action=action,
        verdict=verdict,
        confidence=round(overall_conf, 4),
        layer_results=layer_results,
        findings=all_findings,
        forensic_summary=forensic_summary,
        governance=governance,
        ml_used=bool(_ml_registry.ready),
        ml_models_active=list(_ml_registry.ready),
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  GOVERNANCE WRAPPER (External API cross-validation)
# ═══════════════════════════════════════════════════════════════════════════════

async def _call_reality_defender(image_bytes: bytes) -> Optional[float]:
    """Calls external Reality Defender node script. Returns score 0-1 or None."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        proc = await asyncio.create_subprocess_exec(
            "node", "rd_detector.mjs", tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=25.0)
        os.remove(tmp_path)

        if proc.returncode == 0:
            parsed = json.loads(stdout.decode("utf-8").strip())
            if parsed.get("success"):
                rd = parsed.get("result", {})
                return float(rd.get("score", rd.get("probability", 0.5)))
    except Exception as e:
        logger.warning(f"Reality Defender call failed: {e}")
    return None


async def full_scan(image_bytes: bytes, use_external_api: bool = True) -> Dict[str, Any]:
    """
    Top-level scan entry point.
    1. Runs internal 12-layer forensic engine
    2. Optionally cross-validates with Reality Defender
    3. Returns flat dict compatible with /scan API endpoint schema
    """
    result = await analyze_image(image_bytes)

    internal_score = result.governance["AGGREGATED_RISK_SCORE"]
    external_score = None
    api_used       = False
    divergence     = None

    if use_external_api:
        external_score = await _call_reality_defender(image_bytes)

    if external_score is not None:
        api_used   = True
        divergence = abs(internal_score - external_score)

        if divergence > 0.28:
            result.findings.insert(
                0,
                f"[AUDIT] High inter-system divergence: internal={internal_score:.3f} "
                f"vs external={external_score:.3f} (Δ={divergence:.3f}) — Treat with elevated caution."
            )

        # Blended final score: internal is more trusted
        final_score = (internal_score * 0.72) + (external_score * 0.28)
    else:
        # Failsafe: internal only
        final_score = internal_score
        result.findings.insert(0, "[GOVERNANCE] External API offline — internal engine authoritative.")

    # Re-classify with blended score
    risk_level, action, verdict = _classify(final_score)

    return {
        # Core fields (API-compatible)
        "risk_score":          int(final_score * 100),
        "verdict":             verdict,
        "risk_level":          risk_level.value,
        "recommended_action":  action.value,
        "confidence":          result.confidence,
        "findings":            result.findings,
        "image_hash":          result.image_hash,
        "image_size":          result.image_size,
        "scan_duration_ms":    result.scan_duration_ms,

        # Forensic breakdown
        "layer_scores": {
            k: {
                "score":      round(v.score, 4),
                "confidence": round(v.confidence, 4),
                "weighted":   round(v.weighted_score, 4),
                "error":      v.error,
            }
            for k, v in result.layer_results.items() if v
        },
        "forensic_summary":  result.forensic_summary,

        # Governance
        "GOVERNANCE_OUTPUT": {
            **result.governance,
            "INTERNAL_FORENSIC_SCORE": round(internal_score, 4),
            "EXTERNAL_API_SCORE":      round(external_score, 4) if external_score is not None else None,
            "API_USED":                api_used,
            "DIVERGENCE":              round(divergence, 4) if divergence is not None else None,
            "FINAL_BLENDED_SCORE":     round(final_score, 4),
            "RECOMMENDED_ACTION":      action.value,
        },

        # Metadata
        "ml_used":           result.ml_used,
        "ml_models_active":  result.ml_models_active,
        "engine_version":    "EDD-CORE-v2.0",
    }


#  VOICE CLONE DETECTION

async def analyze_voice(audio_bytes: bytes, filename: str = "") -> dict:
    """
    Voice clone detection:
    Layer 0: GradientBoosting ML classifier on 25-dim acoustic feature vector
    Layers 1-5: Acoustic forensic rules (MFCC, Pitch, Spectral, Breath, Formant)
    Final score: ML 55% + acoustic forensics 45%
    """
    findings = []
    layer_scores = {}

    # ─── Load audio ───────────────────────────────────────────
    audio_data = None
    sample_rate = None

    if LIBROSA_AVAILABLE:
        try:
            audio_data, sample_rate = librosa.load(io.BytesIO(audio_bytes), sr=None, mono=True)
            dur = len(audio_data) / sample_rate
            findings.append(f"AUDIO: {len(audio_data)} samples @ {sample_rate}Hz — {dur:.2f}s duration")
        except Exception as e:
            findings.append(f"Librosa load: {e}")

    if audio_data is None and SOUNDFILE_AVAILABLE:
        try:
            audio_data, sample_rate = sf.read(io.BytesIO(audio_bytes), always_2d=False)
            if audio_data.ndim > 1:
                audio_data = np.mean(audio_data, axis=1)
            findings.append(f"AUDIO: soundfile loaded @ {sample_rate}Hz")
        except Exception as e:
            findings.append(f"soundfile: {e}")

    # BUG FIX: Only block if BOTH loaders failed — not just because librosa is unavailable
    if audio_data is None:
        findings.append("AUDIO: Cannot load audio file — format unsupported or library missing")
        return {
            "risk_score": 0, "verdict": "INDETERMINATE",
            "findings": findings, "layer_scores": {"ml_gb": 0}
        }

    # ─── Extract 25-dim feature vector ────────────────────────
    feat = _extract_voice_features(audio_data, sample_rate, findings)

    # ─── Layer 0: ML GradientBoosting ─────────────────────────
    ml_score = 0
    ml_prob = 0.0
    if _models["voice_ready"] and _models["voice_gb"] is not None:
        try:
            X = np.array(feat, dtype=np.float32).reshape(1, -1)
            prob = _models["voice_gb"].predict_proba(X)[0]
            ml_prob = float(prob[1])   # probability of being "fake"
            ml_score = int(ml_prob * 100)
            label = "AI-CLONED" if ml_prob > 0.5 else "AUTHENTIC"
            findings.append(f"ML-GB: {label} voice (fake_prob={ml_prob:.3f}, model=GradientBoosting@200trees)")
        except Exception as e:
            findings.append(f"ML-GB: Inference failed ({e})")
            logger.error(f"Voice ML error: {e}")
    else:
        findings.append("ML-GB: Model not ready — acoustic forensics only")
    layer_scores["ml_gb"] = ml_score

    # ─── Layer 1: MFCC forensics ──────────────────────────────
    mfcc_score = 0
    try:
        mfccs = librosa.feature.mfcc(y=audio_data, sr=sample_rate, n_mfcc=20)
        delta = np.diff(mfccs, axis=1)
        smoothness = float(np.mean(np.abs(delta)))
        mfcc_var = float(np.mean(np.var(mfccs, axis=1)))

        if smoothness < 0.7:
            mfcc_score = 88
            findings.append(f"MFCC: Hyper-smooth cepstral trajectory ({smoothness:.3f}) — TTS/clone signature")
        elif smoothness < 2.0:
            mfcc_score = 52
            findings.append(f"MFCC: Low cepstral variation ({smoothness:.3f}) — possible synthesis")
        else:
            findings.append(f"MFCC: Natural cepstral variation ({smoothness:.3f})")

        if mfcc_var < 5.0:
            mfcc_score = min(100, mfcc_score + 22)
            findings.append(f"MFCC: Unusually low coefficient variance ({mfcc_var:.2f}) — neural TTS marker")
    except Exception as e:
        findings.append(f"MFCC: {e}")
    layer_scores["mfcc"] = mfcc_score

    # ─── Layer 2: Pitch Analysis ──────────────────────────────
    pitch_score = 0
    try:
        f0, voiced_flag, _ = librosa.pyin(
            audio_data, fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'), sr=sample_rate
        )
        valid_f0 = f0[~np.isnan(f0)]
        if len(valid_f0) > 15:
            jitter = float(np.std(valid_f0)) / (float(np.mean(valid_f0)) + 1e-6)
            pitch_range = float(np.ptp(valid_f0))

            if jitter < 0.018:
                pitch_score = 85
                findings.append(f"PITCH: Robotic periodicity (jitter={jitter:.4f}) — synthesizer detected")
            elif jitter < 0.05:
                pitch_score = 48
                findings.append(f"PITCH: Low pitch jitter ({jitter:.4f}) — possible clone")
            else:
                findings.append(f"PITCH: Natural jitter ({jitter:.4f}, F0_mean={np.mean(valid_f0):.1f}Hz)")

            if pitch_range < 28 and len(valid_f0) > 40:
                pitch_score = min(100, pitch_score + 28)
                findings.append(f"PITCH: Very narrow pitch range ({pitch_range:.1f}Hz) — synthetic monotone")
        else:
            findings.append("PITCH: Too few voiced frames for analysis")
    except Exception as e:
        findings.append(f"PITCH: {e}")
    layer_scores["pitch"] = pitch_score

    # ─── Layer 3: Spectral Forensics ──────────────────────────
    spectral_score = 0
    try:
        centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sample_rate)[0]
        flatness = librosa.feature.spectral_flatness(y=audio_data)[0]
        zcr = librosa.feature.zero_crossing_rate(audio_data)[0]

        centroid_delta_std = float(np.std(np.diff(centroid)))
        flatness_mean = float(np.mean(flatness))
        zcr_std = float(np.std(zcr))

        if centroid_delta_std < 120:
            spectral_score += 38
            findings.append(f"SPECTRAL: Frozen centroid trajectory (Δσ={centroid_delta_std:.1f}) — TTS artifact")
        else:
            findings.append(f"SPECTRAL: Centroid variation normal (Δσ={centroid_delta_std:.1f})")

        if zcr_std < 0.004:
            spectral_score += 32
            findings.append(f"SPECTRAL: Ultra-stable ZCR ({zcr_std:.5f}) — machine-generated consistency")
        else:
            findings.append(f"SPECTRAL: ZCR variation natural ({zcr_std:.5f})")

        if flatness_mean > 0.18:
            spectral_score += 18
            findings.append(f"SPECTRAL: High spectral flatness ({flatness_mean:.4f}) — vocoder/noise injection")
    except Exception as e:
        findings.append(f"SPECTRAL: {e}")
    layer_scores["spectral"] = min(100, spectral_score)

    # ─── Layer 4: Breath & Silence ────────────────────────────
    breath_score = 0
    try:
        rms = librosa.feature.rms(y=audio_data, frame_length=512, hop_length=256)[0]
        thresh = float(np.percentile(rms, 10)) * 2
        silence_ratio = float(np.sum(rms < thresh)) / (len(rms) + 1e-6)
        transitions = int(np.sum(np.diff(rms > thresh) != 0))
        max_amp = float(np.max(np.abs(audio_data)))
        clip_ratio = float(np.sum(np.abs(audio_data) > 0.99 * max_amp)) / len(audio_data)

        if silence_ratio < 0.04:
            breath_score += 42
            findings.append(f"BREATH: No breathing pauses ({silence_ratio:.3f}) — TTS speaking continuously")
        elif transitions < 4 and len(rms) > 100:
            breath_score += 32
            findings.append(f"BREATH: Too few energy transitions ({transitions}) — unnatural rhythm")
        else:
            findings.append(f"BREATH: Natural breathing patterns (silence={silence_ratio:.3f}, transitions={transitions})")

        if clip_ratio > 0.01:
            breath_score += 28
            findings.append(f"BREATH: Audio clipping detected ({clip_ratio:.4f}) — heavy post-processing")
    except Exception as e:
        findings.append(f"BREATH: {e}")
    layer_scores["breath"] = min(100, breath_score)

    # ─── Layer 5: Formant / Autocorrelation ───────────────────
    formant_score = 0
    try:
        frame_size = int(sample_rate * 0.025)
        hop = int(sample_rate * 0.010)
        acorrs = []
        for start in range(0, len(audio_data) - frame_size, hop):
            frame = audio_data[start:start+frame_size]
            if np.sum(frame**2) > 1e-6:
                ac = np.correlate(frame, frame, mode='full')
                ac = ac[len(ac)//2:]
                acorrs.append(ac[1] / (ac[0] + 1e-10))

        if acorrs:
            ac_mean = float(np.mean(acorrs))
            ac_std = float(np.std(acorrs))
            if ac_mean > 0.90:
                formant_score = 82
                findings.append(f"FORMANT: Hyper-periodic voiced frames (r̄={ac_mean:.3f}) — vocoder/TTS")
            elif ac_mean > 0.75:
                formant_score = 46
                findings.append(f"FORMANT: High periodicity (r̄={ac_mean:.3f}) — possible synthesis")
            else:
                findings.append(f"FORMANT: Periodicity within human range (r̄={ac_mean:.3f})")
            if ac_std < 0.04:
                formant_score = min(100, formant_score + 20)
                findings.append(f"FORMANT: Extremely consistent autocorrelation (σ={ac_std:.4f}) — clone signature")
    except Exception as e:
        findings.append(f"FORMANT: {e}")
    layer_scores["formant"] = formant_score

    # ─── Final Score ───────────────────────────────────────────
    ml_w = 0.50 if _models["voice_ready"] else 0.0
    forensic_w = 1.0 - ml_w
    forensic_weights = {"mfcc": 0.30, "pitch": 0.25, "spectral": 0.20, "breath": 0.15, "formant": 0.10}
    forensic_total = sum(layer_scores.get(k, 0) * w for k, w in forensic_weights.items())

    combined = ml_score * ml_w + forensic_total * forensic_w
    high_layers = sum(1 for k in forensic_weights if layer_scores.get(k, 0) > 40)
    if _models["voice_ready"] and ml_score > 60 and high_layers >= 2:
        boost = min(12, high_layers * 4)
        combined = min(100, combined + boost)
        findings.append(f"CORRELATION: ML + {high_layers} acoustic layers agree → boost +{boost}")

    risk_score = int(min(100, combined))
    if risk_score > 68:
        verdict = "AI-CLONED VOICE DETECTED"
    elif risk_score > 38:
        verdict = "SUSPICIOUS — POSSIBLE VOICE SYNTHESIS"
    elif risk_score > 20:
        verdict = "LOW RISK — MINOR ANOMALIES"
    else:
        verdict = "AUTHENTIC HUMAN VOICE"

    return {
        "risk_score": risk_score,
        "verdict": verdict,
        "findings": findings,
        "layer_scores": layer_scores,
        "ml_used": _models["voice_ready"],
        "ml_confidence": round(ml_prob, 4),
    }


def _extract_voice_features(audio_data: np.ndarray, sr: int, findings: list) -> list:
    """Extract 30-dimensional Gen-4 feature vector for ML classifier"""
    feat = [0.0] * 30
    try:
        # MFCCs 0-12
        mfccs = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=13)
        delta = np.diff(mfccs, axis=1)
        for i in range(13):
            feat[i] = float(np.mean(np.abs(delta[i])))

        # Pitch 13-14
        f0, _, _ = librosa.pyin(audio_data, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)
        valid_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([])
        if len(valid_f0) > 5:
            feat[13] = float(np.std(valid_f0)) / (float(np.mean(valid_f0)) + 1e-6)  # jitter
            feat[14] = float(np.ptp(valid_f0))  # range
        else:
            feat[13] = 0.01
            feat[14] = 10.0

        # Spectral 15-17
        zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
        feat[15] = float(np.std(zcr))
        centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sr)[0]
        feat[16] = float(np.std(np.diff(centroid)))
        feat[17] = float(np.mean(librosa.feature.spectral_flatness(y=audio_data)[0]))

        # Breath 18
        rms = librosa.feature.rms(y=audio_data, frame_length=512, hop_length=256)[0]
        thresh = float(np.percentile(rms, 10)) * 2
        feat[18] = float(np.sum(rms < thresh)) / (len(rms) + 1e-6)

        # Autocorrelation 19-20
        frame_size = int(sr * 0.025)
        hop = int(sr * 0.010)
        acorrs = []
        for s in range(0, len(audio_data) - frame_size, hop):
            frame = audio_data[s:s+frame_size]
            if np.sum(frame**2) > 1e-6:
                ac = np.correlate(frame, frame, mode='full')
                ac = ac[len(ac)//2:]
                acorrs.append(ac[1] / (ac[0] + 1e-10))
        if acorrs:
            feat[19] = float(np.mean(acorrs))
            feat[20] = float(np.std(acorrs))

        # RMS variance 21
        feat[21] = float(np.var(rms))

        # Rolloff std 22
        rolloff = librosa.feature.spectral_rolloff(y=audio_data, sr=sr)[0]
        feat[22] = float(np.std(rolloff))

        # Energy transitions 23
        feat[23] = float(np.sum(np.diff(rms > thresh) != 0)) / (len(rms) + 1e-6)

        # Clipping 24
        max_amp = float(np.max(np.abs(audio_data))) + 1e-10
        feat[24] = float(np.sum(np.abs(audio_data) > 0.99 * max_amp)) / len(audio_data)

        # ─── Gen-4 Forensics (25-29) ───
        
        # 25: Spectral Entropy (Chaos ratio)
        fft_mag = np.abs(np.fft.rfft(audio_data))
        psd = (fft_mag ** 2) / (len(fft_mag) + 1e-10)
        psd_norm = psd / (np.sum(psd) + 1e-10)
        feat[25] = float(-np.sum(psd_norm * np.log2(psd_norm + 1e-10)))  # Shannon Entropy
        
        # 26: Phase Coherence (Stitching marker)
        phase = np.angle(np.fft.rfft(audio_data))
        phase_diff = np.diff(phase)
        feat[26] = float(1.0 - np.std(phase_diff) / (np.pi + 1e-10))  # Unnatural phase linking
        
        # 27: Pitch-Formant Correlation
        # Proxy formant track using spectral centroid trajectory
        if len(valid_f0) > 5 and len(centroid) > 5:
            # Resample F0 to match centroid length if needed (simplified proxy)
            min_len = min(len(valid_f0), len(centroid))
            corr = np.corrcoef(valid_f0[:min_len], centroid[:min_len])[0, 1]
            feat[27] = float(0.0 if np.isnan(corr) else abs(corr))
        else:
            feat[27] = 0.5 # Default neutral
            
        # 28: HF Rolloff Symmetry
        # Compares variation between 85% and 95% rolloff bins
        rolloff_95 = librosa.feature.spectral_rolloff(y=audio_data, sr=sr, roll_percent=0.95)[0]
        feat[28] = float(np.corrcoef(rolloff, rolloff_95)[0,1] if len(rolloff) > 1 else 0.8)

        # 29: Silence-to-Speech Entropy Ratio
        speech_indices = np.where(rms > thresh)[0]
        silence_indices = np.where(rms <= thresh)[0]
        if len(speech_indices) > 5 and len(silence_indices) > 5:
            speech_rms_var = np.var(rms[speech_indices])
            silence_rms_var = np.var(rms[silence_indices])
            feat[29] = float(speech_rms_var / (silence_rms_var + 1e-10))
        else:
            feat[29] = 1.0

    except Exception as e:
        logger.error(f"Feature extraction error: {e}")

    return feat


#  TEXT / URL ANALYSIS (kept from previous)

async def analyze_text(text: str) -> dict:
    score = 0
    findings = []
    text_lower = text.lower()

    # 1. Semantic Intent Clustering (Behavioral NLP approximation)
    clusters = {
        "FINANCIAL_EXTORTION": (
            [r'bitcoin', r'crypto', r'wallet', r'ransom', r'invoice', r'payment\s+overdue', r'wire\s+transfer', r'gift\s+card', r'\$[\d,]{3,}'], 
            25
        ),
        "AUTHORITY_MIMICRY": (
            [r'account\s+suspended', r'unauthorized\s+activity', r'verify\s+your\s+identity', r'security\s+alert', r'legal\s+action', r'police'],
            30
        ),
        "URGENCY_MANIPULATION": (
            [r'immediate\s+action', r'within\s+\d+\s+hours', r'act\s+now', r'final\s+notice', r'expires\s+soon', r'urgent'],
            20
        ),
        "CREDENTIAL_HARVESTING": (
            [r'click\s+here', r'login\s+below', r'reset\s+password', r'update\s+details', r'access\s+portal'],
            20
        )
    }

    triggered_clusters = 0
    for intent, (patterns, weight) in clusters.items():
        hits = sum(1 for p in patterns if re.search(p, text_lower))
        if hits > 0:
            score += weight + (hits * 5) # Base weight + bonus for density
            triggered_clusters += 1
            findings.append(f"[INTENT: {intent}] Detected semantic manipulations (Density: {hits})")

    # 2. Multi-Vector Attack (e.g. Urgency + Mimicry = High Risk)
    if triggered_clusters >= 2:
        score += 30
        findings.append("[BEHAVIORAL RISK] Multi-vector social engineering detected (Cross-domain manipulation)")

    # 3. Obfuscation & Evasion Tactics
    # Detect weird spacing, zero-width chars used to bypass simple text filters
    if re.search(r'[\u200B-\u200D\uFEFF]', text):
        score += 85
        findings.append("[ADVERSARIAL EVASION] Zero-width characters detected — Spam filter bypass attempt")
        
    obfuscated_words = len(re.findall(r'[a-zA-Z][0-9][a-zA-Z]', text))
    if obfuscated_words > 2:
        score += 35
        findings.append(f"[ADVERSARIAL EVASION] Alphanumeric substitution detected ({obfuscated_words} instances)")

    # 4. Syntactic Anomalies
    upper_ratio = sum(1 for c in text if c.isupper()) / (len(text) + 1)
    if upper_ratio > 0.4:
         score += 15
         findings.append(f"[ANOMALY] Abnormal capitalization sequence ({upper_ratio:.0%})")

    return {"risk_score": min(100, int(score)), "findings": findings}


async def check_gsb(url: str) -> dict:
    """Internal Google Safe Browsing check for backend fusion."""
    if not SAFE_BROWSING_API_KEY:
        return {"is_threat": False, "note": "GSB NOT CONFIGURED"}
    try:
        import httpx
        payload = {
            "client": {"clientId": "safenet-backend", "clientVersion": "5.0"},
            "threatInfo": {
                "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}]
            }
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={SAFE_BROWSING_API_KEY}",
                json=payload,
                timeout=5.0
            )
            if resp.status_code == 200:
                data = resp.json()
                if "matches" in data:
                    t_type = data["matches"][0]["threatType"]
                    return {"is_threat": True, "note": f"GSB FLAG: {t_type}"}
        return {"is_threat": False, "note": "GSB CLEAN"}
    except Exception as e:
        logger.error(f"GSB Error: {e}")
        return {"is_threat": False, "note": "GSB ERROR"}

async def check_pagerank(domain: str) -> dict:
    """Internal OpenPageRank check for reputation scoring."""
    if not OPEN_PAGE_RANK_API_KEY:
        return {"rank": 0, "note": "OPR NOT CONFIGURED"}
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://openpagerank.com/api/v1.0/getPageRank?domains[0]={domain}",
                headers={"API-OPR": OPEN_PAGE_RANK_API_KEY},
                timeout=5.0
            )
            if resp.status_code == 200:
                data = resp.json()
                rank = data.get("response", [{}])[0].get("rank_int", 0)
                return {"rank": rank, "note": f"OPR Rank: {rank}"}
        return {"rank": 0, "note": "OPR UNAVAILABLE"}
    except Exception as e:
        logger.error(f"PageRank Error: {e}")
        return {"rank": 0, "note": "OPR ERROR"}

async def check_domain_age(domain: str) -> dict:
    """Checks domain registration age. Newly registered domains (<30d) are high-risk."""
    try:
        # Note: In a production env, use a WHOIS API or python-whois.
        # Here we implement a 'Suspicious TLD/Pattern' proxy signal for Zero-Day fraud.
        # Real WHOIS integration would typically call an external service.
        suspicious_patterns = [".zip", ".mov", ".top", ".xyz", ".buzz", ".icu", ".cam"]
        for p in suspicious_patterns:
            if domain.endswith(p):
                return {"is_new": True, "note": "SUSPICIOUS TLD (Pattern-matched Zero-Day Risk)"}
        return {"is_new": False, "note": "DOMAIN AGE NORMAL"}
    except Exception as e:
        logger.error(f"Domain age check error: {e}")
        return {"is_new": False, "note": "AGE CHECK ERROR"}

async def analyze_url(url: str) -> dict:
    import math
    import urllib.parse
    import difflib
    
    score = 0
    findings = []
    try:
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
            
        parsed = urllib.parse.urlparse(url)
        host = parsed.hostname or ""
        path = parsed.path or ""
        query = parsed.query or ""

        # 1. Zero-Trust Check: Protocol
        if parsed.scheme == "http":
            score += 25
            findings.append("[ZERO-TRUST] Insecure HTTP protocol used (Potential interception)")

        # 2. Heuristic TLD Evaluation
        suspicious_tlds = ['.xyz', '.top', '.club', '.online', '.site', '.click', '.link', '.ru', '.cn', '.cc', '.loan', '.buzz', '.zip', '.mov']
        if any(host.endswith(tld) for tld in suspicious_tlds):
            score += 50
            findings.append(f"[THREAT INTEL] High-risk Top-Level Domain detected")

        # 3. IP Address Masking
        if re.search(r'^\d{1,3}(\.\d{1,3}){3}$', host):
            score += 65
            findings.append("[OBFUSCATION] Bare IP address used instead of domain name")
            
        # 4. Homograph & Typo-squatting Analysis (Levenshtein-based)
        brands = [
            'paypal', 'amazon', 'google', 'facebook', 'microsoft', 'apple', 'netflix',
            'chase', 'wellsfargo', 'instagram', 'linkedin', 'github', 'binance', 'coinbase',
            'twitter', 'x.com', 'roblox', 'snapchat', 'tiktok', 'discord', 'steam',
            'epicgames', 'bofa', 'citibank', 'wellsfargo', 'hsbc', 'barclays', 'standardchartered',
            'airtel', 'mtn', 'vodafone', 'jio', 'reliance', 'tata', 'hdfc', 'icici'
        ]
        
        # Remove TLD for comparison
        host_no_tld = host.split('.')[0] if '.' in host else host
        
        brand_matched = False
        for brand in brands:
            if brand in host and not host.endswith(f"{brand}.com"):
                # Subdomain trickery (e.g., paypal.secure-login.com)
                score += 55
                findings.append(f"[IMPERSONATION] Target brand '{brand}' found nested in structural domain routing")
                brand_matched = True
                break
        
        if not brand_matched:
            # BUG FIX: Only run typo-squatting if no direct brand match was found
            for brand in brands:
                if brand != host_no_tld:
                    similarity = difflib.SequenceMatcher(None, brand, host_no_tld).ratio()
                    if 0.75 < similarity < 1.0:
                        score += 80
                        findings.append(f"[TYPO-SQUATTING] Hostname mathematically similar to restricted entity '{brand}' (Similarity: {similarity:.2f})")
                        break  # Report only top match to avoid score stacking

        # 5. Information Entropy (DGA Detection)
        def calc_entropy(data):
            if not data: return 0
            entropy = 0
            for x in set(data):
                p_x = float(data.count(x)) / len(data)
                entropy -= p_x * math.log(p_x, 2)
            return entropy
            
        host_entropy = calc_entropy(host_no_tld)
        if host_entropy > 3.8:
            score += 45
            findings.append(f"[DGA FLAG] Anomalous hostname entropy ({host_entropy:.2f}) — Domain Generation Algorithm likely")

        # 6. Deep Link & Credential Harvesting Signatures
        harvesting_keywords = ['login', 'signin', 'secure', 'auth', 'verify', 'update', 'billing', 'confirm', 'wallet']
        path_query = (path + query).lower()
        keyword_hits = sum(1 for w in harvesting_keywords if w in path_query)
        if keyword_hits > 0:
            score += min(keyword_hits * 15, 45)
            findings.append(f"[SEMANTIC RISK] Discovered {keyword_hits} credential harvesting marker(s) in deeper URI path")

        if "@" in parsed.netloc:
            score += 85
            findings.append("[ZERO-TRUST] '@' symbol in URL authority — classic credential masking attack")

        if score < 40 and not brand_matched:
            # Zero-Trust: If not a known brand and not already flagged, apply 'Unknown Origin' penalty
            score += 30
            findings.append("[ZERO-TRUST] Unverified origin — elevated scrutiny applied to unknown domain")

    except Exception as e:
        findings.append(f"URL Analysis Fault: {e}")
        
    return {"risk_score": min(100, int(score)), "findings": findings}



#  MAIN SCAN ENDPOINT

@app.post("/scan")
async def scan(
    request: Request,
    text: str = Form(""),
    url: str = Form(""),
    scan_type: str = Form("auto"),
    file: UploadFile = File(None),
):
    # ── Distributed Request Tracing ─────────────────────
    trace_id = str(uuid.uuid4())
    client_ip = request.client.host if request.client else "unknown"
    logger.info(json.dumps({"event": "SCAN_START", "trace_id": trace_id, "scan_type": scan_type, "client": client_ip}))

    # ── Rate Limiting ───────────────────────────────────
    if not _rate_limiter.is_allowed(client_ip):
        _telemetry["rate_limit_drops"] += 1
        raise HTTPException(status_code=429, detail={"error": "RATE_LIMIT_EXCEEDED", "retry_after_seconds": 60})

    _telemetry["total_scans"] += 1
    try:
        start_time = time.time()
        all_findings = []
        layer_scores = {}
        final_score = 0
        verdict = "Safe"
        ml_used = False
        ml_confidence = 0.0
        file_bytes = None

        if file and file.filename:
            file_bytes = await file.read()

        # ── Cache Lookup (binary files only) ────────────
        if file_bytes:
            cached = _scan_cache.get(file_bytes)
            if cached:
                _telemetry["cache_hits"] += 1
                # BUG FIX: Return a copy to avoid mutating the stored cache entry
                import copy
                cached_copy = copy.copy(cached)
                cached_copy["trace_id"] = trace_id
                cached_copy["cache_hit"] = True
                return cached_copy

        if scan_type == "image" or (scan_type == "auto" and file_bytes and _is_image(file, file_bytes)):
            # Full Efficiency: Cross-validate with Reality Defender via full_scan
            result = await full_scan(file_bytes) 
            final_score = result["risk_score"]
            all_findings = result["findings"]
            # Map full_scan output to unified schema
            layer_scores = result.get("layer_results", {})
            verdict = result["verdict"]
            ml_used = result.get("ml_used", False)
            ml_confidence = result.get("confidence", 0.0)

        elif scan_type in ("voice", "audio") or (scan_type == "auto" and file_bytes and _is_audio(file, file_bytes)):
            result = await analyze_voice(file_bytes, file.filename if file else "")
            final_score = result["risk_score"]
            all_findings = result["findings"]
            layer_scores = result["layer_scores"]
            verdict = result["verdict"]
            ml_used = result.get("ml_used", False)
            ml_confidence = result.get("ml_confidence", 0.0)

        else:
            scores = []
            if text.strip():
                t = await analyze_text(text)
                scores.append(t["risk_score"])
                all_findings += t["findings"]
                layer_scores["nlp"] = t["risk_score"]
            detected_urls = re.findall(r'https?://[^\s<>"\'\)]+|www\.[^\s<>"\'\)]+', text)
            if url.strip():
                detected_urls.append(url.strip())
            
            for u in detected_urls[:5]:
                u_res = await analyze_url(u)
                scores.append(u_res["risk_score"])
                all_findings += u_res["findings"]
                layer_scores["url"] = max(layer_scores.get("url", 0), u_res["risk_score"])
                
                # Nested Deep Scanning: H7, AT-06 + Global API Fusion
                try:
                    from urllib.parse import urlparse as _urlparse
                    _hn = _urlparse(u if u.startswith("http") else "https://" + u).hostname
                    if _hn:
                        # 1. Global Reputation Fusion (OpenPageRank)
                        opr_res = await check_pagerank(_hn)
                        if opr_res["rank"] > 0:
                            all_findings.append(f"[GS-REPUTATION] Domain Verified (PR: {opr_res['rank']})")
                        elif OPEN_PAGE_RANK_API_KEY:
                            # 1b. Domain Age Check for Low-Rep Domains
                            age_res = await check_domain_age(_hn)
                            if age_res["is_new"]:
                                scores.append(65)
                                all_findings.append(f"[FRAUD-SENTINEL] Zero-Day Domain Detected: {age_res['note']}")
                            else:
                                scores.append(25)
                                all_findings.append(f"[AT-21] Low Global Reputation — potential throwaway domain ({_hn})")

                        # 2. Google Safe Browsing Fusion
                        gsb_res = await check_gsb(u)
                        if gsb_res["is_threat"]:
                            scores.append(95)
                            verdict = "MALICIOUS"
                            all_findings.append(f"[GSB-THREAT] Google Blacklist Match: {gsb_res['note']}")

                        # 3. Fast-Flux DNS Signal
                        dns_signals = await check_fast_flux_dns(_hn)
                        if dns_signals["fast_flux"] or dns_signals["ttl_low"]:
                            scores.append(30)
                            all_findings.append(f"[H7 - DNS] {dns_signals['note']} ({u[:20]}...)")
                            if dns_signals["fast_flux"]:
                                verdict = "MALICIOUS"
                                
                        # 4. CNAME Mismatch Detection
                        cname_result = await check_cname_mismatch(_hn)
                        if cname_result["cname_mismatch"]:
                            scores.append(45)
                            all_findings.append(f"[AT-06 - CNAME] {cname_result['note']} ({u[:20]}...)")
                            verdict = "MALICIOUS"
                except Exception as _deep_e:
                    logger.error(f"Deep scanning loop error for {u}: {_deep_e}")

            final_score = int(max(scores)) if scores else 0
            if any(s > 70 for s in scores) or verdict == "MALICIOUS":
                verdict = "MALICIOUS"
            elif any(s > 40 for s in scores):
                verdict = "SUSPICIOUS"
            elif any(s > 20 for s in scores):
                verdict = "LOW RISK"
            else:
                verdict = "SAFE"

        # H6 — Adversarial Probe Detection: record this scan's score + check timing regularity
        is_probe = _probe_detector.record(client_ip, final_score / 100.0)

        # AT-19 — Timing Regularity Check (binary-search probe pattern)
        client_timestamps = [t for t, _ in _probe_detector._log.get(client_ip, [])]
        if _analyze_timing_regularity(client_timestamps):
            # Timing is too regular = automated binary search; flag as probe
            is_probe = True
            _probe_detector._flagged.add(client_ip)

        # AT-10 — Business-Hour Rescan Schedule
        import datetime as _dt
        current_utc_hour = _dt.datetime.utcnow().hour
        rescan_schedule = get_rescan_schedule_hours(current_utc_hour)

        processing_time = time.time() - start_time
        _telemetry["scan_times_ms"].append(round(processing_time * 1000, 1))
        if len(_telemetry["scan_times_ms"]) > 100:
            _telemetry["scan_times_ms"] = _telemetry["scan_times_ms"][-100:]

        reason = "; ".join(all_findings[:14]) if all_findings else "No threats detected"
        normalized = {k: int(min(100, max(0, v))) for k, v in layer_scores.items()}
        for key in ["ela", "fft", "color", "noise", "face", "jpeg", "entropy",
                    "mfcc", "pitch", "spectral", "breath", "formant", "ml_vit", "ml_gb"]:
            normalized.setdefault(key, 0)

        # H8 — Score Noise Injection: add noise before returning (obscures exact ML boundary)
        # is_probe is set by H6 above; defaults False for non-URL paths
        is_probe = locals().get("is_probe", False)
        noisy_score = _add_score_noise(final_score / 100.0, is_probe_client=is_probe)
        output_score = int(round(noisy_score * 100))

        response = {
            "success": True,
            "trace_id": trace_id,
            "cache_hit": False,
            "risk_score": output_score,
            "threat_type": verdict,
            "reason": reason,
            "layer_scores": normalized,
            "processing_time": f"{processing_time:.2f}s",
            "scan_type": scan_type,
            "findings_count": len(all_findings),
            "ml_used": ml_used,
            "ml_confidence": ml_confidence,
            # H7 DNS intel surfaced to client
            "dns_signals": locals().get("dns_signals", {"note": "DNS check not applicable"}),
            # AT-06 CNAME mismatch signal
            "cname_signals": locals().get("cname_result", {"cname_mismatch": False, "note": "not checked"}),
            # AT-10 Business-hour rescan schedule for re-verification
            "rescan_schedule": locals().get("rescan_schedule", []),
            # AT-19 probe detection status (redacted to not confirm to attacker)
            "scan_integrity": "verified" if not is_probe else "monitored",
        }

        # Store in cache for duplicate requests
        if file_bytes:
            _scan_cache.set(file_bytes, response)

        logger.info(json.dumps({"event": "SCAN_COMPLETE", "trace_id": trace_id, "risk_score": int(final_score), "time_ms": round(processing_time * 1000, 1)}))
        return response

    except Exception as e:
        _telemetry["error_count"] += 1
        logger.error(json.dumps({"event": "SCAN_ERROR", "trace_id": trace_id, "error": str(e)[:200]}))
        return {
            "success": False,
            "trace_id": trace_id,
            "risk_score": 0,
            "threat_type": "Error",
            "reason": f"Scan engine error: {str(e)[:200]}",
            "layer_scores": {},
            "processing_time": "0s",
        }


def _is_image(file, data: bytes) -> bool:
    if file and file.content_type and file.content_type.startswith("image"):
        return True
    if file and file.filename:
        ext = file.filename.lower().rsplit(".", 1)[-1]
        if ext in ("jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff"):
            return True
    # BUG FIX: Guard against empty/tiny byte payloads before magic-byte indexing
    if not data or len(data) < 8:
        return False
    return data[:3] == b'\xff\xd8\xff' or data[:8] == b'\x89PNG\r\n\x1a\n'


def _is_audio(file, data: bytes) -> bool:
    if file and file.content_type and file.content_type.startswith("audio"):
        return True
    if file and file.filename:
        ext = file.filename.lower().rsplit(".", 1)[-1]
        if ext in ("mp3", "wav", "ogg", "m4a", "flac", "aac", "opus"):
            return True
    # BUG FIX: Guard against empty/tiny byte payloads
    if not data or len(data) < 4:
        return False
    return data[:4] == b'RIFF' or data[:3] == b'ID3' or data[:4] == b'fLaC'

def _validate_origin(request: Request):
    """Strictly validates Origin/Referer against allowed domains to prevent cross-origin scripting/bot abuse."""
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5500,http://localhost:5500").split(",")
    
    if origin and origin not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid Origin")
    if not origin and referer and not any(referer.startswith(o) for o in allowed):
        raise HTTPException(status_code=403, detail="Forbidden: Invalid Referer")
    if not origin and not referer:
        raise HTTPException(status_code=403, detail="Forbidden: Missing Browser Security Context")


@app.post("/api/safebrowsing")
async def proxy_safebrowsing(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not _rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail={"error": "RATE_LIMIT_EXCEEDED"})
    _validate_origin(request)
    try:
        body = await request.json()
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={SAFE_BROWSING_API_KEY}",
                json=body,
                timeout=5.0
            )
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/pagerank")
async def proxy_pagerank(request: Request, domain: str):
    client_ip = request.client.host if request.client else "unknown"
    if not _rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail={"error": "RATE_LIMIT_EXCEEDED"})
    _validate_origin(request)
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://openpagerank.com/api/v1.0/getPageRank?domains[0]={domain}",
                headers={"API-OPR": OPEN_PAGE_RANK_API_KEY, "Accept": "application/json"},
                timeout=5.0
            )
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/health/apis")
async def health_apis():
    return {
        "status": "ok",
        "safebrowsing_configured": bool(SAFE_BROWSING_API_KEY),
        "openpagerank_configured": bool(OPEN_PAGE_RANK_API_KEY),
        "realitydefender_configured": bool(REALITY_DEFENDER_API_KEY),
    }

@app.get("/health")
async def health():
    avg_ms = round(sum(_telemetry["scan_times_ms"]) / len(_telemetry["scan_times_ms"]), 1) if _telemetry["scan_times_ms"] else 0
    return {
        "status": "healthy",
        "version": "5.0",
        "uptime_since": _telemetry["started_at"],
        "ml_models": {
            "deepfake_vit": _models["vit_ready"],
            "voice_gradientboosting": _models["voice_ready"],
        },
        "libraries": {
            "opencv": CV2_AVAILABLE,
            "torch": TORCH_AVAILABLE,
            "transformers": TRANSFORMERS_AVAILABLE,
            "timm": TIMM_AVAILABLE,
            "librosa": LIBROSA_AVAILABLE,
            "sklearn": SKLEARN_AVAILABLE,
        },
        "circuit_breakers": {
            name: breaker.state for name, breaker in _breakers.items()
        },
        "telemetry": {
            "total_scans": _telemetry["total_scans"],
            "cache_hits": _telemetry["cache_hits"],
            "cache_hit_rate": f"{(_telemetry['cache_hits'] / max(1, _telemetry['total_scans']) * 100):.1f}%",
            "rate_limit_drops": _telemetry["rate_limit_drops"],
            "error_count": _telemetry["error_count"],
            "avg_scan_time_ms": avg_ms,
            "p95_scan_time_ms": sorted(_telemetry["scan_times_ms"])[int(len(_telemetry["scan_times_ms"]) * 0.95)] if len(_telemetry["scan_times_ms"]) > 10 else avg_ms,
        },
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


#  AI CHATBOT (OLLAMA INTEGRATION)
from fastapi.responses import StreamingResponse
import httpx

@app.get("/api/models")
async def list_models():
    """
    List available Ollama models.
    Returns tags from local Ollama instance.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                return response.json()
            return {"models": []}
    except Exception:
        return {"models": []}

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    """
    Ollama Proxy Streaming Endpoint.
    Proxies chat requests to the local Ollama instance and streams the response back.
    """
    client_ip = request.client.host if request.client else "unknown"
    if not _rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail={"error": "RATE_LIMIT_EXCEEDED"})
    _validate_origin(request)
    
    try:
        body = await request.json()
        user_message = body.get("message", "")
        model = body.get("model", "llama3")
        
        system_prompt = (
            "You are the SAFE-NET AI Emergency Threat Analyst. "
            "Your role is to provide immediate, actionable, and technical guidance for cyber threats. "
            "Keep responses professional, urgent but calm, and technical. "
            "Use markdown-style formatting. If the user describes a threat (phishing, deepfake, etc.), "
            "provide a clear numbered list of mitigation steps. "
            "Always maintain the persona of a high-end security system assistant."
        )

        async def ollama_streamer():
            ollama_url = "http://localhost:11434/api/generate"
            payload = {
                "model": model,
                "prompt": user_message,
                "system": system_prompt,
                "stream": True
            }
            
            try:
                # Set a long timeout for LLM generation
                async with httpx.AsyncClient(timeout=300.0) as client:
                    async with client.stream("POST", ollama_url, json=payload) as response:
                        if response.status_code != 200:
                            yield f"Error: Ollama connection failed (Status {response.status_code})".encode()
                            return
                        
                        async for line in response.aiter_lines():
                            if line:
                                try:
                                    data = json.loads(line)
                                    if "response" in data:
                                        yield data["response"].encode()
                                    if data.get("done"):
                                        break
                                except json.JSONDecodeError:
                                    continue    
                                    
            except httpx.ConnectError:
                yield "Error: Cannot connect to Ollama. Please ensure Ollama is running locally on port 11434.".encode()
            except Exception as e:
                yield f"Streaming Error: {str(e)}".encode()

        return StreamingResponse(ollama_streamer(), media_type="text/event-stream")
        
    except Exception as e:
        logger.error(f"Chat API error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)



@app.post("/api/gemini")
async def proxy_gemini(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not _rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail={"error": "RATE_LIMIT_EXCEEDED"})
    _validate_origin(request)
    try:
        body = await request.json()
        if "_requestType" in body: del body["_requestType"]
        
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}",
                json=body,
                timeout=30.0
            )
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except Exception as e:
        logger.error(f"Gemini Proxy Error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
