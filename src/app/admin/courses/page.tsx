"use client";

import { useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "./page.module.css";
import type { Course } from "@/lib/types";
import { Star, BookOpen, Pencil, Settings } from "lucide-react";

const DUMMY_COURSES: Partial<Course>[] = [
  {
    id: "course-main",
    title: "Kursus Literasi Finansial Dasar",
    totalSteps: 10,
    isMainCourse: true,
    status: "published",
    updatedAt: new Date(),
  },
  {
    id: "course-bonus-1",
    title: "Legal & Hukum Bisnis",
    totalSteps: 5,
    isMainCourse: false,
    status: "published",
    updatedAt: new Date(),
  },
  {
    id: "course-bonus-2",
    title: "Digital Marketing untuk UMKM",
    totalSteps: 0,
    isMainCourse: false,
    status: "draft",
    updatedAt: new Date(),
  },
];

export default function AdminCoursesPage() {
  const [courses] = useState(DUMMY_COURSES);

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Kelola Kursus & Materi</h1>
            <p className={styles.subtitle}>Atur modul pembelajaran, assessment, dan survei.</p>
          </div>
          <button className="btn btn-primary">+ Buat Kursus Baru</button>
        </header>

        <div className={styles.grid}>
          {courses.map((course) => (
            <div key={course.id} className={styles.courseCard}>
              <div className={styles.cardHeader}>
                <span className={`${styles.statusBadge} ${styles[course.status!]}`}>
                  {course.status === "published" ? "Publik" : "Draft"}
                </span>
                {course.isMainCourse && (
                  <span className={styles.mainBadge}><Star size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /> Utama</span>
                )}
              </div>
              <h3 className={styles.courseTitle}>{course.title}</h3>
              <p className={styles.courseMeta}>
                <span><BookOpen size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /> {course.totalSteps} Modul/Materi</span>
                <span>Terakhir diupdate: {course.updatedAt?.toLocaleDateString("id-ID")}</span>
              </p>
              <div className={styles.cardActions}>
                <Link href={`/admin/courses/${course.id}`} className="btn btn-secondary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Pencil size={16} /> Edit Materi
                </Link>
                <button className="btn btn-secondary" title="Pengaturan Kursus" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Settings size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
