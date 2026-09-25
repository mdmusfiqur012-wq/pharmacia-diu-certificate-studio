/* Browser certificate renderer for the published studio. */
const CertificateStudio = (() => {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  let cssCache = "";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rich(value) {
    return esc(String(value || "").trim())
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function eventPhrase(settings) {
    const kind = settings.eventKind || "seminar";
    return kind === "custom" ? (settings.eventCustom || "programme") : kind;
  }

  function nameClass(name) {
    const n = name.length;
    if (n > 54) return "xxlong";
    if (n > 42) return "xlong";
    if (n > 28) return "long";
    return "";
  }

  function programmeClass(programme) {
    const n = programme.length;
    if (n > 52) return "xlong";
    if (n > 34) return "long";
    return "";
  }

  function density(settings) {
    const score = (settings.details || "").length + (settings.organizer || "").length + (settings.recognition || "").length;
    if (score > 560) return "dense";
    if (score > 390) return "tight";
    return "";
  }

  function formatDate(iso) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => !n)) return "25 September 2026";
    return `${parts[2]} ${MONTHS[parts[1] - 1]} ${parts[0]}`;
  }

  function quoted(programme) {
    const text = String(programme || "").trim().replace(/^["'“”]+|["'“”]+$/g, "");
    return `“${text}”`;
  }

  function certificateNumber(index, settings) {
    const prefix = String(settings.idPrefix || "PCDIU").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
    const number = Number(settings.startNumber || 1) + index;
    return `${prefix}-${String(number).padStart(3, "0")}`;
  }

  function cornerBand(ox, oy, sx, sy, d1, d2) {
    const pts = d1 <= 0.05 ? [[0, 0], [d2, 0], [0, d2]] : [[d1, 0], [d2, 0], [0, d2], [0, d1]];
    return pts.map(([x, y]) => `${(ox + sx * x).toFixed(2)},${(oy + sy * y).toFixed(2)}`).join(" ");
  }

  function chamfer(inset, cut, w = 297, h = 210) {
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    return `M ${(x0 + cut).toFixed(2)},${y0.toFixed(2)} H ${(x1 - cut).toFixed(2)} L ${x1.toFixed(2)},${(y0 + cut).toFixed(2)} V ${(y1 - cut).toFixed(2)} L ${(x1 - cut).toFixed(2)},${y1.toFixed(2)} H ${(x0 + cut).toFixed(2)} L ${x0.toFixed(2)},${(y1 - cut).toFixed(2)} V ${(y0 + cut).toFixed(2)} Z`;
  }

  function frameSvg() {
    const navy = "#0F3E72";
    const green = "#4EA35F";
    const bands = [];
    for (const [ox, oy, sx, sy, specs] of [
      [0, 0, 1, 1, [[0, 15.2, navy], [16.6, 25.4, green], [26.8, 32.4, navy]]],
      [297, 210, -1, -1, [[0, 15.2, navy], [16.6, 25.4, green], [26.8, 32.4, navy]]],
      [297, 0, -1, 1, [[0, 7.2, green], [8.6, 14.2, navy], [15.5, 19.4, green]]],
      [0, 210, 1, -1, [[0, 7.2, green], [8.6, 14.2, navy], [15.5, 19.4, green]]],
    ]) {
      for (const [d1, d2, color] of specs) {
        bands.push(`<polygon points="${cornerBand(ox, oy, sx, sy, d1, d2)}" fill="${color}"/>`);
      }
    }
    return `<svg class="frame" viewBox="0 0 297 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${bands.join("")}<path d="${chamfer(3.5, 15.6)}" fill="none" stroke="#2F9B62" stroke-width="0.55"/><path d="${chamfer(5.05, 14.05)}" fill="none" stroke="#0F3E72" stroke-width="0.38"/></svg>`;
  }

  function leafSvg() {
    return `<svg class="leaf-rule" viewBox="0 0 220 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line x1="2" y1="13" x2="86" y2="13" stroke="#1d4e86" stroke-width="1.25" stroke-linecap="round"/><path d="M110 21.5C110 21.5 96 13 94 4.5c6.2.2 12 4.6 16 17z" fill="#1f8a48"/><path d="M110 21.5C110 21.5 124 13 126 4.5c-6.2.2-12 4.6-16 17z" fill="#146b38"/><path d="M110 20.2V6.5" stroke="#0e5c30" stroke-width="0.8" stroke-linecap="round"/><line x1="134" y1="13" x2="218" y2="13" stroke="#1d4e86" stroke-width="1.25" stroke-linecap="round"/></svg>`;
  }

  function brainSvg() {
    return `<svg class="brain" viewBox="0 0 120 108" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M60 16c-14 0-24 10-25 24-8 2-14 10-12 20 2 8 8 12 14 13-1 8 4 16 13 18 4 6 12 10 20 8 8 2 16-2 20-8 9-2 14-10 13-18 6-1 12-5 14-13 2-10-4-18-12-20C84 26 74 16 60 16z" fill="none" stroke="#b7ddd0" stroke-width="2.3"/><path d="M60 20v74" stroke="#b7ddd0" stroke-width="1.6"/><circle cx="44" cy="40" r="3.3" fill="none" stroke="#b7ddd0" stroke-width="1.5"/><circle cx="76" cy="38" r="3.3" fill="none" stroke="#b7ddd0" stroke-width="1.5"/><circle cx="38" cy="58" r="2.8" fill="none" stroke="#b7ddd0" stroke-width="1.5"/><circle cx="82" cy="60" r="2.8" fill="none" stroke="#b7ddd0" stroke-width="1.5"/><circle cx="48" cy="76" r="2.5" fill="none" stroke="#b7ddd0" stroke-width="1.5"/><circle cx="73" cy="74" r="2.5" fill="none" stroke="#b7ddd0" stroke-width="1.5"/><path d="M44 40H60M76 38H60M44 40 38 58 48 76M76 38 82 60 73 74" fill="none" stroke="#b7ddd0" stroke-width="1.25"/><rect x="16" y="86" width="6" height="6" fill="none" stroke="#c5e6dc" stroke-width="1.3"/><rect x="26" y="96" width="5" height="5" fill="none" stroke="#c5e6dc" stroke-width="1.2"/><rect x="98" y="28" width="5" height="5" fill="none" stroke="#c5e6dc" stroke-width="1.2"/><rect x="8" y="70" width="4.5" height="4.5" fill="none" stroke="#c5e6dc" stroke-width="1.1"/></svg>`;
  }

  function leadHtml(settings) {
    const custom = (settings.recognition || "").trim();
    if (custom) return rich(custom);
    return `In recognition of your valuable contribution as a <strong>${esc(settings.role || "Participant")}</strong> in the ${esc(eventPhrase(settings))} on`;
  }

  function signBlock(title, org1, org2, person, img) {
    return `<div class="sign"><div class="sig-slot">${img ? `<img src="${img}" alt="">` : ""}</div><div class="rule"></div>${person ? `<div class="sig-name">${esc(person)}</div>` : ""}<div class="sig-title">${esc(title)}</div><div class="sig-org">${esc(org1)}</div>${org2 ? `<div class="sig-org">${esc(org2)}</div>` : ""}</div>`;
  }

  function sheet(name, settings, index, hod, conv) {
    const classes = [];
    if (!settings.watermark) classes.push("no-wm");
    if (!settings.artwork) classes.push("no-art");
    const display = (name || "").trim() || "Recipient Name";
    const placeholder = (name || "").trim() ? "" : " placeholder";
    const dateHtml = settings.showDate ? `<p class="date-line">${esc(formatDate(settings.date))}</p>` : "";
    const numberHtml = settings.showNumber ? `<div class="certno">No. ${esc(certificateNumber(index, settings))}</div>` : "";
    return `<article class="sheet ${classes.join(" ")}">${frameSvg()}<img class="wm-diu" src="assets/diu-logo-pale.png" alt=""><img class="wm-bowl" src="assets/bowl-pale.png" alt="">${brainSvg()}<header class="brand"><div class="brand-left"><img class="mark" src="assets/bowl-mark.png" alt=""><div class="vbar"></div><div class="club-copy"><div class="club-name">PHARMACIA <span class="g">CLUB DIU</span></div><div class="tagline">LEARN  |  CONNECT  |  CREATE IMPACT</div></div></div><img class="diu-logo" src="assets/diu-logo.png" alt="Daffodil International University"></header><div class="title-block"><h1 class="heading">${esc(settings.heading)}</h1><p class="subheading">${esc(settings.subheading)}</p>${leafSvg()}</div><p class="presented">${esc(settings.presented)}</p><div class="name-rule"></div><div class="name-block"><h2 class="recipient${placeholder} ${nameClass(display)}">${esc(display)}</h2>${dateHtml}</div><div class="body ${density(settings)}"><p class="lead">${leadHtml(settings)}</p><p class="programme ${programmeClass(settings.programme || "")}">${esc(quoted(settings.programme || ""))}</p><p class="org">${rich(settings.organizer || "")}</p><p class="details">${rich(settings.details || "")}</p><p class="thanks">${esc(settings.closing || "")}</p></div><footer class="signs">${signBlock(settings.leftTitle, settings.leftOrg1, settings.leftOrg2, settings.leftName, conv)}${signBlock(settings.rightTitle, settings.rightOrg1, settings.rightOrg2, settings.rightName, hod)}</footer>${numberHtml}</article>`;
  }

  async function css() {
    if (cssCache) return cssCache;
    const [faces, extra] = await Promise.all([
      fetch("fonts/faces.css").then((r) => r.text()),
      fetch("certificate.css").then((r) => r.text()),
    ]);
    cssCache = `${faces.replaceAll("__PREFIX__", "fonts/")}\n${extra}`;
    return cssCache;
  }

  async function renderDocument(names, settings, hodSignature, convenorSignature, indexOffset = 0) {
    const hod = hodSignature === "" ? "" : (hodSignature || "assets/signature.png");
    const conv = convenorSignature || "";
    const list = names && names.length ? names : [""];
    const sheets = list.map((name, i) => sheet(name, settings, indexOffset + i, hod, conv)).join("");
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Certificate · ${esc(settings.programme || "Certificate")}</title><style>${await css()}</style></head><body>${sheets}</body></html>`;
  }

  return { renderDocument };
})();
