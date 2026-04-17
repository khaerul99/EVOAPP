# Permission Management Implementation

## Overview
Implementasi Permission Management telah dibuat untuk mengelola permission user berdasarkan endpoint yang Anda berikan. Fitur ini memungkinkan admin untuk mengatur akses per user dengan kategorisasi Config, Operation, Control, dan Channel-specific permissions.

## File-File yang Telah Dibuat

### 1. Service Layer
**File:** `src/services/user/permission.service.js`
- **getAbility()** - Mengambil daftar semua kemampuan/permission yang tersedia
- **getUserInfo(userName)** - Mengambil informasi user termasuk permission saat ini
- **getGroupInfo(groupName)** - Mengambil informasi group
- **modifyUserPermissions(userName, authorities)** - Memperbarui permission user

### 2. Hook
**File:** `src/hooks/user/usePermissionManagement.js`
- Custom hook untuk mengelola state permission management
- Mendukung kategori: Config, Operation, Control, dan Channel-specific
- Fitur toggle permission individual dan "Select All"
- Parsing response dari API device

#### Permission Categories:
- **Config**: System, Event, Account, Storage, Network, Security, Camera, Peripheral, PTZ
- **Operation**: Backup, Maintenance, Device Maintenance, Tasks
- **Control**: Manual Control
- **Channels**: Live, Playback untuk setiap channel

### 3. Component
**File:** `src/components/user/PermissionManagement.jsx`
- React component untuk UI permission management
- Menampilkan tab kategori (Config, Operation, Control)
- Tabel untuk channel permissions dengan checkbox
- User selector dropdown untuk switch antar user
- Save button untuk menyimpan perubahan

### 4. Integration
**Updated:** `src/pages/management/user/UserManagement.jsx`
- Integrasi PermissionManagement component di tab "Permission"
- State management untuk selected user pada permission tab
- User selection dropdown untuk memilih user dalam grup

**Updated:** `src/hooks/user/useUserManagement.js`
- Tambah state `selectedUserForPermission`
- Tambah setter `setSelectedUserForPermission`

## API Endpoints yang Digunakan

```
GET /cgi-bin/userManager.cgi?action=getAbility
- Mendapatkan daftar kemampuan yang tersedia

GET /cgi-bin/userManager.cgi?action=getUserInfoForName=<USERNAME>
- Mendapatkan info user termasuk authorities saat ini

GET /cgi-bin/userManager.cgi?action=modifyUser&name=<USERNAME>&authorities[0]=<VALUE>&authorities[1]=<VALUE2>...
- Memperbarui permission user dengan array authorities
```

## Cara Menggunakan

### Flow Dasar:
1. User membuka **USER MANAGEMENT** page
2. Memilih user dari tree view di sisi kiri
3. Mengklik tab **Permission**
4. Sistem akan:
   - Memuat daftar kemampuan dari device
   - Mengambil permission user saat ini
   - Menampilkan UI dengan kategori dan channel permissions
5. Admin dapat:
   - Toggle permission individual
   - Gunakan "Select All" / "Uncheck All" di setiap kategori
   - Toggle all channels untuk action tertentu (Live/Playback)
   - Switch ke user lain menggunakan dropdown
6. Klik **Save Changes** untuk menyimpan

## Contoh Response Parsing

### Ability Response (dari device):
```
Channel1=Parking Area
Channel2=Lobby Area
Channel3=Channel3
Channel6=Mess
```

### User Info Response (dari device):
```
name=admin
group=admin
authorities=System,Event,Account,Security,Camera,LiveChannel1,PlaybackChannel1,LiveChannel2,PlaybackChannel2
```

## State Structure

Permission state disusun berdasarkan kategori:
```javascript
{
    config: {
        System: true,
        Event: true,
        Account: false,
        // ...
    },
    operation: {
        Backup: false,
        Maintenance: true,
        // ...
    },
    control: {
        ManualControl: true
    },
    channel_1: {
        Live: true,
        Playback: false
    },
    channel_2: {
        Live: true,
        Playback: true
    }
}
```

## Features Highlights

✅ **Dynamic Category Tabs** - Tab untuk Config, Operation, Control dengan statistik permission
✅ **User Selection** - Dropdown untuk switch user dalam permission management
✅ **Channel Management** - Support untuk multiple channels dengan Live/Playback actions
✅ **Bulk Actions** - Select All / Uncheck All untuk setiap kategori
✅ **Real-time Stats** - Persentase permission yang diaktifkan per kategori dan channel
✅ **Error Handling** - Pesan error yang jelas jika gagal load atau save
✅ **Loading States** - Indikator loading saat fetch atau save data
✅ **Responsive Design** - Support untuk desktop dan mobile layouts

## Integrasi dengan Existing Code

Semua file telah terintegrasi dengan struktur existing:
- Menggunakan hook pattern yang sama seperti `useUserManagement`
- Mengikuti styling Tailwind yang konsisten
- Menggunakan icon dari `lucide-react`
- Kompatibel dengan error handling dan status messages existing

## Error Handling

Component menangani berbagai error scenarios:
- Gagal load ability list dari device
- Gagal load user info dari device  
- Gagal menyimpan permission ke device
- User tidak valid atau tidak dipilih
- Network timeout

Semua error ditampilkan dengan alert box yang jelas.

## Tips Implementasi

1. **Ensure API connectivity** - Pastikan device API responsive
2. **User permissions required** - Pastikan user yang modify punya admin access
3. **Test with sample data** - Test dengan device test sebelum production
4. **Monitor response format** - Device mungkin return format berbeda, adjust parser jika perlu
5. **Backup before deploy** - Existing permission data penting, backup dulu

## Troubleshooting

| Issue | Solusi |
|-------|--------|
| Permission list tidak muncul | Cek endpoint `/cgi-bin/userManager.cgi?action=getAbility` |
| Save tidak berhasil | Verify format authorities array di URL params |
| User info tidak load | Pastikan username tidak mengandung special characters |
| Dropdown user kosong | Pastikan selectedGroupUsers bukan empty array |

---

Implementasi siap digunakan! Silakan test dan laporkan jika ada issues.
