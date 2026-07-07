# 🚀 Quick Start: Integrasi Freecourse API

> Panduan singkat untuk memulai integrasi dengan Freecourse backend

---

## 📁 File Yang Tersedia

1. **`INTEGRATION_GUIDE.md`** - Dokumentasi lengkap (API, database schema, GAS setup)
2. **`standalone-styles.css`** - CSS siap pakai untuk UI forms
3. **`gas-all-in-one.js`** - Google Apps Script untuk certificate generation

---

## ⚡ Setup dalam 5 Menit

### 1. Copy CSS Styles

```bash
# Copy file CSS ke project Anda
cp standalone-styles.css your-project/styles/
```

Atau copy manual semua class `.pf-*` dari file tersebut.

### 2. Setup API Integration

```typescript
const API_BASE = 'https://freecourse.iodacademy.id';

// Helper function
async function callFreecourseAPI(action: string, email: string, payload: any) {
  const response = await fetch(`${API_BASE}/api/public/standalone/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, email, payload })
  });
  return response.json();
}
```

### 3. Implement User Journey

```typescript
// Step 1: Enroll user
await callFreecourseAPI('identity', email, {
  nama_lengkap: "John Doe",
  jenis_kelamin: "Laki-laki",
  tanggal_lahir: "2000-01-15",
  alamat_email: email,
  nomor_whatsapp: "81234567890",
  asal_daerah: "Jakarta Selatan",
  disabilitas: "Tidak",
  jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati: ["Hospitality"],
  apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini: "Ya",
  pretest_pernah_belajar_financial_literacy: "Belum Pernah",
  pretest_score: 10,
  channelSource: "your_lms_name",
  detailChannel: "Premium Course"
});

// Step 2: Submit quiz
await callFreecourseAPI('quiz', email, {
  score: 100,
  passed: true,
  kkm: 60,
  answers: { "q-123": "A", "q-456": "B" }
});

// Step 3: Submit survey
await callFreecourseAPI('survey', email, {
  surveyType: 'survei1',
  surveyResult: { "sq-123": 5, "sq-456": "Great course!" }
});

// Step 4: Claim certificate
const result = await callFreecourseAPI('certificate', email, {
  confirmedName: "John Doe"
});

// Open certificate
if (result.success && result.driveUrl) {
  window.open(result.driveUrl, '_blank');
}
```

---

## 🎨 UI Components

### Basic Form Structure

```html
<div class="pf-page">
  <div class="pf-card">
    <div class="pf-card__head">
      <h2>Form Title</h2>
      <p>Form description</p>
    </div>
    <div class="pf-card__body">
      <!-- Form fields here -->
    </div>
  </div>
</div>
```

### Input Field

```html
<div class="pf-field-group">
  <label class="pf-label">
    Nama Lengkap <span style="color: #ef4444">*</span>
  </label>
  <input type="text" class="pf-input" placeholder="Masukkan nama lengkap" />
</div>
```

### Segmented Control (Radio)

```html
<div class="pf-field-group">
  <label class="pf-label">Jenis Kelamin</label>
  <div class="pf-segmented">
    <button type="button" class="pf-segmented__opt pf-segmented__opt--active">
      Laki-laki
    </button>
    <button type="button" class="pf-segmented__opt">
      Perempuan
    </button>
  </div>
</div>
```

### Pills (Multi-select)

```html
<div class="pf-field-group">
  <label class="pf-label">Minat Pelatihan</label>
  <div class="pf-pills">
    <button type="button" class="pf-pill pf-pill--active">
      <svg class="pf-pill__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="3,8.5 7,12 13,4" />
      </svg>
      Hospitality
    </button>
    <button type="button" class="pf-pill">Retail</button>
    <button type="button" class="pf-pill">Desain Grafis</button>
  </div>
</div>
```

### WhatsApp Input

```html
<div class="pf-field-group">
  <label class="pf-label">Nomor WhatsApp</label>
  <div class="pf-wa-affix">
    <div class="pf-wa-prefix">+62</div>
    <input type="tel" class="pf-input" placeholder="81234567890" />
  </div>
</div>
```

### Submit Button

```html
<div class="pf-btn-row">
  <button type="submit" class="pf-submit-btn">
    Selanjutnya
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  </button>
</div>
```

---

## 🗄️ Database Schema (Simplified)

### Collection: `users`

```javascript
{
  uid: email,
  email: string,
  displayName: string,
  profileData: { /* form data */ }
}
```

### Collection: `enrollments`

```javascript
{
  id: email,
  userId: email,
  courseId: "course-main",
  stepProgress: {
    [stepId]: {
      assessmentResult: { answers, score, passed },
      surveyResult: { /* survey answers */ }
    }
  },
  certificateId: "CERT-2026-XXX",
  certificateDriveUrl: "https://drive.google.com/..."
}
```

---

## 📜 Certificate Generation

### Setup Google Apps Script

1. Buka [script.google.com](https://script.google.com)
2. Buat project baru
3. Copy isi `gas-all-in-one.js` ke Code.gs
4. **Deploy as Web App:**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy deployment URL

### Update Firestore Settings

```javascript
// Collection: settings, Document: app
{
  gasWebAppUrl: "https://script.google.com/macros/s/YOUR_ID/exec",
  mainCertSlideTemplateId: "YOUR_GOOGLE_SLIDES_TEMPLATE_ID",
  mainCertTitle: "Workshop Literasi Finansial"
}
```

### Template Placeholders

Buat Google Slides template dengan:
- `{{NAMA_PESERTA}}` - Nama peserta
- `{{TANGGAL}}` - Tanggal claim
- `{{CERT_ID}}` - ID sertifikat

---

## ✅ Checklist Integration

- [ ] Copy `standalone-styles.css` ke project
- [ ] Add CSS variables to your theme
- [ ] Implement API helper functions
- [ ] Test enrollment flow
- [ ] Test quiz submission
- [ ] Test survey submission
- [ ] Setup Google Apps Script
- [ ] Update Firestore settings
- [ ] Create certificate template
- [ ] Test certificate generation
- [ ] Deploy to production

---

## 🔍 Troubleshooting

### Certificate tidak generate?

1. Pastikan `gasWebAppUrl` sudah di-set di Firestore `settings/app`
2. Check GAS deployment masih aktif
3. Verify template ID valid
4. Check GAS logs untuk error

### API returns 400?

1. Pastikan email valid & tidak kosong
2. Check required fields di payload
3. Verify JSON format correct

### Nama sertifikat ditolak?

Backend validasi nama:
- Tidak boleh kosong
- Tidak boleh NIK/angka saja
- Tidak boleh simbol/font fancy

---

## 📞 Support

**Dokumentasi Lengkap:** `INTEGRATION_GUIDE.md`

**Source Code:**
- API Route: `src/app/api/public/standalone/submit/route.ts`
- Components: `src/components/standalone/`
- GAS Script: `gas-all-in-one.js`

---

**Last Updated:** 7 Juli 2026