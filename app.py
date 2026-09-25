"""Pharmacia Club DIU certificate studio."""

from __future__ import annotations

import io
import logging
import re
import time
import zipfile
from pathlib import Path

from flask import Flask, Response, jsonify, render_template, request, send_from_directory
from pypdf import PdfReader, PdfWriter
from weasyprint import HTML

from builder import DEFAULTS, MAX_NAMES, ROOT, clean_names, normalize, render_document

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("certificates")


@app.after_request
def cache_assets(response):
    if request.path.startswith("/fonts/") or request.path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=86400"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/")
def index():
    return render_template("index.html", defaults=DEFAULTS, max_names=MAX_NAMES)


@app.get("/assets/<path:filename>")
def assets(filename):
    return send_from_directory(ROOT / "assets", filename)


@app.get("/fonts/<path:filename>")
def fonts(filename):
    return send_from_directory(ROOT / "fonts", filename)


def payload():
    data = request.get_json(silent=True) or {}
    settings = normalize(data.get("settings") or {})
    hod = data.get("hodSignature", None)
    conv = data.get("convenorSignature", None)
    try:
        index = int(data.get("index") or 0)
    except (TypeError, ValueError):
        index = 0
    return data, settings, hod, conv, max(0, index)


def build_pdf(names, settings, hod, conv, index_offset=0) -> bytes:
    html = render_document(
        names,
        settings,
        mode="pdf",
        hod_signature=hod,
        convenor_signature=conv,
        index_offset=index_offset,
    )
    return HTML(string=html, base_url=str(ROOT)).write_pdf()


def filename_for(settings, suffix):
    programme = re.sub(r"[^A-Za-z0-9]+", "-", settings.get("programme") or "Certificates").strip("-")
    programme = programme[:48] or "Certificates"
    return f"Pharmacia-DIU-{programme}.{suffix}"


def header_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-")
    return cleaned or "Pharmacia-DIU-Certificates"


def slug(name: str, index: int) -> str:
    text = re.sub(r'[\\/:*?"<>|]+', "", name)
    text = re.sub(r"\s+", "-", text).strip("-.")
    text = text[:70] or "certificate"
    return f"{index + 1:03d}-{text}.pdf"


@app.post("/api/preview")
def preview():
    try:
        data, settings, hod, conv, index = payload()
        names = clean_names(data.get("names") or [], required=False)
        html = render_document(
            names or [""],
            settings,
            mode="browser",
            hod_signature=hod,
            convenor_signature=conv,
            index_offset=index,
        )
        return Response(html, mimetype="text/html; charset=utf-8")
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except Exception:
        log.exception("preview failed")
        return jsonify(error="Could not build the preview."), 500


@app.post("/api/pdf")
def pdf():
    try:
        data, settings, hod, conv, index = payload()
        names = clean_names(data.get("names") or [], required=True)
        started = time.perf_counter()
        # A single-certificate download should keep its serial number.
        offset = index if len(names) == 1 else 0
        blob = build_pdf(names, settings, hod, conv, index_offset=offset)
        log.info("pdf pages=%s seconds=%.2f", len(names), time.perf_counter() - started)
        name = header_filename(filename_for(settings, "pdf"))
        if len(names) == 1:
            name = header_filename("Pharmacia-DIU-" + slug(names[0], offset))
        return Response(
            blob,
            mimetype="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except Exception:
        log.exception("pdf failed")
        return jsonify(error="Could not generate the PDF. Try fewer names, or shorten the details."), 500


@app.post("/api/zip")
def zip_pdfs():
    try:
        data, settings, hod, conv, _index = payload()
        names = clean_names(data.get("names") or [], required=True)
        started = time.perf_counter()
        blob = build_pdf(names, settings, hod, conv, index_offset=0)
        reader = PdfReader(io.BytesIO(blob))
        if len(reader.pages) < len(names):
            raise RuntimeError("The PDF page count did not match the name list.")
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            for i, person in enumerate(names):
                writer = PdfWriter()
                writer.add_page(reader.pages[i])
                page = io.BytesIO()
                writer.write(page)
                bundle.writestr(slug(person, i), page.getvalue())
        log.info("zip pages=%s seconds=%.2f", len(names), time.perf_counter() - started)
        return Response(
            archive.getvalue(),
            mimetype="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{header_filename(filename_for(settings, "zip"))}"'},
        )
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except Exception:
        log.exception("zip failed")
        return jsonify(error="Could not package the individual PDFs."), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, threaded=True, debug=False)
