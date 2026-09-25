const boot = JSON.parse(document.getElementById("boot").textContent);
const DEFAULTS = boot.defaults;
const MAX = boot.maxNames || 100;
const STORE = "pharmacia-diu-cert-studio-v1";

const SAMPLE = [
  "Nusrat Jahan",
  "Md. Rahim Uddin",
  "Fatima Akter",
  "Tanvir Hasan",
  "Ayesha Siddiqua",
  "Sabbir Ahmed",
  "Mitu Rahman",
  "Farhan Kabir",
  "Lamia Chowdhury",
  "Md. Imran Hossain",
];

const STUDENT = {
  subheading: "OF PARTICIPATION",
  role: "Participant",
  details:
    "Your active participation and enthusiasm have greatly enriched the knowledge and learning experience of this programme.",
  closing: "Thank you for being a part of this meaningful initiative.",
  recognition: "",
};

const form = document.getElementById("form");
const namesBox = document.getElementById("names");
const state = {
  index: 0,
  hodSignature: null,
  convenorSignature: null,
  clearArmed: false,
};

let previewTimer = 0;
let previewAbort = null;
let toastTimer = 0;

function $(id) { return document.getElementById(id); }

function readSettings() {
  const data = { ...DEFAULTS };
  for (const el of form.elements) {
    if (!el.name || el.name === "") continue;
    if (el.type === "checkbox") data[el.name] = el.checked;
    else if (el.type === "number") data[el.name] = Number(el.value || DEFAULTS[el.name] || 1);
    else data[el.name] = el.value;
  }
  return data;
}

function writeSettings(settings) {
  for (const el of form.elements) {
    if (!el.name || !(el.name in settings)) continue;
    if (el.type === "checkbox") el.checked = Boolean(settings[el.name]);
    else el.value = settings[el.name] ?? "";
  }
  syncConditional();
}

