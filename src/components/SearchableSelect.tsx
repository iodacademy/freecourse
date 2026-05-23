import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  disabled = false,
  error = false,
  className = ""
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div 
        className={className}
        style={{ 
          cursor: disabled ? "not-allowed" : "pointer", 
          opacity: disabled ? 0.6 : 1, 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          borderColor: error ? "#ef4444" : undefined
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span style={{ color: value ? "inherit" : "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} color="#999" style={{ flexShrink: 0 }} />
      </div>

      {isOpen && !disabled && (
        <div style={{ 
          position: "absolute", 
          top: "100%", 
          left: 0, 
          right: 0, 
          background: "white", 
          border: "1px solid #ddd", 
          borderRadius: "8px", 
          marginTop: "4px", 
          zIndex: 50, 
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", 
          maxHeight: "250px", 
          display: "flex", 
          flexDirection: "column" 
        }}>
          <div style={{ padding: "8px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "8px" }}>
            <Search size={14} color="#999" style={{ flexShrink: 0 }} />
            <input 
              type="text" 
              autoFocus
              style={{ border: "none", outline: "none", width: "100%", fontSize: "13px" }}
              placeholder="Cari..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "10px", textAlign: "center", color: "#999", fontSize: "13px" }}>Tidak ditemukan</div>
            ) : (
              filtered.map(opt => (
                <div 
                  key={opt}
                  style={{ 
                    padding: "10px 14px", 
                    fontSize: "14px", 
                    cursor: "pointer", 
                    background: value === opt ? "#f5f5f5" : "transparent" 
                  }}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#fafafa"}
                  onMouseLeave={(e) => e.currentTarget.style.background = value === opt ? "#f5f5f5" : "transparent"}
                >
                  {opt}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
