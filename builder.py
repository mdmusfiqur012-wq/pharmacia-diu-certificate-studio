"""Certificate HTML for the Pharmacia Club DIU template."""

from __future__ import annotations

import html
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FACES = (ROOT / "fonts" / "faces.css").read_text(encoding="utf-8")
CERT_CSS = (ROOT / "static" / "certificate.css").read_text(encoding="utf-8")

MAX_NAMES = 100

DEFAULTS = {
    "heading": "CERTIFICATE",
    "subheading": "OF APPRECIATION",
    "presented": "THIS CERTIFICATE IS PROUDLY PRESENTED TO",
    "role": "Facilitator",
    "eventKind": "seminar",
    "eventCustom": "",
    "programme": "AI in Research",
    "organizer": (
        "organized by the **Department of Pharmacy**,\n"
        "**Daffodil International University**,\n"
        "in collaboration with **Pharmacia Club DIU**."
    ),
    "details": (
        "Your expertise, insights and dedication have greatly enriched "
        "the knowledge and learning experience of all participants."
    ),
    "closing": "Thank you for being a part of this meaningful initiative.",
    "recognition": "",
    "leftTitle": "Club Convenor",
    "leftOrg1": "Pharmacia Club DIU",
    "leftOrg2": "",
    "leftName": "",
    "rightTitle": "Head of the Department",
    "rightOrg1": "Department of Pharmacy",
    "rightOrg2": "Daffodil International University",
    "rightName": "",
    "showDate": False,
    "date": "2026-09-25",
    "showNumber": False,
    "idPrefix": "PCDIU-2026",
    "startNumber": 1,
    "watermark": True,
    "artwork": True,
}

LIMITS = {
    "heading": 42,
    "subheading": 42,
    "presented": 90,
    "role": 48,
    "eventKind": 40,
    "eventCustom": 48,
    "programme": 90,
    "organizer": 420,
    "details": 480,
    "closing": 180,
    "recognition": 240,
    "leftTitle": 52,
    "leftOrg1": 64,
    "leftOrg2": 64,
    "leftName": 64,
    "rightTitle": 52,
    "rightOrg1": 64,
    "rightOrg2": 64,
    "rightName": 64,
    "idPrefix": 24,
}

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def rich(value: str) -> str:
    text = esc(value).strip()
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    return text.replace("\n", "<br>")


def as_bool(value, default=False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).lower() in {"1", "true", "yes", "on"}


def clip(value, key: str) -> str:
    text = re.sub(r"[ \t]+", " ", str(value or "")).strip()
    # Keep intentional newlines in longer fields.
    if key in {"organizer", "details", "recognition"}:
        text = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    return text[: LIMITS.get(key, 200)]


def normalize(raw: dict | None) -> dict:
    src = raw or {}
    out = dict(DEFAULTS)
    for key in DEFAULTS:
        if key in src and key not in {"showDate", "showNumber", "watermark", "artwork", "startNumber"}:
            out[key] = clip(src.get(key), key)
    out["showDate"] = as_bool(src.get("showDate"), DEFAULTS["showDate"])
    out["showNumber"] = as_bool(src.get("showNumber"), DEFAULTS["showNumber"])
    out["watermark"] = as_bool(src.get("watermark"), DEFAULTS["watermark"])
    out["artwork"] = as_bool(src.get("artwork"), DEFAULTS["artwork"])
    try:
        start = int(src.get("startNumber") or DEFAULTS["startNumber"])
    except (TypeError, ValueError):
        start = 1
    out["startNumber"] = max(1, min(start, 900))
    if not out["programme"]:
        out["programme"] = DEFAULTS["programme"]
    if not out["heading"]:
        out["heading"] = DEFAULTS["heading"]
    if not out["role"]:
        out["role"] = DEFAULTS["role"]
    return out


def clean_names(names, required=True) -> list[str]:
    cleaned = []
    for raw in names or []:
        if not isinstance(raw, str):
            continue
        name = re.sub(r"\s+", " ", raw).strip()
        name = re.sub(r"^\d+[\.\)\-:]\s*", "", name).strip(" \"'")
        if not name:
            continue
        if name.lower() in {"name", "student", "student name", "full name", "sl", "sl."}:
            continue
        cleaned.append(name[:80])
    if len(cleaned) > MAX_NAMES:
        raise ValueError(f"A maximum of {MAX_NAMES} names is allowed.")
    if required and not cleaned:
        raise ValueError("Add at least one student name.")
    return cleaned


