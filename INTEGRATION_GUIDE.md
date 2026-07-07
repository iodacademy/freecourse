# 📘 Integration Guide: Freecourse Standalone API

> Dokumentasi untuk mengintegrasikan aplikasi eksternal dengan backend Freecourse IODA Academy

**Terakhir diupdate:** 7 Juli 2026

---

## 📋 Daftar Isi

1. [Overview](#overview)
2. [CSS Styling](#css-styling)
3. [Database Schema](#database-schema)
4. [API Integration](#api-integration)
5. [Certificate Generation (GAS)](#certificate-generation)
6. [Flow Diagram](#flow-diagram)

---

## 🎯 Overview

Project Freecourse menyediakan backend API untuk mengelola:
- ✅ User enrollment & profile data
- ✅ Quiz/assessment results
- ✅ Survey responses
- ✅ Certificate generation via Google Apps Script

**Base URL:** `https://freecourse.iodacademy.id`

### Arsitektur Integrasi

```
[Your LMS/App] → [Freecourse API] → [Firestore Database]
                      ↓
                [Google Apps Script] → [Drive Certificate]
```

**Use Case:**
- Project eksternal menampilkan konten course (video, quiz, survey)
- Project eksternal menyimpan konten di database sendiri
- Saat user submit/enroll, data dikirim ke Freecourse API
- Certificate generation menggunakan GAS dari project ini

---

## 🎨 CSS Styling

### Copy CSS Classes

Semua styling untuk form standalone menggunakan class prefix `.pf-*` (Premium Form).

**File sumber:** `src/app/globals.css`

### Core Components

#### 1. Page & Card Layout

```css
.pf-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #fff5f5 0%, #fff 100%);
  padding: 40px 20px 80px;
}

.pf-card {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  overflow: hidden;
}

.pf-card__head {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  padding: 28px 32px;
  color: white;
}

.pf-card__body {
  padding: 28px 32px 32px;
}
```

#### 2. Form Fields

```css
.pf-field-group {
  margin-bottom: 20px;
}

.pf-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-700);
  margin-bottom: 6px;
}

.pf-input {
  width: 100%;
  padding: 11px 13px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
}

.pf-input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.pf-input--error {
  border-color: #ef4444 !important;
}
```

#### 3. Segmented Control (Radio Buttons)

```css
.pf-segmented {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 8px;
}

.pf-segmented__opt {
  text-align: center;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.pf-segmented__opt--active {
  background: white;
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}
```

#### 4. Pill Chips (Multi-select)

```css
.pf-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.pf-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid #e5e7eb;
  border-radius: 50px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.pf-pill--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  font-weight: 600;
}

.pf-pill__check {
  width: 12px;
  height: 12px;
  display: none;
}

.pf-pill--active .pf-pill__check {
  display: inline-block;
}
```

#### 5. WhatsApp Input with Prefix

```css
.pf-wa-affix {
  display: flex;
  align-items: stretch;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.pf-wa-prefix {
  padding: 0 10px;
  background: var(--color-gray-50);
  display: flex;
  align-items: center;
  font-weight: 600;
  color: var(--color-gray-700);
}

.pf-wa-affix .pf-input {
  border: none;
  flex: 1;
}
```

#### 6. Buttons

```css
.pf-submit-btn {
  flex: 2;
  padding: 14px 28px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.pf-submit-btn:hover {
  background: var(--color-primary-dark);
}

.pf-submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
```

#### 7. Error Messages

```css
.pf-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: #dc2626;
  font-size: 11px;
  margin-top: 6px;
  font-weight: 500;
}

.pf-error::before {
  content: "⚠";
  font-size: 13px;
}
```

#### 8. Progress Bar

```css
.pf-progress {
  width: 100%;
  max-width: 500px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.pf-progress__bar {
  flex: 1;
  height: 8px;
  background: #f3f4f6;
  border-radius: 50px;
  overflow: hidden;
}

.pf-progress__bar span {
  display: block;
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

.pf-progress__label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-gray-700);
}
```

### CSS Variables Required

```css
:root {
  --color-primary: #CC0000;
  --color-primary-dark: #990000;
  --color-gray-50: #f9fafb;
  --color-gray-200: #e5e7eb;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-700: #374151;
  --color-gray-900: #111827;
  --color-bg-soft: #fafafa;
}
```

---

## 🗄️ Database Schema

### Firestore Collections

#### Collection: `users`

Menyimpan data profil user.

```javascript
{
  // Document ID = email.toLowerCase()
  uid: "user@example.com",
  email: "user@example.com",
  displayName: "John Doe",
  channelSource: "beasiswa",  // atau nama channel lain
  detailChannel: "All Beasiswa - Facebook Instant Forms",
  role: "student",
  profileCompleted: true,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  profileData: {
    // Data dari form identitas
    nama_lengkap: "John Doe",
    jenis_kelamin: "Laki-laki" | "Perempuan",
    tanggal_lahir: "2000-01-15",  // YYYY-MM-DD
    alamat_email: "user@example.com",
    nomor_whatsapp: "81234567890",  // tanpa +62
    asal_daerah: "Jakarta Selatan",
    disabilitas: "Ya" | "Tidak",
    kategori_disabilitas_yang_anda_miliki: "...",  // if disabilitas = Ya
    jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati: ["Hospitality", "Retail"],
    
    // Pre-test
    pretest_pernah_belajar_financial_literacy: "Pernah" | "Belum Pernah",
    pretest_score: 30 | 10,  // Pernah=30, Belum=10
    
    // Custom fields dari project lain
    apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini: "Ya" | "Tidak"
  }
}
```

#### Collection: `enrollments`

Menyimpan progress course per user.

```javascript
{
  // Document ID = email.toLowerCase()
  id: "user@example.com",
  userId: "user@example.com",
  email: "user@example.com",
  displayName: "John Doe",
  courseId: "course-main",  // atau course ID lain
  channelSource: "beasiswa",
  detailChannel: "All Beasiswa - Facebook Instant Forms",
  status: "active" | "certified",
  currentStep: 1,  // 1=material, 2=quiz, 3=survey, etc
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  stepProgress: {
    // Key = stepId (dynamic, dari settings)
    "new-1779462139521": {
      // Assessment/Quiz result
      assessmentResult: {
        answers: {
          "q-1779462169465": "A",
          "q-1779462319546": "A",
          "q-1779462400362": "B"
        },
        score: 100,
        passed: true,
        kkm: 60,
        attempts: 1,
        firstPassScore: 100,
        lastAttemptAt: Timestamp
      },
      
      // Survey result
      surveyResult: {
        "sq-1779462786725": 5,  // star rating
        "sq-1779462798676": "Materinya bagus sekali"  // text
      },
      
      completed: true,
      completedAt: Timestamp,
      submittedAt: Timestamp
    }
  },
  
  // Certificate info (after claimed)
  certificateClaimed: true,
  certificateClaimedAt: Timestamp,
  certificateCourseName: "Workshop Literasi Finansial",
  certificateIssuer: "IODA Academy",
  certificateId: "CERT-2026-ABC123",
  certificateName: "John Doe",
  certificateDriveUrl: "https://drive.google.com/file/d/.../view",
  certificateDriveFileId: "1ABC..."
}
```

#### Collection: `settings`

Konfigurasi aplikasi.

```javascript
{
  // Document ID = "app"
  gasWebAppUrl: "https://script.google.com/macros/s/.../exec",
  mainCertSlideTemplateId: "1E7qirTYtP79RcmM7uwdH9gevaNtutCETZfAsLhx6hfc",
  mainCertTitle: "Workshop Literasi Finansial",
  quizStepId: "new-1779462139521",
  // ... other settings
}
```

---

## 🔌 API Integration

### Base URL

```
Production: https://freecourse.iodacademy.id
Local Dev:  http://localhost:3000
```

### Endpoint: Submit Data

**URL:** `POST /api/public/standalone/submit`

**Headers:**
```
Content-Type: application/json
```

### Action 1: Save Identity (Enrollment)

**Request:**
```json
{
  "action": "identity",
  "email": "user@example.com",
  "payload": {
    "nama_lengkap": "John Doe",
    "jenis_kelamin": "Laki-laki",
    "tanggal_lahir": "2000-01-15",
    "alamat_email": "user@example.com",
    "nomor_whatsapp": "81234567890",
    "asal_daerah": "Jakarta Selatan",
    "disabilitas": "Tidak",
    "jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati": ["Hospitality", "Retail"],
    "apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini": "Ya",
    "pretest_pernah_belajar_financial_literacy": "Belum Pernah",
    "pretest_score": 10,
    "channelSource": "premium_lms",
    "detailChannel": "Premium Course - Financial Literacy"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Identity saved"
}
```

### Action 2: Save Quiz Result

**Request:**
```json
{
  "action": "quiz",
  "email": "user@example.com",
  "payload": {
    "score": 100,
    "passed": true,
    "kkm": 60,
    "answers": {
      "q-1779462169465": "A",
      "q-1779462319546": "A",
      "q-1779462400362": "B"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quiz updated"
}
```

### Action 3: Save Survey

**Request:**
```json
{
  "action": "survey",
  "email": "user@example.com",
  "payload": {
    "surveyType": "survei1",
    "surveyResult": {
      "sq-1779462786725": 5,
      "sq-1779462798676": "Materinya sangat membantu saya"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Survey updated"
}
```

**Note:** `surveyType` bisa "survei1" atau "survei2" tergantung survey mana.

### Action 4: Claim Certificate

**Request:**
```json
{
  "action": "certificate",
  "email": "user@example.com",
  "payload": {
    "confirmedName": "John Doe"  // Optional: jika user confirm/edit nama
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Certificate claimed",
  "certId": "CERT-2026-ABC123",
  "driveUrl": "https://drive.google.com/file/d/1ABC.../view"
}
```

**Error Response (jika nama tidak valid):**
```json
{
  "error": "Nama tidak valid. Isi nama lengkap sesuai KTP."
}
```

---

## 📜 Certificate Generation (GAS)

### Google Apps Script Setup

File: `gas-all-in-one.js` (di root project ini)

#### 1. Deploy GAS Web App

1. Buka [script.google.com](https://script.google.com)
2. Buat project baru
3. Copy isi `gas-all-in-one.js` ke Code.gs
4. Deploy → New Deployment → Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy Deployment URL

#### 2. Konfigurasi di Firestore

Update collection `settings` document `app`:

```javascript
{
  gasWebAppUrl: "https://script.google.com/macros/s/AKfy.../exec",
  mainCertSlideTemplateId: "1E7qirTYtP79RcmM7uwdH9gevaNtutCETZfAsLhx6hfc",
  mainCertTitle: "Workshop Literasi Finansial"
}
```

#### 3. Template Google Slides

Buat template di Google Slides dengan placeholder:
- `{{NAMA_PESERTA}}` atau `{{NAMA}}` atau `{{nama}}`
- `{{TANGGAL}}`
- `{{CERT_ID}}`

Share template sebagai "Anyone with link can view".

### GAS API Call (Internal)

API ini dipanggil otomatis oleh `/api/public/standalone/submit` saat action="certificate".

**Request ke GAS:**
```json
POST [gasWebAppUrl]
{
  "action": "generate_main_cert",
  "templateId": "1E7qirTYtP79RcmM7uwdH9gevaNtutCETZfAsLhx6hfc",
  "certId": "CERT-2026-ABC123",
  "userName": "John Doe",
  "courseName": "Workshop Literasi Finansial",
  "claimDate": "7 July 2026",
  "email": "user@example.com"
}
```

**Response dari GAS:**
```json
{
  "success": true,
  "pdfUrl": "https://drive.google.com/file/d/1ABC.../view",
  "downloadUrl": "https://drive.google.com/file/d/1ABC.../view",
  "fileId": "1ABC...",
  "certId": "CERT-2026-ABC123"
}
```

### GAS Function: generateMainCert

```javascript
function generateMainCert(data) {
  var certId      = data.certId || "CERT-XXXX";
  var userName    = data.userName || "Peserta";
  var courseName  = data.courseName || "Kursus";
  var claimDate   = data.claimDate || formatTanggal(new Date());
  var templateId  = data.templateId || MAIN_TEMPLATE_ID;

  // 1. Copy template
  var templateFile = DriveApp.getFileById(templateId);
  var fileName = userName + " - Sertifikat Financial Literasi";
  var folder = DriveApp.getFolderById(CERT_FOLDER_ID);
  var copy = templateFile.makeCopy(fileName, folder);
  var slideId = copy.getId();

  // 2. Replace placeholder
  var presentation = SlidesApp.openById(slideId);
  var slides = presentation.getSlides();
  
  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    slide.replaceAllText("{{NAMA_PESERTA}}", userName);
    slide.replaceAllText("{{NAMA}}", userName);
    slide.replaceAllText("{{TANGGAL}}", claimDate);
    slide.replaceAllText("{{CERT_ID}}", certId);
  }
  
  presentation.saveAndClose();

  // 3. Export to PDF
  var pdfBlob = DriveApp.getFileById(slideId)
    .getAs("application/pdf")
    .setName(fileName + ".pdf");
  
  var pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 4. Delete Slides copy (keep only PDF)
  copy.setTrashed(true);

  var downloadUrl = "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";
  
  return {
    success: true,
    pdfUrl: downloadUrl,
    downloadUrl: downloadUrl,
    fileId: pdfFile.getId(),
    certId: certId
  };
}
```

---

## 🔄 Flow Diagram

### Complete User Journey

```
1. USER ENROLLMENT
   ↓
   [Your App] → POST /api/public/standalone/submit (action: identity)
   ↓
   ✅ User created in `users` collection
   ✅ Enrollment created in `enrollments` collection

2. WATCH VIDEO
   ↓
   [Your App renders video content from your database]

3. TAKE QUIZ
   ↓
   [Your App] → POST /api/public/standalone/submit (action: quiz)
   ↓
   ✅ Quiz result saved in `enrollments.stepProgress`

4. SUBMIT SURVEY
   ↓
   [Your App] → POST /api/public/standalone/submit (action: survey)
   ↓
   ✅ Survey result saved in `enrollments.stepProgress`

5. CLAIM CERTIFICATE
   ↓
   [Your App] → POST /api/public/standalone/submit (action: certificate)
   ↓
   [Freecourse API] → POST [gasWebAppUrl] (generate_main_cert)
   ↓
   [GAS] generates PDF → saves to Drive
   ↓
   [GAS] returns Drive URL
   ↓
   ✅ Certificate info saved in `enrollments`
   ✅ Drive URL returned to your app
   ↓
   [Your App] displays download link to user
```

---

## 🚀 Quick Start Example

### JavaScript/TypeScript Example

```typescript
// 1. Enroll user
async function enrollUser(userData) {
  const response = await fetch('https://freecourse.iodacademy.id/api/public/standalone/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'identity',
      email: userData.email,
      payload: {
        nama_lengkap: userData.fullName,
        jenis_kelamin: userData.gender,
        tanggal_lahir: userData.birthDate,
        alamat_email: userData.email,
        nomor_whatsapp: userData.phone,
        asal_daerah: userData.region,
        disabilitas: userData.disability,
        jika_diberikan_kesempatan_pelatihan_bidang_apa_yang_paling_anda_minati: userData.interests,
        apakah_anda_setuju_dan_bersedia_untuk_mengisi_data_pada_form_ini: "Ya",
        pretest_pernah_belajar_financial_literacy: userData.hasLearned,
        pretest_score: userData.hasLearned === "Pernah" ? 30 : 10,
        channelSource: "premium_lms",
        detailChannel: "Your LMS Name"
      }
    })
  });
  
  return response.json();
}

// 2. Submit quiz
async function submitQuiz(email, quizData) {
  const response = await fetch('https://freecourse.iodacademy.id/api/public/standalone/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'quiz',
      email: email,
      payload: {
        score: quizData.score,
        passed: quizData.score >= 60,
        kkm: 60,
        answers: quizData.answers
      }
    })
  });
  
  return response.json();
}

// 3. Submit survey
async function submitSurvey(email, surveyData) {
  const response = await fetch('https://freecourse.iodacademy.id/api/public/standalone/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'survey',
      email: email,
      payload: {
        surveyType: 'survei1',
        surveyResult: surveyData
      }
    })
  });
  
  return response.json();
}

// 4. Claim certificate
async function claimCertificate(email, confirmedName) {
  const response = await fetch('https://freecourse.iodacademy.id/api/public/standalone/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'certificate',
      email: email,
      payload: {
        confirmedName: confirmedName // optional
      }
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Open certificate in new tab
    window.open(data.driveUrl, '_blank');
  }
  
  return data;
}
```

---

## ⚠️ Important Notes

### Email sebagai User ID

- System menggunakan **email** (lowercase) sebagai document ID di Firestore
- Pastikan email unique per user
- Email akan di-lowercase otomatis di backend

### Certificate Name Validation

Backend akan validasi nama sertifikat:
- Tidak boleh kosong
- Tidak boleh berupa NIK/angka saja
- Tidak boleh pakai font fancy/symbol yang tidak ter-render
- Harus nama lengkap yang valid

### Channel Source

Gunakan `channelSource` dan `detailChannel` untuk tracking origin user:
```javascript
{
  channelSource: "premium_lms",
  detailChannel: "Your LMS Name - Financial Literacy Course"
}
```

### Step IDs (Dynamic)

Step ID seperti `"new-1779462139521"` bersifat dynamic dan diambil dari `settings.quizStepId`.
Jika tidak ada di settings, akan fallback ke default value.

---

## 📞 Support

Jika ada pertanyaan atau butuh bantuan:
- Check LOG.md untuk changelog
- Review code di `src/app/api/public/standalone/submit/route.ts`
- Review GAS script di `gas-all-in-one.js`

---

**Last Updated:** 7 Juli 2026
**Version:** 1.0