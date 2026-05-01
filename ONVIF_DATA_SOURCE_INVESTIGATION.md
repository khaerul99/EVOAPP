# 🔍 Investigasi: Perbedaan Data OnVif antara Master Dashboard dan Custom App

## **TL;DR - Kesimpulan Cepat**

Perbedaan terjadi karena **strategi sourcing groups yang berbeda**:

| Aspek | Master Dashboard | Custom App (Dev) |
|-------|-----------------|------------------|
| **Endpoint untuk user** | `getUserInfoAll` ✓ | `getAllUsers()` ✓ |
| **Endpoint untuk groups** | Tidak ada | `getGroupInfoAll` ✓ (recently added) |
| **Endpoint untuk OnVif** | Tidak ada | `getOnvifDevice()` ✓ (recently added) |
| **Group sourcing** | Inferred dari `user.group` | Prioritas endpoint, fallback ke user.group |
| **OnVif origin** | Hanya dari `user.group` field | Bisa dari 3 sumber berbeda |

---

## **Masalah Utama**

Aplikasi current memanggil **3 sumber data berbeda** untuk groups:
1. `getAllUsers()` → `user.group` field
2. `getAllGroups()` → endpoint `getGroupInfoAll`  
3. `getOnvifDevice()` → endpoint terpisah untuk OnVif

Ini dapat menyebabkan **inkonsistensi** jika ketiga sumber memberikan data yang berbeda!

---

## **Skenario: Mengapa OnVif Muncul/Tidak Muncul**

### **Skenario 1: OnVif dari user.group (Master behavior)**
```
getUserInfoAll response:
[
  { name: "admin", group: "admin", ... },
  { name: "user1", group: "OnVif", ... },
  { name: "user2", group: "admin", ... }
]

→ Groups yang ter-infer: ["admin", "OnVif"]
→ OnVif MUNCUL di tree
```

### **Skenario 2: OnVif di getGroupInfoAll tapi tidak ada user dengan group='OnVif'**
```
getUserInfoAll response:
[
  { name: "admin", group: "admin", ... },
  { name: "user1", group: "admin", ... }
]

getGroupInfoAll response:
[
  { groupName: "admin", ... },
  { groupName: "OnVif", ... }  ← Group kosong!
]

→ Groups dari endpoint: ["admin", "OnVif"]
→ OnVif MUNCUL di tree TAPI tanpa user!
→ INKONSISTENSI!
```

### **Skenario 3: OnVif di getOnvifDevice tapi tidak ada di kedua endpoint lain**
```
getOnvifDevice() returns:
{ available: true, devices: [...] }

Tapi getUserInfoAll dan getGroupInfoAll tidak punya OnVif group.

→ Dalam hook, ada logic khusus:
   onvifAvailable = groups.find(g => g.groupName === 'onvif')
   onvifUsers = users.filter(u => u.group === 'Onvif')

→ Bisa inconsistent!
```

---

## **Akar Penyebab di Code**

### Current Implementation (problematic):
```javascript
// useUserManagement.js
const loadAllUsers = useCallback(async () => {
    const [userResult, groupResult, onvifDeviceResult] = await Promise.allSettled([
        userService.getAllUsers(),        // ← Source 1
        userService.getAllGroups(),       // ← Source 2 (added recently)
        userService.getOnvifDevice(),     // ← Source 3 (added recently)
    ]);
    // ...
    const onvifGroupName = availableGroups.find(group => 
        normalizeSearch(group.groupName) === 'onvif'
    )?.groupName || 'Onvif';  // ← FALLBACK jika tidak ada

    const onvifUsersList = localUsers.filter(user => 
        normalizeSearch(user.group) === normalizeSearch(onvifGroupName)
    );
}, []);
```

**Masalah:**
- Jika `getGroupInfoAll` tidak mengembalikan OnVif group, maka fallback ke 'Onvif' string literal
- Tapi jika `user.group` punya nilai berbeda (e.g., 'onvif' lowercase vs 'OnVif' capitalized), matching akan gagal!
- Menghasilkan **mismatch antara groups dan users**

---

## **Master Branch Logic (konsisten)**

```javascript
// useUserManagement.js di master
const loadAllUsers = useCallback(async () => {
    const result = await userService.getAllUsers();  // ← HANYA satu source
    setUsers(Array.isArray(result?.users) ? result.users : []);
}, []);

const userGroups = useMemo(() => {
    const grouped = users.reduce((acc, user) => {
        const groupName = String(user.group || 'ungrouped').trim() || 'ungrouped';
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(user);
        return acc;
    }, {});
    return Object.entries(grouped).map(([groupName, users]) => ({ groupName, users }));
}, [users]);
```

