# Permission Management - Quick Reference

## Running the Application

### Development Mode
```bash
npm run dev
```
- Application runs on `http://localhost:5173`
- Auto-reloads on file changes

### Production Build
```bash
npm run build
```
- Creates optimized build in `dist/` folder

---

## Accessing Permission Management

1. **Navigate to User Management**
   - From dashboard, go to Management → User Management
   - Or access URL: `/management/user`

2. **Open Permission Tab**
   - Click the "Permission" tab (next to "Attribute" tab)
   - You'll see a dropdown to select user

3. **Select User**
   - Dropdown shows all users in your group
   - Select the user to manage permissions

4. **View/Edit Permissions**
   - UI displays 4 columns:
     - **Config**: System, Event, Account, Storage, Network, Security, Camera, Peripheral, PTZ
     - **Operation**: Backup, Maintenance, Device Maintenance, Tasks
     - **Control**: Manual Control
     - **Channel**: Live/Playback access for each camera channel

5. **Save Changes**
   - After checking/unchecking permissions
   - Click "Save Changes" button
   - Wait for confirmation message

---

## API Endpoints Used

All endpoints use: `/cgi-bin/userManager.cgi`

| Action | Purpose | Result |
|--------|---------|--------|
| `getAbility` | Get available permissions & channels | Object with permissions and channel names |
| `getUserInfoForName` | Get user's current permissions | User info with authorities list |
| `getGroupInfoForName` | Get group's permissions | Group info with authorities list |
| `modifyUser` | Update user permissions | Success/OK or error message |

**Documentation**: See `src/services/user/PERMISSION_API.md`

---

## Debugging via Network Tab

### Check Last Network Request
In DevTools Network tab:
1. Open Permission Management
2. Look for requests to `/cgi-bin/userManager.cgi`
3. Click request to see:
   - Full URL with parameters
   - Response status (200, 401, 501, etc.)
   - Response body (what device returned)

---

## Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Endpoint tidak tersedia di perangkat" | API returns 501 Not Implemented | Device firmware may not have userManager API |
| "Gagal memuat data permission dari perangkat" | getAbility or getUserInfo failed | Check device connectivity, verify API endpoints |
| "Gagal menyimpan permission" | modifyUser failed | Check if user/permissions are valid |
| "Username tidak tersedia" | No user selected | Select a user from dropdown first |

---

## File Structure

### Permission Management Files
```
src/
├── services/user/
│   ├── permission.service.js          # API communication layer
│   └── PERMISSION_API.md              # API documentation
├── hooks/user/
│   └── usePermissionManagement.js     # React state management
├── components/user/
│   └── PermissionManagement.jsx       # UI component
└── pages/management/user/
    └── UserManagement.jsx             # Main page (has Permission tab)
```

### Documentation Files
```
PERMISSION_MANAGEMENT_QUICK_REF.md     # This file
```

---

## API Response Examples

### getAbility Response
```
System=Read,Write
Event=Read,Write
Account=Read,Write
Storage=Read,Write
Network=Read,Write
Security=Read,Write
Camera=Read,Write
Peripheral=Read,Write
PTZ=Read,Write
Backup=Read,Write
Maintenance=Read,Write
Device Maintenance=Read,Write
Tasks=Read,Write
Manual Control=Read,Write
Channel1=Parking Area
Channel2=Lobby Area
Channel3=Entrance
Channel4=Exit
```

### getUserInfoForName Response
```
UserName=admin
GroupName=administrators
authorities=System,Event,Account,Storage,Network,Security,Camera,Peripheral,PTZ,Backup,Maintenance,Device Maintenance,Tasks,Manual Control,LiveChannel1,PlaybackChannel1,LiveChannel2,PlaybackChannel2
```

### modifyUser Request Format
```
/cgi-bin/userManager.cgi?
  action=modifyUser&
  name=admin&
  authorities[0]=System&
  authorities[1]=Event&
  authorities[2]=LiveChannel1&
  authorities[3]=PlaybackChannel1
```

### modifyUser Response
- Success: `Success` or `OK`
- Error: Error message or status code

---

## Implementation Details

### State Management (usePermissionManagement hook)
- **abilities**: Available permissions from device
- **userPermissions**: Current user's permissions
- **permissionState**: Nested object tracking toggle states
- **channels**: List of camera channels
- **loading/error**: Status messages

### Permission State Structure
```javascript
{
  config: {
    System: true,
    Event: false,
    // ...
  },
  operation: {
    Backup: true,
    // ...
  },
  control: {
    'Manual Control': false
  },
  channel_1: {
    Live: true,
    Playback: false
  },
  channel_2: { /* ... */ }
}
```

### Building Authorities Array
When saving:
1. Iterate through permissionState
2. Collect enabled permissions
3. Include channel permissions (e.g., "LiveChannel1")
4. Send as array: `authorities[0]`, `authorities[1]`, etc.

---

## Testing Workflow

1. **Check getAbility**
   ```javascript
   await PermissionTestUtility.testGetAbility()
   ```
   - Verify you see permission categories
   - Verify channels are detected

2. **Check getUserInfo**
   ```javascript
   await PermissionTestUtility.testGetUserInfo('admin')
   ```
   - Verify user exists
   - Check current authorities list

3. **Test modifyUser**
   ```javascript
   await PermissionTestUtility.testModifyUserPermissions('admin', ['System', 'Event'])
   ```
   - Verify response is "Success" or "OK"

4. **Verify in UI**
   - Reload permission management
   - Select user
   - Verify permissions are as expected

---

## Performance Notes

- Permission data is loaded once per user selection
- UI uses React hooks for efficient state management
- Channel list updates only when abilities change
- Statistics (percentages) computed on render

---

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires JavaScript enabled and console access for testing.

---

## Next Steps if Issues Occur

1. Read [PERMISSION_TESTING_GUIDE.md](./PERMISSION_TESTING_GUIDE.md)
2. Run testing utility in console
3. Check Network tab in DevTools
4. Compare responses with API documentation
5. Verify device firmware version
6. Check device API logs if available
