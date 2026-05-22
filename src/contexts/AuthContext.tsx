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
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

interface AuthContextType {
  // State
  user: FirebaseUser | null; // Data dari Firebase Auth
  profile: UserProfile | null; // Data dari Firestore
  loading: boolean; // Sedang loading data user?
  error: string | null;

  // Actions
  loginWithGoogle: () => Promise<void>;
  loginAsDummyStudent: () => void;
  loginAsDummyAdmin: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Simpan data profil setelah registrasi
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Hook untuk menggunakan auth context di komponen manapun
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider");
  }
  return context;
}

// Provider yang membungkus seluruh aplikasi
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fungsi untuk ambil/buat profil user dari API Backend
  async function fetchOrCreateProfile(firebaseUser: FirebaseUser) {
    try {
      const token = await firebaseUser.getIdToken();
      
      // Ambil data tracking dari sessionStorage (jika ada)
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
      // data.user berisi profil (uid, email, displayName, photoURL, role, dsb)
      // data.profileCompleted juga dikembalikan dari backend
      setProfile({ ...data.user, profileCompleted: data.profileCompleted } as UserProfile);
    } catch (err) {
      console.error("Error fetching profile from API:", err);
      setError("Gagal memuat data profil. Silakan coba lagi.");
    }
  }

  // Fungsi untuk refresh profil (dipanggil setelah update profil)
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

  // Login dengan Google SSO
  async function loginWithGoogle() {
    if (!auth) {
      setError("Firebase belum dikonfigurasi. Hubungi admin.");
      return;
    }
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged akan otomatis dipanggil
      await fetchOrCreateProfile(result.user);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === "auth/popup-closed-by-user") {
        // User menutup popup — bukan error
        return;
      }
      console.error("Login error:", err);
      setError("Gagal login. Silakan coba lagi.");
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

  // Update profil user (dipanggil setelah isi form data diri)
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

  // Listen perubahan auth state (login/logout)
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchOrCreateProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dummy Login for Testing
  function loginAsDummyStudent() {
    const dummyUser = { uid: "dummy-student-123", email: "student@example.com", displayName: "Siswa Dummy", photoURL: null } as FirebaseUser;
    setUser(dummyUser);
    setProfile({
      uid: dummyUser.uid,
      email: dummyUser.email || "",
      emailUsername: "student",
      displayName: dummyUser.displayName || "",
      photoURL: dummyUser.photoURL,
      role: "student",
      profileCompleted: true,
      profileData: { namaLengkap: "Siswa Dummy" },
      channelSource: "b2c_ads",
      eventId: null,
      partnerCode: null,
      utmData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  function loginAsDummyAdmin() {
    const dummyUser = { uid: "dummy-admin-456", email: "admin@ioda.id", displayName: "Admin IODA", photoURL: null } as FirebaseUser;
    setUser(dummyUser);
    setProfile({
      uid: dummyUser.uid,
      email: dummyUser.email || "",
      emailUsername: "admin",
      displayName: dummyUser.displayName || "",
      photoURL: dummyUser.photoURL,
      role: "admin",
      profileCompleted: true,
      profileData: { namaLengkap: "Admin IODA" },
      channelSource: null,
      eventId: null,
      partnerCode: null,
      utmData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const value: AuthContextType = {
    user,
    profile,
    loading,
    error,
    loginWithGoogle,
    loginAsDummyStudent,
    loginAsDummyAdmin,
    logout,
    refreshProfile,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
