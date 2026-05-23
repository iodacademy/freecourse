"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";

export function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Konfirmasi", 
  message,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  confirmStyle = {}
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: React.CSSProperties;
}) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onClose}>{cancelText}</button>
          <button 
            className="btn btn-primary" 
            onClick={() => { onConfirm(); onClose(); }} 
            style={{ ...confirmStyle }}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <p style={{ margin: 0, color: '#444' }}>{message}</p>
    </Modal>
  );
}

export function AlertDialog({ 
  isOpen, 
  onClose, 
  title = "Peringatan", 
  message 
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-primary" onClick={onClose}>OK</button>
        </div>
      }
    >
      <p style={{ margin: 0, color: '#444' }}>{message}</p>
    </Modal>
  );
}

export function PromptDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Masukkan Data", 
  message,
  placeholder = "",
  confirmText = "Simpan",
  cancelText = "Batal",
  initialValue = ""
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (val: string) => void;
  title?: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  initialValue?: string;
}) {
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setVal(initialValue);
    }
  }, [isOpen, initialValue]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      size="sm"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onClose}>{cancelText}</button>
          <button 
            className="btn btn-primary" 
            onClick={() => { 
              if (val.trim()) {
                onConfirm(val);
                onClose();
              }
            }} 
            disabled={!val.trim()}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <p style={{ margin: '0 0 10px 0', color: '#444' }}>{message}</p>
      <input 
        type="text" 
        className="input w-full" 
        placeholder={placeholder} 
        value={val} 
        onChange={(e) => setVal(e.target.value)} 
        autoFocus
      />
    </Modal>
  );
}