function extractName(line) {
  let text = line.trim();
  if (!text) return "";
  if (text.includes("\t")) text = text.split("\t")[0].trim();
  else if (text.includes(",")) {
    const [first, ...rest] = text.split(",");
    const tail = rest.join(",").trim();
    if (/^[\d\s./\-]+$/.test(tail) || tail.includes("@")) text = first.trim();
  }
  text = text.replace(/^["']|["']$/g, "").trim();
  text = text.replace(/^\d+[\.\)\-:]\s*/, "").trim();
  text = text.replace(/\s+/g, " ");
  if (/^(name|student|student name|full name|sl\.?|serial)$/i.test(text)) return "";
  return text;
}

function names() {
  return namesBox.value.split(/\r?\n/).map(extractName).filter(Boolean);
}

function setNames(list) {
  namesBox.value = list.join("\n");
  state.index = 0;
  refreshChrome();
  schedulePreview();
  saveDraft();
}

function duplicates(list) {
  const seen = new Map();
  list.forEach((name) => {
    const key = name.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  return [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

function refreshChrome() {
  const list = names();
  const count = list.length;
  if (state.index > Math.max(0, count - 1)) state.index = Math.max(0, count - 1);
  const countEl = $("count");
  countEl.textContent = `${count} / ${MAX}`;
  countEl.classList.toggle("over", count > MAX);
  const pill = $("readyPill");
  if (count > MAX) {
    pill.textContent = `Over the limit · ${count}`;
    pill.classList.remove("ready");
  } else if (count > 0) {
    pill.textContent = `${count} certificate${count === 1 ? "" : "s"} ready`;
    pill.classList.add("ready");
  } else {
    pill.textContent = "Awaiting names";
    pill.classList.remove("ready");
  }
  $("pos").textContent = count ? `${state.index + 1} / ${count}` : "Preview";
  $("posName").textContent = list[state.index] || "Recipient name";
  $("prev").disabled = state.index <= 0;
  $("next").disabled = state.index >= count - 1;
  const blocked = count < 1 || count > MAX;
  $("btnAll").disabled = blocked;
  $("btnZip").disabled = blocked;
  $("btnOne").disabled = blocked || count < 1;
  $("btnPrint").disabled = blocked;
  $("btnAll").textContent = count > 1 ? `Download ${Math.min(count, MAX)} PDFs in one zip` : "Download certificate";
  const warn = $("nameWarn");
  const dups = duplicates(list);
  if (count > MAX) {
    warn.hidden = false;
    warn.innerHTML = `${count} names entered. The studio stops at ${MAX}. <button type="button" id="trimBtn">Keep the first ${MAX}</button>`;
    $("trimBtn").onclick = () => setNames(list.slice(0, MAX));
  } else if (dups.length) {
    warn.hidden = false;
    warn.textContent = `${dups.length} name${dups.length === 1 ? "" : "s"} repeat in the list. Certificates will still be generated for each line.`;
  } else {
    warn.hidden = true;
    warn.textContent = "";
  }
  renderRoster(list);
  const details = form.elements.details.value.length;
  const counter = document.querySelector("[data-count='details']");
  if (counter) counter.textContent = String(details);
}

function renderRoster(list) {
  const roster = $("roster");
  roster.innerHTML = "";
  list.forEach((name, i) => {
    const li = document.createElement("li");
    if (i === state.index) li.className = "active";
    li.innerHTML = `<span class="idx">${String(i + 1).padStart(2, "0")}</span><span class="who"></span><button type="button" class="x" aria-label="Remove name">×</button>`;
    li.querySelector(".who").textContent = name;
    li.addEventListener("click", (event) => {
      if (event.target.closest(".x")) return;
      state.index = i;
      refreshChrome();
      schedulePreview();
    });
    li.querySelector(".x").addEventListener("click", () => {
      const next = names().filter((_, idx) => idx !== i);
      namesBox.value = next.join("\n");
      if (state.index >= next.length) state.index = Math.max(0, next.length - 1);
      refreshChrome();
      schedulePreview();
      saveDraft();
    });
    roster.appendChild(li);
  });
}

function syncConditional() {
  const kind = form.elements.eventKind.value;
  $("customEvent").hidden = kind !== "custom";
  $("dateRow").hidden = !form.elements.showDate.checked;
  $("numRow").hidden = !form.elements.showNumber.checked;
}

function paintSignatures() {
  const hod = $("hodPreview");
  const hodDrop = $("hodDrop");
  if (state.hodSignature === "") {
    hod.removeAttribute("src");
    hod.hidden = true;
    hodDrop.classList.remove("has-image");
    if (!hodDrop.querySelector(".drop-empty")) {
      const span = document.createElement("span");
      span.className = "drop-empty";
      span.textContent = "No signature";
      hodDrop.appendChild(span);
    }
  } else {
    hod.hidden = false;
    hod.src = state.hodSignature || "/assets/signature.png";
    hodDrop.classList.add("has-image");
    hodDrop.querySelector(".drop-empty")?.remove();
  }
  $("hodRestore").hidden = state.hodSignature == null;
  const convDrop = $("convDrop");
  convDrop.innerHTML = "";
  if (state.convenorSignature) {
    const img = document.createElement("img");
    img.src = state.convenorSignature;
    img.alt = "Convenor signature";
    convDrop.appendChild(img);
    $("convClear").hidden = false;
  } else {
    convDrop.innerHTML = '<span class="drop-empty">Optional signature</span>';
    $("convClear").hidden = true;
  }
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 160);
}

async function refreshPreview() {
  if (previewAbort) previewAbort.abort();
  previewAbort = new AbortController();
  const list = names();
  const current = list[state.index] || "";
  const scaler = $("scaler");
  scaler.classList.add("is-loading");
  if (window.CERT_STATIC) {
    try {
      const html = await CertificateStudio.renderDocument(
        current ? [current] : [],
        readSettings(),
        state.hodSignature,
        state.convenorSignature,
        state.index
      );
      const frame = $("preview");
      frame.onload = () => {
        scaler.classList.remove("is-loading");
        fitPreview();
      };
      frame.srcdoc = html;
    } catch (err) {
      scaler.classList.remove("is-loading");
      toast(err.message || "Preview failed", true);
    }
    return;
  }
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: readSettings(),
        names: current ? [current] : [],
        index: state.index,
        hodSignature: state.hodSignature,
        convenorSignature: state.convenorSignature,
      }),
      signal: previewAbort.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Preview failed" }));
      throw new Error(err.error || "Preview failed");
    }
    const html = await res.text();
    const frame = $("preview");
    frame.onload = () => {
      scaler.classList.remove("is-loading");
      fitPreview();
    };
    frame.srcdoc = html;
  } catch (err) {
    if (err.name === "AbortError") return;
    scaler.classList.remove("is-loading");
    toast(err.message || "Preview failed", true);
  }
}

