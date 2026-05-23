// Tipe data profil form yang diisi user
export interface ProfileFormData {
  namaLengkap?: string;
  jenisKelamin?: string;
  tanggalLahir?: string;
  nomorWA?: string;
  provinsi?: string;
  kotaKabupaten?: string;
  disabilitas?: string;
  kategoriDisabilitas?: string[];
  kategoriDisabilitasLainnya?: string;
  [key: string]: string | string[] | undefined; // untuk field dinamis tambahan
}

// Tipe data user yang tersimpan di Firestore
export interface UserProfile {
  uid: string;
  email: string;
  emailUsername: string; // bagian sebelum @
  displayName: string;
  photoURL: string | null;
  role: "student" | "admin";
  profileCompleted: boolean;
  profileData: ProfileFormData;
  channelSource: "umum" | "beasiswa" | "kemitraan" | "workshop" | null;
  eventId: string | null;
  partnerCode: string | null;
  utmData: {
    source?: string;
    medium?: string;
    campaign?: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

// Tipe data untuk form field dinamis (diatur admin)
export interface ProfileField {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "tel" | "date" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[]; // untuk tipe "select"
}

// Tipe data kursus
export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  totalSteps: number;
  isMainCourse: boolean;
  status: "draft" | "published" | "archived";
  certificateConfig: {
    googleSlideTemplateId: string;
    issuerName: string;
    signerName: string;
    signerTitle: string;
  };
  bonusCourseEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tipe data step/materi
export interface CourseStep {
  id: string;
  courseId: string;
  order: number;
  title: string;
  video: {
    youtubeId: string;
    url: string;
    duration: number;
  };
  hasAssessment: boolean;
  hasSurvey: boolean;
  hasAdditionalMaterial?: boolean;
  assessment?: Assessment;
  survey?: Survey;
  additionalMaterial?: AdditionalMaterial;
  createdAt: Date;
  updatedAt: Date;
}

// Assessment
export interface AssessmentQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  feedbackCorrect: string;
  feedbackWrong: string;
  hint: string;
}

export interface Assessment {
  kkm: number;
  questions: AssessmentQuestion[];
}

// Materi Tambahan
export interface AdditionalMaterial {
  description: string;
  linkTitle: string;
  linkUrl: string;
}

// Survey
export interface SurveyQuestion {
  id: string;
  text: string;
  type: "starRating" | "scale" | "multipleChoice" | "shortText";
  options?: string[];
  maxStars?: number;
  required: boolean;
  minLabel?: string;
  maxLabel?: string;
}

export interface Survey {
  questions: SurveyQuestion[];
}

// Enrollment (pendaftaran siswa ke kursus)
export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  eventId: string | null;
  channelSource: string | null;
  status: "enrolled" | "in_progress" | "completed" | "certified";
  currentStep: number;
  stepProgress: Record<string, StepProgress>;
  certificateClaimed: boolean;
  certificateClaimedAt: Date | null;
  certificateId: string | null;
  certificateDriveUrl: string | null;
  certificateEmailSent: boolean;
  bonusCourseTopicId: string | null;
  bonusCourseRedeemCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StepProgress {
  completed: boolean;
  completedAt: Date | null;
  assessmentResult?: {
    score: number;
    passed: boolean;
    attempts: number;
    lastAttemptAt: Date;
    answers: Record<string, string>;
  };
  surveyResult?: {
    submitted: boolean;
    submittedAt: Date;
    answers: Record<string, string | number>;
  };
}

// Event
export interface Event {
  id: string;
  name: string;
  description: string;
  channelType: "b2b_campus" | "b2c_ads" | "b2c_workshop";
  courseId: string;
  status: "draft" | "active" | "closed";
  startDate: Date;
  endDate: Date;
  campusName?: string;
  partnerCode?: string;
  bulkImportedEmails?: string[];
  landingPageConfig?: {
    heroTitle: string;
    heroSubtitle: string;
  };
  utmTracking?: boolean;
  workshopConfig?: {
    zoomLink: string;
    waGroupLink: string;
    schedule: Date;
    capacity: number;
    currentRegistrants: number;
    reminderSent: { h3: boolean; h1: boolean; h0: boolean };
  };
  customProfileFields?: ProfileField[];
  createdAt: Date;
  updatedAt: Date;
}

// Partner Code (Kode Mitra)
export interface PartnerCode {
  id: string;
  code: string;
  eventId: string;
  partnerName: string;
  courseId: string;
  status: "active" | "disabled";
  usedBy: string[];
  usedCount: number;
  quota: number;
  createdAt: Date;
}

// Bonus Course Topic
export interface BonusCourseTopic {
  id: string;
  name: string;
  description: string;
  classCode: string;
  portalUrl: string;
  status: "active" | "inactive";
  createdAt: Date;
}

// Certificate Verification
export interface CertificateVerification {
  certId: string;
  userId: string;
  userName: string;
  courseId: string;
  courseName: string;
  claimedAt: Date;
  issuerName: string;
  isValid: boolean;
  verifyUrl: string;
}

// App Settings
export interface AppSettings {
  mainCourseId: string;
  adminEmails: string[];
  gasWebAppUrl: string;
  profileFields: ProfileField[];
  updatedAt: Date;
}

// Dynamic Form Builder Types
export interface DynamicFormField {
  id: string; // internal id
  name: string; // field key stored in profileData (e.g. 'namaLengkap')
  label: string;
  type: "text" | "number" | "email" | "tel" | "date" | "select" | "radio" | "checkbox" | "textarea" | "province_city";
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select, radio, checkbox
  description?: string;
  dependsOn?: string; // ID of the field this field depends on
  dependsOnValue?: string; // Value of the dependent field that triggers this field
  regionSource?: "auto" | "manual";
  customRegions?: { province: string; cities: string[] }[];
}

export interface DynamicFormSection {
  id: string;
  title: string;
  description?: string;
  fields: DynamicFormField[];
}

export interface DynamicForm {
  id: string;
  title: string;
  isActive: boolean;
  sections: DynamicFormSection[];
  createdAt: Date;
  updatedAt: Date;
}