**Keuntungan:**
- ✅ Hanya 1 source data (konsisten)
- ✅ Semua groups punya user (tidak ada group kosong)
- ✅ Group naming otomatis dari user.group field
- ✅ Tidak ada fallback/default logic yang rumit

---

## **Solusi: Kembali ke Master Pattern**

### **Option 1: Hapus getGroupInfoAll dan getOnvifDevice (RECOMMENDED)**
```javascript
// useUserManagement.js
const loadAllUsers = useCallback(async () => {
    const result = await userService.getAllUsers();  // Only one call
    setUsers(Array.isArray(result?.users) ? result.users : []);
}, []);

// userGroups logic sama seperti master - simple dan konsistent
```

**Kelebihan:**
- ✅ Sesuai master behavior
- ✅ Eliminasi data source conflicts
- ✅ Lebih performa (1 endpoint call vs 3)
- ✅ OnVif handling automatic dari user.group

---

### **Option 2: Tetap pakai getGroupInfoAll tapi HARUS sesuai dengan user.group**
Jika ada kebutuhan khusus untuk memisahkan group metadata (memo, permissions, dll), maka:

```javascript
// MANDATORY VALIDATION
const loadAllUsers = useCallback(async () => {
    const [userResult, groupResult] = await Promise.allSettled([
        userService.getAllUsers(),
        userService.getAllGroups(),
    ]);
    
    const users = userResult.value?.users || [];
    const groups = groupResult.value?.groups || [];
    
    // VALIDATE: All users' groups must exist in endpoint groups
    const userGroupNames = new Set(users.map(u => u.group?.toLowerCase()));
    const endpointGroupNames = new Set(groups.map(g => g.groupName?.toLowerCase()));
    
    const missingGroups = [...userGroupNames].filter(g => !endpointGroupNames.has(g));
    if (missingGroups.length > 0) {
        console.warn('⚠️ WARNING: Groups exist in users but not in endpoint:', missingGroups);
        // Could throw error or auto-merge them
    }
    
    const extraGroups = [...endpointGroupNames].filter(g => !userGroupNames.has(g));
    if (extraGroups.length > 0) {
        console.warn('⚠️ WARNING: Groups in endpoint but no users have them:', extraGroups);
    }
}, []);
```

---

## **Debugging Steps untuk User**

1. **Open DevTools Console** (F12)
2. **Run debugger:**
   ```javascript
   // Test masing-masing endpoint
   await endpointDebugger.testGetUserInfoAll();
   await endpointDebugger.testGetGroupInfoAll();
   
   // Compare hasil
   const result = await endpointDebugger.compareEndpoints();
   ```

3. **Lihat output:**
   - ✅ Groups dari getUserInfoAll users
   - ✅ Groups dari getGroupInfoAll endpoint
   - ⚠️ Perbedaan/missing groups
   - ⚠️ Khususnya cek: **Apakah OnVif ada di beide source atau hanya salah satu?**

---

## **Rekomendasi**

Berdasarkan gambar di attachment yang menunjukkan **Dahua master dashboard:**
- EVOSECURE (root)
  - ├─ admin (dengan admin, devuser)
  - ├─ Onvif (dengan admin, user, operator)
  - └─ Usergroup

**Dan custom app sekarang juga menunjukkan struktur serupa**, hal yang paling masuk akal adalah:

### **Skenario A: OnVif ada di getUserInfoAll (MOST LIKELY)**
```
Maka: GUNAKAN master pattern - hapus getGroupInfoAll
```

### **Skenario B: OnVif HANYA ada di getGroupInfoAll**
```
Maka: KEEP getGroupInfoAll tapi MUST validate consistency
      Jangan fallback ke default string literals
```

---

## **Next Steps**

1. **Run endpoint debugger** untuk lihat respons actual dari device Dahua
2. **Tentukan OnVif source:** dari user.group atau separate endpoint?
3. **Pilih strategy:**
   - Option 1 (recommended): Hapus getGroupInfoAll, pakai master pattern
   - Option 2: Validate dan maintain consistency jika keep getGroupInfoAll

4. **Test UI** untuk pastikan groups render konsisten

---

## **File yang Perlu di-Watch**

- `src/services/user/user.service.js` - getAllUsers(), getAllGroups(), getOnvifDevice()
- `src/hooks/user/useUserManagement.js` - loadAllUsers(), userGroups memo
- `src/pages/management/user/UserManagement.jsx` - tree rendering
- `src/lib/endpoint-debugger.js` - for testing (hapus sebelum production!)