function fitPreview() {
  const stage = $("stage");
  const scaler = $("scaler");
  const frame = $("preview");
  const w = frame.offsetWidth || 1123;
  const h = frame.offsetHeight || 794;
  const availW = Math.max(120, stage.clientWidth - 48);
  const availH = Math.max(120, stage.clientHeight - 36);
  const scale = Math.max(0.18, Math.min(availW / w, availH / h, 1.35));
  frame.style.transform = `scale(${scale})`;
  scaler.style.width = `${Math.round(w * scale)}px`;
  scaler.style.height = `${Math.round(h * scale)}px`;
}

function toast(message, bad = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("bad", bad);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

function saveDraft() {
  try {
    const draft = {
      settings: readSettings(),
      names: namesBox.value,
      index: state.index,
      hodSignature: state.hodSignature,
      convenorSignature: state.convenorSignature,
    };
    localStorage.setItem(STORE, JSON.stringify(draft));
    $("saved").hidden = false;
  } catch {
    $("saved").hidden = true;
  }
}

function loadDraft() {
  writeSettings(DEFAULTS);
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return;
    const draft = JSON.parse(raw);
    writeSettings({ ...DEFAULTS, ...(draft.settings || {}) });
    namesBox.value = draft.names || "";
    state.index = draft.index || 0;
    state.hodSignature = draft.hodSignature ?? null;
    state.convenorSignature = draft.convenorSignature ?? null;
  } catch {
    writeSettings(DEFAULTS);
  }
}

