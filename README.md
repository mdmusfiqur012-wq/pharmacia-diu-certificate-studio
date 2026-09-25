# Pharmacia Club DIU Certificate Studio

A browser studio for issuing A4 landscape certificates from the Pharmacia Club DIU template. Paste up to 100 names, edit the programme name and details, and download print-ready PDFs.

The department-head signature and a background watermark of the Pharmacia Club mark and the Daffodil International University logo are applied to every certificate.

## Run

```bash
pip install flask weasyprint pypdf
python app.py
```

Open http://127.0.0.1:8080

## Use

1. Set the programme name, role, organiser line, and details. Choose **Student participation** if the certificates are for attendees rather than facilitators.
2. Paste names, one per line, or upload a `.txt` / `.csv` file. Maximum 100.
3. Download one combined PDF, a ZIP of individual PDFs, or print.

Draft settings stay in the browser.
