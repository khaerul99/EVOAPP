import React, { useState } from 'react';
import { X } from 'lucide-react';
import { userService } from '../../services/user/user.service';
import { authStore } from '../../stores/authSlice';

const ResetPasswordModal = ({ open, onClose }) => {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!open) return null;

  const username = String(authStore.getState()?.auth?.username || '').trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!oldPwd || !newPwd) {
      setMessage('Old password dan new password wajib diisi.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setMessage('Password konfirmasi tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      await userService.modifyPassword({ name: username, pwd: newPwd, pwdOld: oldPwd });
      setMessage('Password berhasil diubah. Silakan login ulang.');
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
      onClose();
    } catch (err) {
      const errMsg = (err?.response && (typeof err.response.data === 'string' ? err.response.data : err.response.data?.message)) || err?.message || String(err);
      setMessage(String(errMsg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md p-6 bg-white shadow-lg rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Reset Password</h3>
          <button onClick={onClose} className="p-2 text-navy/60 hover:text-navy">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-navy/70">Old Password</label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              className="w-full px-3 py-2 mt-1 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-navy/70">New Password</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full px-3 py-2 mt-1 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-navy/70">Confirm New Password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className="w-full px-3 py-2 mt-1 border rounded-md"
              required
            />
          </div>

          {message && <div className="text-sm text-red-600">{message}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-white rounded-md bg-navy disabled:opacity-50">
              {loading ? 'Saving...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