async function readSignature(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Choose a PNG or JPG signature.");
  if (file.size > 8 * 1024 * 1024) throw new Error("That image is too large.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    if (min > 236 && max - min < 20) d[i + 3] = 0;
    else if (min > 205 && max - min < 28) d[i + 3] = Math.min(d[i + 3], Math.max(0, (240 - min) * 5));
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function showOverlay(title, text) {
  $("overlayTitle").textContent = title;
  $("overlayText").textContent = text;
  $("overlay").hidden = false;
}
function hideOverlay() { $("overlay").hidden = true; }

async function downloadStatic(kind) {
  const list = names();
  if (!list.length || list.length > MAX) return;
  const single = kind === "one";
  const payloadNames = single ? [list[state.index]] : list;
  const settings = readSettings();
  const index = single ? state.index : 0;
  showOverlay("Composing certificates", `Preparing ${payloadNames.length} certificate${payloadNames.length === 1 ? "" : "s"}.`);
  try {
    const html = await CertificateStudio.renderDocument(
      payloadNames,
      settings,
      state.hodSignature,
      state.convenorSignature,
      index
    );
    if (kind === "print" || !window.html2canvas || !window.jspdf) {
      const frame = $("printFrame");
      frame.onload = () => {
        hideOverlay();
        frame.contentWindow.focus();
        frame.contentWindow.print();
      };
      frame.srcdoc = html;
      toast("In the print dialog, choose Save as PDF.");
      return;
    }
    const capture = document.createElement("iframe");
    capture.className = "capture-frame";
    capture.setAttribute("title", "Certificate capture");
    document.body.appendChild(capture);
    await new Promise((resolve) => {
      capture.onload = resolve;
      capture.srcdoc = html;
    });
    if (capture.contentDocument.fonts) await capture.contentDocument.fonts.ready;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const sheets = [...capture.contentDocument.querySelectorAll(".sheet")];
    for (let i = 0; i < sheets.length; i += 1) {
      $("overlayText").textContent = `Drawing certificate ${i + 1} of ${sheets.length}`;
      const canvas = await window.html2canvas(sheets[i], {
        scale: 2,
        backgroundColor: "#f7fbf8",
        useCORS: true,
        width: sheets[i].scrollWidth,
        height: sheets[i].scrollHeight,
      });
      const image = canvas.toDataURL("image/jpeg", 0.92);
      if (i) pdf.addPage("a4", "landscape");
      pdf.addImage(image, "JPEG", 0, 0, 297, 210);
    }
    const slug = String(settings.programme || "Certificates").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Certificates";
    const filename = single
      ? `Pharmacia-DIU-${payloadNames[0].replace(/\s+/g, "-")}.pdf`
      : `Pharmacia-DIU-${slug}.pdf`;
    if (kind === "zip" && window.JSZip && payloadNames.length > 1) {
      const zip = new window.JSZip();
      const pages = pdf.internal.pages;
      for (let i = 0; i < payloadNames.length; i += 1) {
        const one = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        const canvas = await window.html2canvas(sheets[i], {
          scale: 2,
          backgroundColor: "#f7fbf8",
          useCORS: true,
        });
        one.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 297, 210);
        const safe = payloadNames[i].replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-").slice(0, 70) || "certificate";
        zip.file(`${String(i + 1).padStart(3, "0")}-${safe}.pdf`, one.output("blob"));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Pharmacia-DIU-${slug}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2500);
      toast(`Zipped ${payloadNames.length} PDFs`);
    } else {
      pdf.save(filename);
      toast(`Downloaded ${payloadNames.length === 1 ? "certificate" : payloadNames.length + " certificates"}`);
    }
    capture.remove();
  } catch (err) {
    toast(err.message || "Could not generate certificates", true);
  } finally {
    hideOverlay();
  }
}

async function download(url, fallbackName) {
  if (window.CERT_STATIC) {
    const kind = fallbackName === "one" ? "one" : fallbackName === "zip" ? "zip" : url === "/api/zip" ? "zip" : "all";
    return downloadStatic(kind);
  }
  const list = names();
  if (!list.length || list.length > MAX) return;
  const single = url === "/api/pdf" && fallbackName === "one";
  const payloadNames = single ? [list[state.index]] : list;
  const label = payloadNames.length === 1 ? "certificate" : `${payloadNames.length} certificates`;
  showOverlay(
    url === "/api/zip" ? "Packaging individual PDFs" : "Composing certificates",
    `Preparing ${label} with the programme text, watermark, and signature.`
  );
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: readSettings(),
        names: payloadNames,
        index: single ? state.index : 0,
        hodSignature: state.hodSignature,
        convenorSignature: state.convenorSignature,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Generation failed" }));
      throw new Error(err.error || "Generation failed");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : (url === "/api/zip" ? "certificates.zip" : "certificates.pdf");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2500);
    toast(url === "/api/zip" ? `Zipped ${payloadNames.length} PDFs` : `Downloaded ${label}`);
  } catch (err) {
    toast(err.message || "Could not generate certificates", true);
  } finally {
    hideOverlay();
  }
}

async function printAll() {
  const list = names();
  if (!list.length || list.length > MAX) return;
  if (window.CERT_STATIC) return downloadStatic("print");
  showOverlay("Opening print view", "Use “Save as PDF” in the print dialog if you want a vector file.");
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: readSettings(),
        names: list,
        index: 0,
        hodSignature: state.hodSignature,
        convenorSignature: state.convenorSignature,
      }),
    });
    if (!res.ok) throw new Error("Could not prepare the print view.");
    const html = await res.text();
    const frame = $("printFrame");
    frame.onload = () => {
      hideOverlay();
      frame.contentWindow.focus();
      frame.contentWindow.print();
    };
    frame.srcdoc = html;
  } catch (err) {
    hideOverlay();
    toast(err.message || "Print failed", true);
  }
}

