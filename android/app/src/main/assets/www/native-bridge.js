// Android-only integrations. The browser prototype uses manual entry and never
// silently sends photos or audio to a remote recognition service.
(() => {
  const bridge = () => window.AndroidBridge;
  if (bridge()) {
    const receiptHint = document.querySelector('.receipt-drop span');
    if (receiptHint) receiptHint.textContent = 'Bundled on-device Latin OCR · review every extracted value';
    const privacy = document.querySelector('.privacy');
    if (privacy) privacy.innerHTML = '<b>On-device processing</b><br>Records and OCR stay on this phone. Android dictation uses its on-device service where supported; this is not Whisper.';
    document.querySelectorAll('.notice').forEach((notice) => {
      if (notice.textContent.includes('speech recognition is browser-provided')) {
        notice.innerHTML = '<strong>Accuracy note.</strong> Checks are tapped manually. On supported Android phones, dictation uses the Android on-device speech service; it is not Whisper, language support varies, and no team sync is configured.';
      }
    });
  }
  const originalSpeak = window.speak;
  window.speak = (target) => {
    if (bridge()?.startOnDeviceSpeech) {
      bridge().startOnDeviceSpeech(target);
      toast('Starting on-device dictation');
    } else if (originalSpeak) originalSpeak(target);
  };

  window.onNativeSpeechResult = (target, text) => {
    const input = document.getElementById(target);
    if (!input) return;
    input.value = `${input.value} ${text}`.trim();
    if (target === 'ta-text') {
      const due = document.getElementById('ta-date');
      if (due && !due.value) due.value = dateGuess(input.value);
    }
    toast('On-device dictation added');
  };
  window.onNativeSpeechError = (message) => toast(message);
  window.onNativeOcrError = (message) => toast(message);

  window.nativeOcrTarget = 'expense';
  window.onNativeOcrResult = (text) => {
    if (window.nativeOcrTarget === 'paper') {
      const field = document.getElementById('pa-text');
      if (field) field.value = `${field.value}\n\n${text}`.trim();
      const label = document.getElementById('paper-file-label');
      if (label) label.textContent = 'Text read — review the page and add the next one';
      toast('On-device OCR text added. Review it and process each page separately.');
      return;
    }
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const vendor = lines.find((line) => /[a-z]{3,}/i.test(line) &&
      !/(invoice|receipt|tax|gstin|gst|bill|date|total|amount)/i.test(line));
    if (vendor && !document.getElementById('ex-vendor').value)
      document.getElementById('ex-vendor').value = vendor;

    const gstin = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z0-9]\b/i);
    if (gstin && !document.getElementById('ex-gstin').value)
      document.getElementById('ex-gstin').value = gstin[0].toUpperCase();

    const amounts = [...text.matchAll(/(?:grand\s*total|total\s*amount|amount\s*payable|net\s*amount|total|₹|rs\.?)\D{0,12}(\d[\d,]*(?:\.\d{1,2})?)/gi)]
      .map((match) => Number(match[1].replace(/,/g, '')))
      .filter((amount) => Number.isFinite(amount) && amount > 0);
    if (amounts.length && !document.getElementById('ex-amount').value)
      document.getElementById('ex-amount').value = Math.max(...amounts);
    const lower = text.toLowerCase();
    const category = lower.match(/\b(petrol|diesel|fuel|uber|ola|railway|airlines?)\b/) ? 'Travel' :
      lower.match(/\b(cafe|restaurant|foods?|bakery|sweets?)\b/) ? 'Food & refreshments' :
      lower.match(/\b(electricity|internet|broadband|mobile recharge|telephone)\b/) ? 'Utilities' :
      lower.match(/\b(pharmacy|medical|clinic|hospital|chemist)\b/) ? 'Medical' : null;
    if (category) document.getElementById('ex-category').value = category;

    const date = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
    if (date && !document.getElementById('ex-date').value) {
      const year = date[3].length === 2 ? `20${date[3]}` : date[3];
      document.getElementById('ex-date').value = `${year}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`;
    }
    document.getElementById('file-label').textContent = 'OCR complete — review every field before saving';
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
      reader.onerror = () => toast('Could not read that photo.');
      reader.readAsDataURL(event.target.files[0]);
      return;
    }
    if (event.target.id === 'paper-file' && event.target.files?.[0]) {
      window.nativeOcrTarget = 'paper';
      document.getElementById('paper-file-label').textContent = 'Reading page on this device…';
    } else if (event.target.id === 'receipt-file' && event.target.files?.[0]) {
      window.nativeOcrTarget = 'expense';
    } else return;
    const file = event.target.files[0];
    const label = document.getElementById(window.nativeOcrTarget === 'paper' ? 'paper-file-label' : 'file-label');
    if (label) label.textContent = 'Reading on this device…';
    if (!bridge()?.recognizeReceipt) {
      if (label) label.textContent = `${file.name} · Android OCR build required`;
      toast(window.nativeOcrTarget === 'paper' ? 'Page OCR runs in the Android app. Paste text here in the browser.' : 'Receipt OCR runs in the Android app. Enter details manually here.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '').split(',')[1];
      if (data) bridge().recognizeReceipt(data);
      else window.onNativeOcrError('Could not open that image.');
    };
    reader.onerror = () => window.onNativeOcrError('Could not read that image.');
    reader.readAsDataURL(file);
  });

  function enhanceCurrentPage() {
    if (bridge() && page === 'paper' && !document.getElementById('paper-file')) {
      const field = document.getElementById('pa-text')?.closest('.field');
      if (field) {
        const picker = document.createElement('label');
        picker.className = 'receipt-drop';
        picker.innerHTML = '<div class="drop-icon">▤</div><div><b id="paper-file-label">Photograph a contract page</b><span>Bundled on-device Latin OCR · one page at a time · verify the text</span><input id="paper-file" type="file" accept="image/*" capture="environment"></div>';
        field.after(picker);
      }
    }
    if (page === 'audit' && !document.getElementById('audit-photo')) {
      const checklist = document.querySelector('.checklist');
      if (checklist) {
        const box = document.createElement('div');
        box.className = 'footer-note';
        const photos = get(`audit_photos_${selectedTemplate}`, []);
        box.innerHTML = `<label class="receipt-drop"><div class="drop-icon">＋</div><div><b>Add photo evidence (${photos.length}/5)</b><span>Resized and saved locally with this checklist; not included in text sharing</span><input id="audit-photo" type="file" accept="image/*" capture="environment"></div></label>${photos.map((photo, index) => `<img alt="Audit evidence ${index + 1}" src="${photo.data}" style="width:100%;max-height:220px;object-fit:contain;border:1px solid #e6e9e4;border-radius:9px;margin:5px 0">`).join('')}`;
        checklist.after(box);
      }
    }
  }
  new MutationObserver(enhanceCurrentPage).observe(document.getElementById('app'), { childList: true, subtree: true });
  enhanceCurrentPage();
})();
