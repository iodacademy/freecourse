import re

with open('src/app/admin/students/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update StudentDetailModal to handle DashboardStudent
modal_replacement = '''
  const pd = student.profileData || {};
  const namaLengkap = student.namaLengkap || student.displayName || "—";
  const email = student.email || "—";
  const photoURL = student.photoURL || null;
  const initials = namaLengkap.split(" ").slice(0, 2).map((w: string) => w[0] || "").join("").toUpperCase();

  const jenisKelamin = student.jenisKelamin || pd.jenis_kelamin || "—";
  const tanggalLahir = student.tanggalLahir || (Array.isArray(pd.tanggal_lahir) ? pd.tanggal_lahir[0] : pd.tanggal_lahir) || "";
  const whatsapp = student.nomorWA || pd.nomor_whatsapp || "—";
  const provinsi = typeof pd.asal_daerah === "string" ? pd.asal_daerah : "—";
  const kota = student.kota || "—";
  const disabilitas = student.disabilitas || pd.disabilitas || "—";
  const channelSource = student.channelSource || student.channel;
  const partnerCode = student.partnerCode || null;
  const eventId = student.eventId || null;
  const createdAt = student.tanggalDaftar || (student.createdAt ? new Date(student.createdAt as any).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—");
'''
content = re.sub(
    r'  const pd = student\.profileData \|\| \{\};.*?const createdAt = .*?;',
    modal_replacement.strip(),
    content,
    flags=re.DOTALL
)

# 2. Add import for DashboardStudent
content = content.replace('import type { UserProfile } from "@/lib/types";', 'import type { UserProfile } from "@/lib/types";\nimport type { DashboardStudent } from "@/lib/dashboard-aggregator";')

# 3. Rewrite AdminStudentsPage
admin_page_replacement = '''
export default function AdminStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]); // Array of DashboardStudent
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Client-side pagination
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);

  // State detail modal
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  // State progress modal
  const [progressTarget, setProgressTarget] = useState<any | null>(null);

  // State untuk konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const getToken = useCallback(async () => {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch(`/api/admin/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filter lokal pada data yang sudah di-load
  const filteredStudents = students.filter((s) => {
    const matchChannel = filter === "all" || s.channelSource === filter || s.channel?.toLowerCase() === filter;
    if (!activeSearch) return matchChannel;
    const q = activeSearch.toLowerCase();
    return matchChannel && (
      s.namaLengkap?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      (s.partnerCode || "").toLowerCase().includes(q) ||
      (s.detailChannel || "").toLowerCase().includes(q)
    );
  });

  // Enter di search box
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    setActiveSearch(searchInput.trim());
    setPage(1);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput(""); setActiveSearch("");
    setPage(1);
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setSearchInput(""); setActiveSearch("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const slice = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleNext = () => {
    if (page < totalPages) setPage(p => p + 1);
  };

  const handlePrev = () => {
    if (page > 1) setPage(p => p - 1);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.uid) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/users/${deleteTarget.uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghapus akun");
      }
      // Hapus dari state lokal
      setStudents(prev => prev.filter(s => s.uid !== deleteTarget.uid));
      setDeleteTarget(null);
    } catch (e: any) {
      setDeleteError(e.message || "Terjadi kesalahan");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Data Siswa</h1>
            <p className={styles.subtitle}>Pantau pendaftaran dan progress belajar siswa.</p>
          </div>
          <button className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Download size={15} /> Export ke Excel
          </button>
        </header>

        <div className={styles.filterBar}>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
            <button className={`${styles.filterBtn} ${filter === "all" ? styles.active : ""}`} onClick={() => handleFilterChange("all")}>Semua Siswa</button>
            <button className={`${styles.filterBtn} ${filter === "kemitraan" ? styles.active : ""}`} onClick={() => handleFilterChange("kemitraan")}>Kemitraan</button>
            <button className={`${styles.filterBtn} ${filter === "beasiswa" ? styles.active : ""}`} onClick={() => handleFilterChange("beasiswa")}>Beasiswa</button>
            <button className={`${styles.filterBtn} ${filter === "workshop" ? styles.active : ""}`} onClick={() => handleFilterChange("workshop")}>Workshop</button>
          </div>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Cari nama, email, kode mitra... (Enter)"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearch}
            />
            {(searchInput || activeSearch) && (
              <button className={styles.searchClear} onClick={handleClearSearch} title="Hapus pencarian">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableCard}>
        <div className={styles.tableContainer} style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tanggal Daftar</th>
                <th>Channel</th>
                <th>Detail</th>
                <th>Email</th>
                <th>Nama</th>
                <th>Gender</th>
                <th>Umur</th>
                <th>Kota</th>
                <th>Disabilitas</th>
                <th>Minat</th>
                <th>Status</th>
                <th>Nilai Quiz</th>
                <th>Survei 1</th>
                <th>Survei 2</th>
                <th className={styles.actionsCell} style={{ position: 'sticky', right: 0, background: '#f9fafb', zIndex: 10 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((s) => (
                <tr
                  key={s.uid}
                  className={styles.clickableRow}
                  onClick={() => setDetailTarget(s)}
                >
                  <td className={styles.textSm}>{s.tanggalDaftar}</td>
                  <td><span className={styles.channelBadge}>{channelLabel(s.channelSource || s.channel?.toLowerCase())}</span></td>
                  <td className={styles.textSm}>{s.detailChannel}</td>
                  <td className={styles.textSm}>{s.email}</td>
                  <td className={styles.fw500}>{s.namaLengkap}</td>
                  <td className={styles.textSm}>{s.jenisKelamin}</td>
                  <td className={styles.textSm}>{s.umur}</td>
                  <td className={styles.textSm}>{s.kota}</td>
                  <td className={styles.textSm}>{s.disabilitas}</td>
                  <td className={styles.textSm}>{s.minat}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${s.status === 'Selesai' || s.status === 'Tersertifikasi' ? styles.complete : styles.incomplete}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className={styles.textSm}>{s.nilaiQuiz}</td>
                  <td className={styles.textSm}>{s.nilaiSurvei1}</td>
                  <td className={styles.textSm}>{s.nilaiSurvei2}</td>
                  <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()} style={{ position: 'sticky', right: 0, background: 'inherit', zIndex: 10 }}>
                    <button
                      className={styles.iconBtn}
                      title="Lihat Progress"
                      onClick={(e) => { e.stopPropagation(); setProgressTarget(s); }}
                    >
                      <BarChart2 size={15} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      title="Detail Siswa"
                      onClick={(e) => { e.stopPropagation(); setDetailTarget(s); }}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.deleteBtn}`}
                      title="Hapus Akun Siswa"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); setDeleteError(""); }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr><td colSpan={15} className={styles.emptyState}>Memuat data siswa...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={15} className={styles.emptyState}>
                  {activeSearch ? `Tidak ada siswa yang cocok dengan "${activeSearch}".` : "Tidak ada data siswa ditemukan."}
                </td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Halaman {page} dari {totalPages} &bull; Menampilkan {filteredStudents.length} siswa
            {activeSearch && <> (hasil pencarian: <strong>{activeSearch}</strong>)</>}
          </span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn} onClick={handlePrev} disabled={page <= 1 || loading}>
              <ChevronLeft size={15} /> Sebelumnya
            </button>
            <span className={styles.pageNum}>{page}</span>
            <button className={styles.pageBtn} onClick={handleNext} disabled={page >= totalPages || loading}>
              Berikutnya <ChevronRight size={15} />
            </button>
          </div>
        </div>
        </div> {/* /tableCard */}
      </div>

      {/* Detail Siswa Modal */}
      <StudentDetailModal student={detailTarget} onClose={() => setDetailTarget(null)} />

      {/* Progress Siswa Modal */}
      <ProgressModal student={progressTarget} onClose={() => setProgressTarget(null)} getToken={getToken} />

      {/* Dialog Konfirmasi Hapus */}
      {deleteTarget && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <Trash2 size={36} color="#dc2626" />
            </div>
            <h2 className={styles.confirmTitle}>Hapus Akun Siswa?</h2>
            <p className={styles.confirmDesc}>
              Kamu akan menghapus akun <strong>{deleteTarget.namaLengkap || deleteTarget.email}</strong> secara permanen.
              <br /><br />
              Tindakan ini akan menghapus:
            </p>
            <ul className={styles.confirmList}>
              <li>Akun Google (Firebase Authentication)</li>
              <li>Data profil siswa</li>
              <li>Riwayat enrollment &amp; progress belajar</li>
              <li>Data sertifikat (jika ada)</li>
            </ul>
            <p className={styles.confirmWarning}>Tindakan ini tidak bisa dibatalkan!</p>

            {deleteError && (
              <div className={styles.deleteError}>{deleteError}</div>
            )}

            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Batal
              </button>
              <button className={styles.confirmDeleteBtn} onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? (
                  <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Menghapus...</>
                ) : (
                  <><Trash2 size={14} /> Ya, Hapus Permanen</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
'''
content = re.sub(
    r'export default function AdminStudentsPage\(\) \{.*',
    admin_page_replacement.strip(),
    content,
    flags=re.DOTALL
)

with open('src/app/admin/students/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