def format_date(iso: str) -> str:
    try:
        year, month, day = [int(part) for part in str(iso).split("-")]
        stamp = date(year, month, day)
    except (TypeError, ValueError):
        stamp = date(2026, 9, 25)
    return f"{stamp.day} {MONTHS[stamp.month - 1]} {stamp.year}"


def quoted(programme: str) -> str:
    text = programme.strip().strip("\"'“”")
    return f"“{text}”"


def event_phrase(settings: dict) -> str:
    kind = settings.get("eventKind") or "seminar"
    if kind == "custom":
        return settings.get("eventCustom") or "programme"
    return kind


def name_class(name: str) -> str:
    length = len(name)
    if length > 54:
        return "xxlong"
    if length > 42:
        return "xlong"
    if length > 28:
        return "long"
    return ""


def programme_class(programme: str) -> str:
    length = len(programme)
    if length > 52:
        return "xlong"
    if length > 34:
        return "long"
    return ""


def density(settings: dict) -> str:
    score = len(settings.get("details") or "") + len(settings.get("organizer") or "")
    score += len(settings.get("recognition") or "")
    if score > 560:
        return "dense"
    if score > 390:
        return "tight"
    return ""


def certificate_number(index: int, settings: dict) -> str:
    prefix = re.sub(r"\s+", "-", settings.get("idPrefix") or "PCDIU").strip("-")
    number = int(settings.get("startNumber") or 1) + index
    return f"{prefix}-{number:03d}"


def safe_data_url(value) -> str:
    if not isinstance(value, str):
        return ""
    if not value.startswith("data:image/"):
        return ""
    if len(value) > 1_800_000:
        raise ValueError("A signature image is too large. Use a smaller PNG or JPG.")
    head = value.split(",", 1)[0].lower()
    if not any(kind in head for kind in ("image/png", "image/jpeg", "image/jpg", "image/webp")):
        raise ValueError("Signature must be a PNG, JPG, or WebP image.")
    return value


def asset(mode: str, filename: str) -> str:
    return f"/assets/{filename}" if mode == "browser" else f"assets/{filename}"


def font_css(mode: str) -> str:
    prefix = "/fonts/" if mode == "browser" else "fonts/"
    return FACES.replace("__PREFIX__", prefix) + "\n" + CERT_CSS


def corner_band(ox, oy, sx, sy, d1, d2) -> str:
    if d1 <= 0.05:
        pts = [(0, 0), (d2, 0), (0, d2)]
    else:
        pts = [(d1, 0), (d2, 0), (0, d2), (0, d1)]
    return " ".join(f"{ox + sx * x:.2f},{oy + sy * y:.2f}" for x, y in pts)


def chamfer(inset: float, cut: float, w=297, h=210) -> str:
    x0, y0 = inset, inset
    x1, y1 = w - inset, h - inset
    return (
        f"M {x0 + cut:.2f},{y0:.2f} H {x1 - cut:.2f} L {x1:.2f},{y0 + cut:.2f} "
        f"V {y1 - cut:.2f} L {x1 - cut:.2f},{y1:.2f} H {x0 + cut:.2f} "
        f"L {x0:.2f},{y1 - cut:.2f} V {y0 + cut:.2f} Z"
    )


def frame_svg() -> str:
    navy = "#0F3E72"
    green = "#4EA35F"
    bands = []
    # Large ribbons, top-left and bottom-right.
    for ox, oy, sx, sy, specs in (
        (0, 0, 1, 1, ((0, 15.2, navy), (16.6, 25.4, green), (26.8, 32.4, navy))),
        (297, 210, -1, -1, ((0, 15.2, navy), (16.6, 25.4, green), (26.8, 32.4, navy))),
    ):
        for d1, d2, color in specs:
            bands.append(
                f'<polygon points="{corner_band(ox, oy, sx, sy, d1, d2)}" fill="{color}"/>'
            )
    # Smaller accents, top-right and bottom-left.
    for ox, oy, sx, sy, specs in (
        (297, 0, -1, 1, ((0, 7.2, green), (8.6, 14.2, navy), (15.5, 19.4, green))),
        (0, 210, 1, -1, ((0, 7.2, green), (8.6, 14.2, navy), (15.5, 19.4, green))),
    ):
        for d1, d2, color in specs:
            bands.append(
                f'<polygon points="{corner_band(ox, oy, sx, sy, d1, d2)}" fill="{color}"/>'
            )
    outer = chamfer(3.5, 15.6)
    inner = chamfer(5.05, 14.05)
    return f'''<svg class="frame" viewBox="0 0 297 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {''.join(bands)}
      <path d="{outer}" fill="none" stroke="#2F9B62" stroke-width="0.55"/>
      <path d="{inner}" fill="none" stroke="#0F3E72" stroke-width="0.38"/>
    </svg>'''


