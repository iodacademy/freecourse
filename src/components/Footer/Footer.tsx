import styles from "./Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <span>ioda</span>
          </div>
          <p className={styles.tagline}>
            Platform pembelajaran literasi finansial gratis dari IODA Academy.
          </p>
        </div>

        <div className={styles.links}>
          <div className={styles.linkGroup}>
            <h4 className={styles.linkTitle}>Pelajari</h4>
            <a href="https://iodacademy.id" target="_blank" rel="noopener noreferrer">
              Tentang IODA
            </a>
            <a href="https://app.iodacademy.id" target="_blank" rel="noopener noreferrer">
              Portal Belajar
            </a>
          </div>
          <div className={styles.linkGroup}>
            <h4 className={styles.linkTitle}>Bantuan</h4>
            <a
              href="https://wa.me/6281234567890?text=Halo%20Admin%20IODA"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hubungi Admin
            </a>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>© {year} IODA Academy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
