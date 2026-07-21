"use client";

import { ReactNode } from "react";
import styles from "./dashboard.module.css";

interface Props {
  toolbarRight?: ReactNode; // Filter chips + action buttons
  children: ReactNode;
  generatedAt?: string; // untuk watermark public
  showLogoBar?: boolean;
}

export default function DashboardShell({ toolbarRight, children, generatedAt, showLogoBar = false }: Props) {
  return (
    <div className={styles.dashboard}>
      {showLogoBar && (
        <div className={styles.logoBar}>
          <div className={styles.logoBarPartners}>
            <img src="/dashboard/logo-dbs.png" alt="DBS Foundation" className={styles.logoPartner} />
            <div className={styles.logoDivider} />
            <img src="/dashboard/logo-plan.png" alt="Plan International" className={styles.logoPartner} />
          </div>
          <img src="/dashboard/ioda-logo.png" alt="ioda academy" className={styles.logoIoda} />
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.titleWrap}>
          <span className={styles.eyebrow}>PROGRAM YOURISE</span>
          <h1 className={styles.h1}>Dashboard Pendaftar</h1>
        </div>
        <div className={styles.toolbarRight}>
          {toolbarRight}
        </div>
      </div>

      <div className={styles.body}>
        {children}
      </div>

      {showLogoBar && generatedAt && (
        <div className={styles.watermark}>
          Public View — diperbarui {generatedAt} WIB
        </div>
      )}
    </div>
  );
}
