"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

interface AuthContextType {
  // State
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;

  // Actions
  loginWithGoogle: () => Promise<void>;
  loginAsAdmin: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch/create profile from backend API
  async function fetchOrCreateProfile(firebaseUser: FirebaseUser) {
    try {
      const token = await firebaseUser.getIdToken();
      
      // Ambil data tracking dari sessionStorage
      const channelSource = typeof window !== 'undefined' ? sessionStorage.getItem("channelSource") : null;
      const eventId = typeof window !== 'undefined' ? sessionStorage.getItem("eventId") : null;
      const partnerCode = typeof window !== 'undefined' ? sessionStorage.getItem("partnerCode") : null;

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: token,
          channelSource,
          eventId,
          partnerCode
        })
      });

      if (!res.ok) throw new Error("Gagal verifikasi dengan server");
      
      const data = await res.json();
      setProfile({ ...data.user, profileCompleted: data.profileCompleted } as UserProfile);
    } catch (err) {
      console.error("Error fetching profile from API:", err);
      setError("Gagal memuat data profil. Silakan coba lagi.");
    }
  }

  // Refresh profil
  async function refreshProfile() {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/users/${user.uid}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data as UserProfile);
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  }

  // Login dengan Google SSO (untuk siswa)
  async function loginWithGoogle() {
    if (!auth) {
      setError("Firebase belum dikonfigurasi. Hubungi admin.");
      return;
    }
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      await fetchOrCreateProfile(result.user);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === "auth/popup-closed-by-user") return;
      console.error("Login error:", err);
      setError("Gagal login. Silakan coba lagi.");
    }
  }

  // Login admin via access code (anonymous auth)
  async function loginAsAdmin(accessCode: string) {
    if (!auth) {
      setError("Firebase belum dikonfigurasi.");
      return;
    }
    try {
      setError(null);
      
      // 1. Sign in anonymously
      const result = await signInAnonymously(auth);
      const token = await result.user.getIdToken();

      // 2. Verify access code with backend
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token, accessCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Code salah — sign out anonymous user
        await signOut(auth);
        throw new Error(data.error || "Kode akses salah");
      }

      // 3. Set profile as admin
      setProfile({ ...data.user, profileCompleted: true, role: "admin" } as UserProfile);
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error("Admin login error:", err);
      setError(e.message || "Gagal login admin.");
      throw err;
    }
  }

  // Logout
  async function logout() {
    if (!auth) return;
    try {
      await signOut(auth);
      setProfile(null);
    } catch (err) {
      console.error("Logout error:", err);
      setError("Gagal logout. Silakan coba lagi.");
    }
  }

  // Update profil user
  async function updateUserProfile(data: Partial<UserProfile>) {
    if (!user) throw new Error("User belum login");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/users/${user.uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) throw new Error("Gagal update profil");
      
      const updatedData = await res.json();
      setProfile(updatedData as UserProfile);
    } catch (err) {
      console.error("Error updating profile:", err);
      throw err;
    }
  }

  // Listen auth state changes
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Jika anonymous user (admin), cek Firestore
        if (firebaseUser.isAnonymous) {
          try {
            const token = await firebaseUser.getIdToken();
            const res = await fetch(`/api/users/${firebaseUser.uid}`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.role === "admin") {
                setProfile(data as UserProfile);
              } else {
                // Anonymous tapi bukan admin — sign out
                setProfile(null);
              }
            } else {
              setProfile(null);
            }
          } catch {
            setProfile(null);
          }
        } else {
          // Google SSO user — fetch normal
          await fetchOrCreateProfile(firebaseUser);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    error,
    loginWithGoogle,
    loginAsAdmin,
    logout,
    refreshProfile,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
