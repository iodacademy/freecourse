"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.css";
import { Trash2, Plus, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog, AlertDialog } from "@/components/Modal/Dialogs";

type AdminUser = {
  id: string;
  code: string;
  role: string;
};

export default function AdministratorsSettingsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCode, setNewCode] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [isAdding, setIsAdding] = useState(false);

  const [alertMsg, setAlertMsg] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchUsers();
  }, [user]);

  async function getToken() {
    if (!user) return "";
    try { return await (user as any).getIdToken(); } catch { return ""; }
  }

  async function fetchUsers() {
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
      setAlertMsg("Gagal mengambil data administrator");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newCode.trim()) return;
    setIsAdding(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: newCode.trim(), role: newRole }),
      });
      const result = await res.json();
      if (!res.ok) {
        setAlertMsg(result.error || "Gagal menambahkan administrator");
      } else {
        setNewCode("");
        setNewRole("admin");
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
      setAlertMsg("Gagal menambahkan administrator");
    } finally {
      setIsAdding(false);
    }
  }

  async function deleteUser() {
    if (!confirmDeleteId) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${confirmDeleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        setAlertMsg(data.error || "Gagal menghapus administrator");
      }
    } catch (e) {
      console.error(e);
      setAlertMsg("Gagal menghapus administrator");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const roleBadge = (role: string) => ({
    display: 'inline-block',
    background: role === 'admin' ? '#eff6ff' : '#faf5ff',
    color: role === 'admin' ? '#1d4ed8' : '#7c3aed',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  });

  return (
    <div className={styles.page}>
      <div className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Shield size={18} color="#cc0000" />
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Daftar Administrator</h2>
        </div>
        <p className={styles.sectionDesc}>Kelola kode akses untuk login admin dan mitra.</p>

        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Memuat...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #f3f4f6' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9ca3af', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kode Akses</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9ca3af', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 500, color: '#111827', fontSize: 13 }}>{u.code}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={roleBadge(u.role)}>{u.role}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => setConfirmDeleteId(u.id)}
                      title="Hapus"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4, borderRadius: 4, transition: 'color 0.15s', display: 'inline-flex' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#cc0000')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* ── Baris Tambah ── */}
              <tr style={{ borderTop: '1.5px dashed #e5e7eb', backgroundColor: '#fafafa' }}>
                <td style={{ padding: '10px 12px' }}>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="Kode akses baru..."
                    style={{ fontSize: 13 }}
                  />
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <select
                    className={styles.fieldSelect}
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="admin">Admin</option>
                    <option value="mitra">Mitra</option>
                  </select>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleAdd}
                    disabled={isAdding || !newCode.trim()}
                    style={{ padding: '7px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6 }}
                  >
                    <Plus size={13} />
                    Tambah
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {!loading && users.length === 0 && (
          <p style={{ textAlign: 'center', color: '#d1d5db', fontSize: 13, padding: '16px 0' }}>
            Belum ada administrator.
          </p>
        )}
      </div>

      <AlertDialog
        isOpen={!!alertMsg}
        onClose={() => setAlertMsg("")}
        message={alertMsg}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={deleteUser}
        title="Hapus Akses"
        message="Yakin ingin menghapus akses ini? Pengguna dengan kode ini tidak akan bisa login lagi."
        confirmText="Hapus"
        confirmStyle={{ background: '#cc0000', borderColor: '#cc0000', color: 'white' }}
      />
    </div>
  );
}
