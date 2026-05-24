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

  const roleBadgeStyle = (role: string) => ({
    background: role === 'admin' ? '#e3f2fd' : '#f3e5f5',
    color: role === 'admin' ? '#1565c0' : '#7b1fa2',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  });

  return (
    <div className={styles.page}>
      <div className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Shield size={22} color="var(--color-primary)" />
          <div>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Daftar Administrator</h2>
            <p className={styles.sectionDesc} style={{ margin: '4px 0 0' }}>Kelola kode akses untuk login admin dan mitra.</p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#888', fontSize: 14 }}>Memuat data...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-gray-200)' }}>
                  <th style={{ padding: '10px 16px', color: 'var(--color-gray-500)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kode Akses</th>
                  <th style={{ padding: '10px 16px', color: 'var(--color-gray-500)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                  <th style={{ padding: '10px 16px', width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-gray-100)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 500, fontFamily: 'monospace', fontSize: 13 }}>{u.code}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={roleBadgeStyle(u.role)}>{u.role}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button 
                        onClick={() => setConfirmDeleteId(u.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4, borderRadius: 4, transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#cc0000')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#999')}
                        title="Hapus"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* ── BARIS TAMBAH BARU ── */}
                <tr style={{ backgroundColor: 'var(--color-gray-50)', borderTop: '2px dashed var(--color-gray-200)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <input 
                      type="text" 
                      className="input" 
                      value={newCode}
                      onChange={e => setNewCode(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdd()}
                      placeholder="Kode akses baru..."
                      style={{ width: '100%', fontSize: 13 }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <select 
                      className="input" 
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      style={{ width: '100%', fontSize: 13 }}
                    >
                      <option value="admin">Admin</option>
                      <option value="mitra">Mitra</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleAdd}
                      disabled={isAdding || !newCode.trim()}
                      style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Plus size={14} /> Tambah
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            {users.length === 0 && (
              <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0', fontSize: 14 }}>
                Belum ada data administrator.
              </p>
            )}
          </div>
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