def bowl_svg(fill="#0F3E72", leaf="#1C8A48", vein="#0E6A34") -> str:
    return f'''<svg viewBox="0 0 86 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="33" cy="88.2" rx="15.2" ry="5.1" fill="{fill}"/>
      <path fill="{fill}" d="M27.2 64.5h11.6v17.2c-.4 1.6-2.6 2.6-5.8 2.6s-5.4-1-5.8-2.6z"/>
      <path fill="{fill}" fill-rule="evenodd" d="M5.5 39.5c0-12.2 10.2-20.2 27.5-20.2 17.2 0 27.4 8 27.4 20.2 0 13.6-10.6 22.6-27.4 22.6C16.1 62.1 5.5 53.1 5.5 39.5zm9.6-1.2c.8-7.4 7-12.2 17.9-12.2s17.1 4.8 17.9 12.2c-1.5 8.2-8.2 13.6-17.9 13.6s-16.4-5.4-17.9-13.6z"/>
      <path fill="{fill}" d="M20.2 27.2c-1.3-10.4 6.2-18.6 16.6-19.2 4.2-.2 7.2 2.2 6.2 6.1-1.1 4.2-6.4 5.2-9.4 8.8-2.1 2.5-4.6 5-8.2 5.6-2.2.4-4.6.1-5.2-1.3z"/>
      <path fill="{leaf}" d="M51.5 45.2c10.2-4.6 22.6.4 24.8 13.6-11.2 1.2-19.6-2.2-24.8-13.6z"/>
      <path d="M57.2 51.4c6.2.2 12.2 2.6 16.2 6.2" stroke="{vein}" stroke-width="1.15" fill="none" stroke-linecap="round"/>
    </svg>'''


def leaf_svg() -> str:
    return '''<svg class="leaf-rule" viewBox="0 0 220 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="2" y1="13" x2="86" y2="13" stroke="#1d4e86" stroke-width="1.25" stroke-linecap="round"/>
      <path d="M110 21.5C110 21.5 96 13 94 4.5c6.2.2 12 4.6 16 17z" fill="#1f8a48"/>
      <path d="M110 21.5C110 21.5 124 13 126 4.5c-6.2.2-12 4.6-16 17z" fill="#146b38"/>
      <path d="M110 20.2V6.5" stroke="#0e5c30" stroke-width="0.8" stroke-linecap="round"/>
      <line x1="134" y1="13" x2="218" y2="13" stroke="#1d4e86" stroke-width="1.25" stroke-linecap="round"/>
    </svg>'''


def brain_svg() -> str:
    return '''<svg class="brain" viewBox="0 0 120 108" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M60 16c-14 0-24 10-25 24-8 2-14 10-12 20 2 8 8 12 14 13-1 8 4 16 13 18 4 6 12 10 20 8 8 2 16-2 20-8 9-2 14-10 13-18 6-1 12-5 14-13 2-10-4-18-12-20C84 26 74 16 60 16z" fill="none" stroke="#b7ddd0" stroke-width="2.3"/>
      <path d="M60 20v74" stroke="#b7ddd0" stroke-width="1.6"/>
      <circle cx="44" cy="40" r="3.3" fill="none" stroke="#b7ddd0" stroke-width="1.5"/>
      <circle cx="76" cy="38" r="3.3" fill="none" stroke="#b7ddd0" stroke-width="1.5"/>
      <circle cx="38" cy="58" r="2.8" fill="none" stroke="#b7ddd0" stroke-width="1.5"/>
      <circle cx="82" cy="60" r="2.8" fill="none" stroke="#b7ddd0" stroke-width="1.5"/>
      <circle cx="48" cy="76" r="2.5" fill="none" stroke="#b7ddd0" stroke-width="1.5"/>
      <circle cx="73" cy="74" r="2.5" fill="none" stroke="#b7ddd0" stroke-width="1.5"/>
      <path d="M44 40H60M76 38H60M44 40 38 58 48 76M76 38 82 60 73 74" fill="none" stroke="#b7ddd0" stroke-width="1.25"/>
      <rect x="16" y="86" width="6" height="6" fill="none" stroke="#c5e6dc" stroke-width="1.3"/>
      <rect x="26" y="96" width="5" height="5" fill="none" stroke="#c5e6dc" stroke-width="1.2"/>
      <rect x="98" y="28" width="5" height="5" fill="none" stroke="#c5e6dc" stroke-width="1.2"/>
      <rect x="8" y="70" width="4.5" height="4.5" fill="none" stroke="#c5e6dc" stroke-width="1.1"/>
    </svg>'''


