import React from 'react';
import { Tenant, User } from '../types';

interface TrialExpiredModalProps {
  tenant: Tenant;
  user: User;
  onLogout: () => void;
}

export const TrialExpiredModal: React.FC<TrialExpiredModalProps> = ({
  tenant,
  user,
  onLogout,
}) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 font-['Inter',sans-serif]">
      <div className="bg-white w-full max-w-md rounded-2xl border border-[#E1E1E1] shadow-2xl p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Warning Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-full bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 flex items-center justify-center text-[#ba1a1a]">
          <span className="material-symbols-outlined text-3xl">timer_off</span>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Masa Trial 3 Bulan Telah Habis
          </h2>
          <p className="text-xs text-[#464555] leading-relaxed">
            Masa percobaan layanan untuk organisasi <strong className="text-[#1a1c1c]">{tenant.name}</strong> telah berakhir. Akses fitur aplikasi sementara terkunci.
          </p>
        </div>

        {/* Tenant Detail Box */}
        <div className="bg-[#f8f9fc] p-4 rounded-xl border border-[#E1E1E1] text-left text-xs space-y-2">
          <div className="flex justify-between border-b border-[#E1E1E1] pb-2">
            <span className="text-[#767587] font-medium">Organisasi Tenant:</span>
            <span className="font-bold text-[#1a1c1c]">{tenant.name}</span>
          </div>
          <div className="flex justify-between border-b border-[#E1E1E1] pb-2">
            <span className="text-[#767587] font-medium">Kode Tenant:</span>
            <span className="font-mono font-bold text-[#1a1c1c]">{tenant.code}</span>
          </div>
          <div className="flex justify-between border-b border-[#E1E1E1] pb-2">
            <span className="text-[#767587] font-medium">Paket Berlangganan:</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
              Trial 3 Bulan
            </span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-[#767587] font-medium">Tanggal Trial Berakhir:</span>
            <span className="font-bold text-[#ba1a1a]">{tenant.trialEndDate || '01 Aug 2026'}</span>
          </div>
        </div>

        {/* Support Note */}
        <div className="p-3 bg-[#4744e5]/5 border border-[#4744e5]/20 rounded-xl text-left text-xs text-[#464555] space-y-1">
          <div className="font-bold text-[#4744e5] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">headset_mic</span>
            <span>Ingin Melanjutkan Berlangganan?</span>
          </div>
          <p className="text-[11px] text-[#767587]">
            Silakan hubungi Super Administrator atau Tim Sales SalesFlow Pro untuk melakukan upgrade ke paket Enterprise / Professional.
          </p>
          <div className="text-[11px] font-semibold text-[#1a1c1c] pt-1">
            Email: <a href="mailto:sales@salesflow.pro" className="text-[#4744e5] underline">sales@salesflow.pro</a> • Telp: +62 21 555 0192
          </div>
        </div>

        {/* Forced Logout Action Button */}
        <div className="pt-2">
          <button
            onClick={onLogout}
            className="w-full py-3 bg-[#ba1a1a] hover:bg-[#931313] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 font-['Hanken_Grotesk'] active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Masa Trial Habis - Logout Sekarang</span>
          </button>
          <p className="text-[10px] text-[#767587] mt-2 italic">
            Akun Anda ({user.email}) akan dikeluaran secara aman dari sesi aktif.
          </p>
        </div>
      </div>
    </div>
  );
};
