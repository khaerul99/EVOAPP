# Permission Management API Documentation

## Overview
This document describes the API endpoints used for permission management in the User Management module.

## Base Endpoint
All endpoints use the base path: `/cgi-bin/userManager.cgi`

## Endpoints

### 1. Get Abilities (Available Permissions)
**Purpose**: Retrieve available permissions and channels from the device

**Method**: GET  
**Parameters**: 
```
action=getAbility
```

**URL Example**:
```
/cgi-bin/userManager.cgi?action=getAbility
```

**Response Format** (text/plain with key=value pairs):
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

**Response Parsing**:
- Lines are split by `\n` or `\r\n`
- Each line contains `key=value` pair
- Keys ending with number (e.g., `Channel1`) represent camera channels
- Other keys represent permission categories

---

### 2. Get User Information
**Purpose**: Retrieve current permissions for a specific user

**Method**: GET  
**Parameters**:
```
action=getUserInfoForName
name={userName}
```

**URL Example**:
```
/cgi-bin/userManager.cgi?action=getUserInfoForName&name=admin
```

**Response Format** (text/plain):
```
UserName=admin
GroupName=administrators
authorities=System,Event,Account,Storage,Network,Security,Camera,Peripheral,PTZ,Backup,Maintenance,Device Maintenance,Tasks,Manual Control,LiveChannel1,PlaybackChannel1,LiveChannel2,PlaybackChannel2,LiveChannel3,PlaybackChannel3,LiveChannel4,PlaybackChannel4
```

**Response Parsing**:
- Parse as key=value pairs separated by newlines
- `authorities` value is comma-separated list of permissions
- Channel permissions follow pattern: `{Action}Channel{N}` (e.g., `LiveChannel1`, `PlaybackChannel1`)

---

### 3. Get Group Information
**Purpose**: Retrieve permissions for a group

**Method**: GET  
**Parameters**:
```
action=getGroupInfoForName
name={groupName}
```

**URL Example**:
```
/cgi-bin/userManager.cgi?action=getGroupInfoForName&name=administrators
```

**Response Format**: Same as getUserInfoForName

---

### 4. Modify User Permissions
**Purpose**: Update permissions for a specific user

**Method**: GET  
**Parameters**:
```
action=modifyUser
name={userName}
authorities[0]={permission1}
authorities[1]={permission2}
...
authorities[n]={permissionN}
```

**URL Example**:
```
/cgi-bin/userManager.cgi?action=modifyUser&name=admin&authorities%5B0%5D=System&authorities%5B1%5D=Event&authorities%5B2%5D=Account
```

**Note**: URL encoding converts `[` to `%5B` and `]` to `%5D`

**Response Format**:
```
Success
or
OK
or error message
```

**Response Parsing**:
- Success response contains "success" or "ok" (case-insensitive)
- Any other response indicates failure

---

## Permission Categories

### Config Permissions (Read/Write)
- System
- Event
- Account
- Storage
- Network
- Security
- Camera
- Peripheral
- PTZ

### Operation Permissions (Read/Write)
- Backup
- Maintenance
- Device Maintenance
- Tasks

### Control Permissions (Read/Write)
- Manual Control

### Channel Permissions
- Pattern: `{Action}Channel{N}`
- Actions: `Live`, `Playback`
- Example: `LiveChannel1`, `PlaybackChannel2`

---

## Error Handling

### Common Error Responses

**501 Not Implemented**
- Cause: API endpoint not available on device
- Solution: Verify device firmware has userManager API support
- Check: Confirm action parameter is correct (getAbility, getUserInfoForName, modifyUser)

**Invalid Response Format**
- Cause: Device returns unexpected format
- Solution: Check response in browser DevTools Network tab
- Expected: Plain text with `key=value` format

**User Not Found**
- Cause: Specified username doesn't exist
- Solution: Verify username exists and is spelled correctly

---

## Implementation Notes

### Axios Integration
All requests use axios with params format:
```javascript
ApiClient.get('/cgi-bin/userManager.cgi', {
    params: {
        action: 'getAbility',
        // additional parameters...
    }
})
```

This ensures:
- Proper URL encoding of parameters
- Compatibility with API interceptors
- Consistent error handling

### Response Parsing
Responses are plain text with `key=value` format:
1. Split by newline: `.split(/\r?\n/)`
2. Filter empty lines: `.filter(line => line.trim())`
3. Split by equals: `line.split('=')`
4. Trim values: `key.trim()` and `value.trim()`

### Permission State Structure
```javascript
{
    config: {
        System: true/false,
        Event: true/false,
        // ...
    },
    operation: {
        Backup: true/false,
        // ...
    },
    control: {
        'Manual Control': true/false
    },
    channel_1: {
        Live: true/false,
        Playback: true/false
    },
    channel_2: { /* ... */ }
}
```

---

## Debugging Tips

1. **Enable Console Logging**
   - Check browser DevTools Console for detailed error messages
   - Look for `Failed to get abilities`, `Failed to load permission data` messages

2. **Network Tab Analysis**
   - Open DevTools > Network
   - Check actual request URL and parameters
   - Verify response status (200 OK vs 501 Not Implemented)
   - Inspect response body for actual API error message

3. **Common Issues**
   - Wrong action name → Check endpoint list above
   - Malformed authorities array → Verify `authorities[0]`, `authorities[1]` format
   - Invalid user/group name → Confirm spelling and existence

4. **Testing Individual Endpoints**
   - Use Postman or curl to test endpoints directly
   - Example: `curl "http://device-ip/cgi-bin/userManager.cgi?action=getAbility"`
   - Verify response format matches documentation
