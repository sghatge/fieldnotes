// Android-only integrations, loaded after the shared web app (app.js).
// The web app never sends photos or audio anywhere; on Android, OCR and dictation
// run through on-device services exposed by MainActivity as window.AndroidBridge.
(() => {
  const bridge = () => window.AndroidBridge;
  if (!bridge()) return;

  // Errors must stay readable long enough to act on; the shared toast lasts ~2.4 s.
  const longToast = (message) => {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'alert');
    el.textContent = message;
    document.body.append(el);
    setTimeout(() => el.remove(), 7000);
  };

  // ---- Copy that only applies to the browser preview ----------------------
  const NOTICE_REWRITES = [
    [/Receipt reading \(OCR\) is not built yet\./,
      'Receipts are read by bundled on-device OCR. Check every extracted value before saving.'],
    [/Dictation uses your browser’s speech service, not an on-device model, and needs a connection\./,
      'Dictation uses Android’s on-device speech service where the phone supports it; language support varies.'],
  ];
  // Order matters: specific sentences first, then the generic "this browser" fallbacks.
  const TEXT_REWRITES = [
    [/The photo is not read or uploaded in this preview · type the values below/,
      'Bundled on-device OCR · the photo never leaves this phone · review every value'],
    [/Mic uses your browser’s speech service \(Google in Chrome, Microsoft in Edge\)\. Type instead to keep everything on this device\./,
      'Mic uses Android’s on-device speech service; audio stays on this phone.'],
    [/your browser’s speech service/g, 'Android’s on-device speech service'],
    [/SAVED IN THIS BROWSER/g, 'SAVED ON THIS PHONE'],
    [/\bin this browser\b/gi, 'on this phone'],
    [/\bthis browser\b/gi, 'this phone'],
  ];
  const rewriteText = (text) =>
    TEXT_REWRITES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);

  function rewriteCopy(root) {
    root.querySelectorAll('.notice').forEach((notice) => {
      NOTICE_REWRITES.forEach(([pattern, text]) => {
        if (pattern.test(notice.innerHTML)) notice.innerHTML = notice.innerHTML.replace(pattern, text);
      });
    });
    root.querySelectorAll('[title],[placeholder]').forEach((el) => {
      ['title', 'placeholder'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value && rewriteText(value) !== value) el.setAttribute(attr, rewriteText(value));
      });
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = rewriteText(node.nodeValue);
      if (text !== node.nodeValue) node.nodeValue = text;
    }
  }

  // ---- Files: WebView ignores <a download>, so hand them to Android ------
  window.download = (filename, content, type = 'text/csv') => {
    bridge().saveFile(filename, type, String(content));
  };
  window.onNativeFileSaved = (name) => toast(`Saved ${name}`);
  window.onNativeFileError = (message) => longToast(message);

  // ---- Dictation ----------------------------------------------------------
  window.speak = (target) => {
    toast('Listening on this phone… speak now');
    bridge().startOnDeviceSpeech(target);
  };
  window.onNativeSpeechResult = (target, text) => {
    const input = document.getElementById(target);
    if (!input) return;
    input.value = `${input.value} ${text}`.trim();
    if (target === 'ta-text') micUsedForTask = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    toast('Dictation added. Check the text.');
  };
  window.onNativeSpeechError = (message) => longToast(message);

  // ---- OCR ----------------------------------------------------------------
  window.onNativeOcrError = (message) => longToast(message);
  window.nativeOcrTarget = 'expense';

  // Indian receipts print dates day-first (05/11/2026 = 5 Nov 2026).
  function receiptDate(text) {
    for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/g)) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) continue;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  window.onNativeOcrResult = (text) => {
    if (window.nativeOcrTarget === 'paper') {
      const field = document.getElementById('pa-text');
      if (field) field.value = `${field.value}\n\n${text}`.trim();
      const label = document.getElementById('paper-file-label');
      if (label) label.textContent = 'Text read — review the page and add the next one';
      toast('On-device OCR text added. Review it and process each page separately.');
      return;
    }
    const el = (id) => document.getElementById(id);
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const vendor = lines.find((line) => /[a-z]{3,}/i.test(line) &&
      !/(invoice|receipt|tax|gstin|gst|bill|date|total|amount)/i.test(line));
    if (vendor && !el('ex-vendor').value) el('ex-vendor').value = vendor;

    const gstin = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z0-9]\b/i);
    if (gstin && !el('ex-gstin').value) el('ex-gstin').value = gstin[0].toUpperCase();

    const amounts = [...text.matchAll(/(?:grand\s*total|total\s*amount|amount\s*payable|net\s*amount|total|₹|rs\.?)\D{0,12}(\d[\d,]*(?:\.\d{1,2})?)/gi)]
      .map((match) => Number(match[1].replace(/,/g, '')))
      .filter((amount) => Number.isFinite(amount) && amount > 0);
    if (amounts.length && !el('ex-amount').value) el('ex-amount').value = Math.max(...amounts);

    const lower = text.toLowerCase();
    const category = lower.match(/\b(petrol|diesel|fuel|uber|ola|railway|airlines?)\b/) ? 'Travel' :
      lower.match(/\b(cafe|restaurant|foods?|bakery|sweets?)\b/) ? 'Food & refreshments' :
      lower.match(/\b(electricity|internet|broadband|mobile recharge|telephone)\b/) ? 'Utilities' :
      lower.match(/\b(pharmacy|medical|clinic|hospital|chemist)\b/) ? 'Medical' : null;
    if (category && [...el('ex-category').options].some((o) => o.value === category)) el('ex-category').value = category;

    // The date field is pre-filled with today, so a date found on the receipt replaces it.
    const date = receiptDate(text);
    if (date) el('ex-date').value = date;

    el('file-label').textContent = 'OCR complete — review every field before saving';
    toast('On-device OCR complete. Verify the extracted values.');
  };

  document.addEventListener('change', (event) => {
    if (event.target.id === 'audit-photo' && event.target.files?.[0]) {
      const photos = get(`audit_photos_${selectedTemplate}`, []);
      if (photos.length >= 5) return toast('Up to five photos are saved per checklist.');
      const image = new Image();
      const reader = new FileReader();
      reader.onload = () => { image.src = reader.result; };
      image.onload = () => {
        const scale = Math.min(1, 1100 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        photos.push({ date: new Date().toISOString(), data: canvas.toDataURL('image/jpeg', 0.72) });
        put(`audit_photos_${selectedTemplate}`, photos);
        render();
        toast('Photo saved with this local audit');
      };
      reader.onerror = () => longToast('Could not read that photo.');
      reader.readAsDataURL(event.target.files[0]);
      return;
    }
    if (event.target.id === 'paper-file' && event.target.files?.[0]) {
      window.nativeOcrTarget = 'paper';
    } else if (event.target.id === 'receipt-file' && event.target.files?.[0]) {
      window.nativeOcrTarget = 'expense';
    } else return;
    const label = document.getElementById(window.nativeOcrTarget === 'paper' ? 'paper-file-label' : 'file-label');
    if (label) label.textContent = 'Reading on this phone…';
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '').split(',')[1];
      if (data) bridge().recognizeReceipt(data);
      else window.onNativeOcrError('Could not open that image.');
    };
    reader.onerror = () => window.onNativeOcrError('Could not read that image.');
    reader.readAsDataURL(event.target.files[0]);
  });

  function enhanceCurrentPage() {
    if (page === 'paper' && !document.getElementById('paper-file')) {
      const field = document.getElementById('pa-text')?.closest('.field');
      if (field) {
        const picker = document.createElement('label');
        picker.className = 'receipt-drop';
        picker.innerHTML = '<div class="drop-icon">▤</div><div><b id="paper-file-label">Photograph a contract page</b><span>Bundled on-device OCR · one page at a time · verify the text</span></div><input id="paper-file" type="file" accept="image/*" capture="environment">';
        field.after(picker);
      }
    }
    if (page === 'audit' && !document.getElementById('audit-photo')) {
      const checklist = document.querySelector('.checklist');
      if (checklist) {
        const box = document.createElement('div');
        box.className = 'footer-note';
        const photos = get(`audit_photos_${selectedTemplate}`, []);
        box.innerHTML = `<label class="receipt-drop"><div class="drop-icon">＋</div><div><b>Add photo evidence (${photos.length}/5)</b><span>Resized and saved on this phone with the checklist; not included in text sharing</span></div><input id="audit-photo" type="file" accept="image/*" capture="environment"></label>${photos.map((photo, index) => `<img alt="Audit evidence ${index + 1}" src="${photo.data}" style="width:100%;max-height:220px;object-fit:contain;border:1px solid #e6e9e4;border-radius:9px;margin:5px 0">`).join('')}`;
        checklist.after(box);
      }
    }
    // Whole body, so pop-up toasts (appended outside #app) are covered too.
    rewriteCopy(document.body);
  }

  // The shared app re-renders #app on every navigation; re-apply Android tweaks each time.
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; enhanceCurrentPage(); });
  }).observe(document.body, { childList: true, subtree: true });
  enhanceCurrentPage();
})();
