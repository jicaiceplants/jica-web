"use client";

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
  title?: string;
}

export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title = "Confirm Action",
  message = "Are you sure you want to perform this action?"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700 max-h-[90dvh] overflow-y-auto">
        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm shadow-red-600/20 cursor-pointer"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
