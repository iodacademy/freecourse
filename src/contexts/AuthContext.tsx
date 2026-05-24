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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Firebase-Token": token 
        },
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
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Firebase-Token": token,  // fallback untuk hosting yg strip Authorization
        }
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
      if (firebaseError.code === "auth/cancelled-popup-request") return;
      console.error("Login error:", err);
      setError("Gagal login. Silakan coba lagi.");
    }
  }

  // Login admin via access code (no Firebase Auth)
  async function loginAsAdmin(accessCode: string) {
    try {
      setError(null);
      
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kode akses salah");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("admin_code", accessCode);
      }

      const mockUser = { uid: "admin", getIdToken: async () => accessCode } as any;
      setUser(mockUser);
      setProfile(data.user as UserProfile);
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
      if (typeof window !== "undefined") {
        localStorage.removeItem("admin_code");
      }
      if (auth && auth.currentUser) {
        await signOut(auth);
      }
      setUser(null);
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Firebase-Token": token,  // fallback untuk hosting yg strip Authorization
        },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        const rawText = await res.text();
        console.error("[updateUserProfile] API error:", res.status, rawText);
        // Coba parse JSON, kalau gagal tampilkan raw text
        let errorMsg = `HTTP ${res.status}`;
        try {
          const errData = JSON.parse(rawText);
          errorMsg = errData.error || errorMsg;
        } catch {
          errorMsg = `HTTP ${res.status}: ${rawText.substring(0, 200)}`;
        }
        throw new Error(errorMsg);
      }
      
      const updatedData = await res.json();
      setProfile(updatedData as UserProfile);
    } catch (err) {
      console.error("Error updating profile:", err);
      throw err;
    }
  }

  // Listen auth state changes
  useEffect(() => {
    // Cek admin mode dulu
    if (typeof window !== "undefined") {
      const adminCode = localStorage.getItem("admin_code");
      if (adminCode) {
        const verifyAdmin = async () => {
          try {
            const res = await fetch("/api/auth/admin-login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accessCode: adminCode }),
            });
            if (res.ok) {
              const data = await res.json();
              const mockUser = { uid: "admin", getIdToken: async () => adminCode } as any;
              setUser(mockUser);
              setProfile(data.user);
              setLoading(false);
              return; // Stop here if admin is valid
            } else {
              localStorage.removeItem("admin_code");
            }
          } catch {
            localStorage.removeItem("admin_code");
          }
        };
        verifyAdmin().then(() => {
          // If admin fails, we should fall back to Firebase listener
          setupFirebaseListener();
        });
        return; // wait for verification
      }
    }

    setupFirebaseListener();

    function setupFirebaseListener() {
      if (!auth) {
        setLoading(false);
        return;
      }
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (typeof window !== "undefined" && localStorage.getItem("admin_code")) {
          return; // Ignore if admin code was set in the meantime
        }
        setUser(firebaseUser);
        if (firebaseUser) {
          if (!firebaseUser.isAnonymous) {
            await fetchOrCreateProfile(firebaseUser);
          } else {
            // Kita sudah tidak pakai anonymous auth, sign out
            await signOut(auth!);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    }
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
