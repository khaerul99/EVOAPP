/**
 * Endpoint Debugger - untuk testing respons endpoint
 * HANYA untuk development - hapus sebelum production
 */

import ApiClient from './api';

export const endpointDebugger = {
    /**
     * Test getUserInfoAll endpoint
     * Lihat apa saja yang dikembalikan untuk memahami struktur user dan group
     */
    async testGetUserInfoAll() {
        try {
            console.group('🔍 Testing: getUserInfoAll');
            const response = await ApiClient.get('/cgi-bin/userManager.cgi?action=getUserInfoAll');
            console.log('Raw Response:', response);
            console.log('Parsed Users:', response?.users);
            
            // Analisis group yang ada
            if (Array.isArray(response?.users)) {
                const groupsFromUsers = [...new Set(
                    response.users.map(u => u.group || u.Group || u.GroupName || '(no group)')
                )];
                console.log('📊 Groups found in users:', groupsFromUsers);
                
                // Detail setiap user
                console.log('📋 User Details:');
                response.users.forEach((user, idx) => {
                    console.log(`  [${idx}] Name: ${user.name || user.Name}, Group: ${user.group || user.Group || user.GroupName || '-'}`);
                });
            }
            console.groupEnd();
            return response;
        } catch (err) {
            console.error('❌ Error getting getUserInfoAll:', err);
            console.groupEnd();
            throw err;
        }
    },

    /**
     * Test getGroupInfoAll endpoint
     * Lihat apa groups yang dikembalikan oleh endpoint terpisah
     */
    async testGetGroupInfoAll() {
        try {
            console.group('🔍 Testing: getGroupInfoAll');
            const response = await ApiClient.get('/cgi-bin/userManager.cgi?action=getGroupInfoAll');
            console.log('Raw Response:', response);
            console.log('Parsed Groups:', response?.groups);
            
            if (Array.isArray(response?.groups)) {
                console.log('📊 Groups returned by endpoint:', response.groups.map(g => g.groupName || g.name));
            }
            console.groupEnd();
            return response;
        } catch (err) {
            console.error('❌ Error getting getGroupInfoAll:', err);
            console.groupEnd();
            throw err;
        }
    },

    /**
     * Compare respons dua endpoint
     */
    async compareEndpoints() {
        try {
            console.group('🔄 Comparing Endpoints');
            const userResponse = await this.testGetUserInfoAll();
            const groupResponse = await this.testGetGroupInfoAll();
            
            const groupsFromUsers = new Set(
                (userResponse?.users || []).map(u => u.group || u.Group || u.GroupName || '(no group)')
            );
            const groupsFromEndpoint = new Set(
                (groupResponse?.groups || []).map(g => g.groupName || g.name || g.GroupName)
            );
            
            console.log('\n📊 COMPARISON RESULT:');
            console.log('Groups from getUserInfoAll users:', Array.from(groupsFromUsers));
            console.log('Groups from getGroupInfoAll endpoint:', Array.from(groupsFromEndpoint));
            
            // Cari perbedaan
            const missingInUsers = Array.from(groupsFromEndpoint).filter(g => !groupsFromUsers.has(g));
            const missingInEndpoint = Array.from(groupsFromUsers).filter(g => !groupsFromEndpoint.has(g));
            
            if (missingInUsers.length > 0) {
                console.warn('⚠️  Groups ada di getGroupInfoAll tapi TIDAK di users:', missingInUsers);
            }
            if (missingInEndpoint.length > 0) {
                console.warn('⚠️  Groups ada di users tapi TIDAK di getGroupInfoAll:', missingInEndpoint);
            }
            if (missingInUsers.length === 0 && missingInEndpoint.length === 0) {
                console.log('✅ SAME: Semua groups consistent!');
            }
            
            console.groupEnd();
            return { userResponse, groupResponse, missingInUsers, missingInEndpoint };
        } catch (err) {
            console.error('❌ Comparison error:', err);
            console.groupEnd();
            throw err;
        }
    },
};

// Export untuk testing di DevTools console
if (typeof window !== 'undefined') {
    window.endpointDebugger = endpointDebugger;
}