function applyPreset(which) {
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("on", chip.dataset.preset === which);
  });
  if (which === "template") {
    const keep = namesBox.value;
    const hod = state.hodSignature;
    const conv = state.convenorSignature;
    writeSettings(DEFAULTS);
    namesBox.value = keep;
    state.hodSignature = hod;
    state.convenorSignature = conv;
    toast("Restored the template wording");
  } else {
    writeSettings({ ...readSettings(), ...STUDENT });
    toast("Wording set for student participants. Programme name was kept.");
  }
  refreshChrome();
  schedulePreview();
  saveDraft();
}

function step(delta) {
  const list = names();
  if (!list.length) return;
  state.index = Math.max(0, Math.min(list.length - 1, state.index + delta));
  refreshChrome();
  schedulePreview();
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", (event) => {
  if (event.target && event.target.id === "names") {
    state.index = 0;
    refreshChrome();
  } else {
    syncConditional();
  }
  schedulePreview();
  saveDraft();
});
form.addEventListener("change", () => {
  syncConditional();
  schedulePreview();
  saveDraft();
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => applyPreset(chip.dataset.preset));
});
$("sampleBtn").addEventListener("click", () => setNames(SAMPLE));
$("clearNames").addEventListener("click", () => {
  if (!state.clearArmed) {
    state.clearArmed = true;
    $("clearNames").textContent = "Confirm clear";
    setTimeout(() => {
      state.clearArmed = false;
      $("clearNames").textContent = "Clear";
    }, 2200);
    return;
  }
  state.clearArmed = false;
  $("clearNames").textContent = "Clear";
  setNames([]);
});
$("file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const text = await file.text();
  const list = text.split(/\r?\n/).map(extractName).filter(Boolean);
  if (!list.length) {
    toast("No names found in that file", true);
    return;
  }
  setNames(list.slice(0, MAX));
  if (list.length > MAX) toast(`Kept the first ${MAX} of ${list.length} names`);
});
$("prev").addEventListener("click", () => step(-1));
$("next").addEventListener("click", () => step(1));
$("btnAll").addEventListener("click", () => download(names().length > 1 ? "/api/zip" : "/api/pdf", "all"));
$("btnOne").addEventListener("click", () => download("/api/pdf", "one"));
$("btnZip").addEventListener("click", () => download("/api/zip", "zip"));
$("btnPrint").addEventListener("click", printAll);

$("hodFile").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  try {
    state.hodSignature = await readSignature(file);
    paintSignatures();
    schedulePreview();
    saveDraft();
  } catch (err) {
    toast(err.message || "Could not read that signature", true);
  }
});
$("hodClear").addEventListener("click", () => {
  state.hodSignature = "";
  paintSignatures();
  schedulePreview();
  saveDraft();
});
$("hodRestore").addEventListener("click", () => {
  state.hodSignature = null;
  paintSignatures();
  schedulePreview();
  saveDraft();
  toast("Restored the uploaded department head signature");
});
$("convFile").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  try {
    state.convenorSignature = await readSignature(file);
    paintSignatures();
    schedulePreview();
    saveDraft();
  } catch (err) {
    toast(err.message || "Could not read that signature", true);
  }
});
$("convClear").addEventListener("click", () => {
  state.convenorSignature = null;
  paintSignatures();
  schedulePreview();
  saveDraft();
});

document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  if (event.key === "ArrowRight") step(1);
  if (event.key === "ArrowLeft") step(-1);
});
window.addEventListener("resize", fitPreview);

namesBox.addEventListener("dragover", (event) => event.preventDefault());
namesBox.addEventListener("drop", async (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (!file) return;
  const text = await file.text();
  const list = text.split(/\r?\n/).map(extractName).filter(Boolean);
  if (list.length) setNames(list.slice(0, MAX));
});

loadDraft();
paintSignatures();
syncConditional();
refreshChrome();
refreshPreview();
requestAnimationFrame(fitPreview);