def lead_html(settings: dict) -> str:
    custom = (settings.get("recognition") or "").strip()
    if custom:
        return rich(custom)
    role = esc(settings.get("role") or "Participant")
    event = esc(event_phrase(settings))
    return (
        "In recognition of your valuable contribution as a "
        f"<strong>{role}</strong> in the {event} on"
    )


def sign_block(title, org1, org2, person, img_src) -> str:
    image = f'<img src="{img_src}" alt="">' if img_src else ""
    person_html = f'<div class="sig-name">{esc(person)}</div>' if person else ""
    org2_html = f'<div class="sig-org">{esc(org2)}</div>' if org2 else ""
    return f'''<div class="sign">
      <div class="sig-slot">{image}</div>
      <div class="rule"></div>
      {person_html}
      <div class="sig-title">{esc(title)}</div>
      <div class="sig-org">{esc(org1)}</div>
      {org2_html}
    </div>'''


def render_sheet(name, settings, index, mode, hod_src, conv_src) -> str:
    classes = []
    if not settings.get("watermark", True):
        classes.append("no-wm")
    if not settings.get("artwork", True):
        classes.append("no-art")
    display = name.strip() if name and name.strip() else "Recipient Name"
    placeholder = "" if name and name.strip() else " placeholder"
    date_html = ""
    if settings.get("showDate"):
        date_html = f'<p class="date-line">{esc(format_date(settings.get("date")))}</p>'
    number_html = ""
    if settings.get("showNumber"):
        number_html = f'<div class="certno">No. {esc(certificate_number(index, settings))}</div>'
    diu = asset(mode, "diu-logo.png")
    bowl = asset(mode, "bowl-mark.png")
    bowl_pale = asset(mode, "bowl-pale.png")
    diu_pale = asset(mode, "diu-logo-pale.png")
    body_class = density(settings)
    return f'''<article class="sheet {' '.join(classes)}">
      {frame_svg()}
      <img class="wm-diu" src="{diu_pale}" alt="">
      <img class="wm-bowl" src="{bowl_pale}" alt="">
      {brain_svg()}
      <header class="brand">
        <div class="brand-left">
          <img class="mark" src="{bowl}" alt="">
          <div class="vbar"></div>
          <div class="club-copy">
            <div class="club-name">PHARMACIA <span class="g">CLUB DIU</span></div>
            <div class="tagline">LEARN  |  CONNECT  |  CREATE IMPACT</div>
          </div>
        </div>
        <img class="diu-logo" src="{diu}" alt="Daffodil International University">
      </header>
      <div class="title-block">
        <h1 class="heading">{esc(settings.get("heading"))}</h1>
        <p class="subheading">{esc(settings.get("subheading"))}</p>
        {leaf_svg()}
      </div>
      <p class="presented">{esc(settings.get("presented"))}</p>
      <div class="name-rule"></div>
      <div class="name-block">
        <h2 class="recipient{placeholder} {name_class(display)}">{esc(display)}</h2>
        {date_html}
      </div>
      <div class="body {body_class}">
        <p class="lead">{lead_html(settings)}</p>
        <p class="programme {programme_class(settings.get("programme") or "")}">{esc(quoted(settings.get("programme") or ""))}</p>
        <p class="org">{rich(settings.get("organizer") or "")}</p>
        <p class="details">{rich(settings.get("details") or "")}</p>
        <p class="thanks">{esc(settings.get("closing") or "")}</p>
      </div>
      <footer class="signs">
        {sign_block(settings.get("leftTitle"), settings.get("leftOrg1"), settings.get("leftOrg2"), settings.get("leftName"), conv_src)}
        {sign_block(settings.get("rightTitle"), settings.get("rightOrg1"), settings.get("rightOrg2"), settings.get("rightName"), hod_src)}
      </footer>
      {number_html}
    </article>'''


def render_document(names, settings, mode="browser", hod_signature=None, convenor_signature=None, index_offset=0) -> str:
    settings = normalize(settings)
    hod = safe_data_url(hod_signature) if hod_signature else ""
    conv = safe_data_url(convenor_signature) if convenor_signature else ""
    if hod_signature is None:
        hod = asset(mode, "signature.png")
    elif hod_signature == "":
        hod = ""
    if not names:
        names = [""]
    sheets = []
    for offset, name in enumerate(names):
        sheets.append(render_sheet(name, settings, index_offset + offset, mode, hod, conv))
    title = esc(settings.get("programme") or "Certificate")
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Certificate · {title}</title>
  <style>
{font_css(mode)}
  </style>
</head>
<body>
{''.join(sheets)}
</body>
</html>'''
