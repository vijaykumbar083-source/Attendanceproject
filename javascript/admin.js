// --- GLOBAL STATE & PERSISTENCE ---
let users = JSON.parse(localStorage.getItem('smart_users')) || [];
let attendanceLogs = JSON.parse(localStorage.getItem('smart_attendance_data')) || [];

/** 
 * DYNAMIC CONFIG 
 * Initialized with empty/generic values to be filled by live detection
 */
let config = JSON.parse(localStorage.getItem('smart_config')) || {
    adminName: "Admin User",
    adminEmail: "admin@institution.ac.in",
    institute: "Detecting Location...",
    lat: null,
    lng: null,
    gps: 100
};

let currentStream = null;

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('attendance-date');
    if(dateInput) dateInput.valueAsDate = new Date();
    
    // Automatically try to detect where the Admin is currently managing from
    detectCurrentAdminLocation();
    
    applyConfig();
    refreshData();
});

// --- NEW: DYNAMIC LOCATION DETECTION ---
async function detectCurrentAdminLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Only update if not already set or if explicitly requested
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`
            );
            const data = await response.json();
            
            const detectedName = data.address.amenity || 
                                 data.address.university || 
                                 data.address.building || 
                                 data.display_name.split(',')[0];

            // Update UI element if it exists
            const displayLoc = document.getElementById('displayLocation');
            if(displayLoc) displayLoc.innerText = detectedName;
            
            // Optionally update config if you want it to auto-save the current campus
            // config.institute = detectedName; 
            
        } catch (error) {
            console.log("Reverse geocoding failed, using coordinates only.");
        }
    });
}

// --- CORE NAVIGATION ---
function showContent(id, element) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';
    
    document.querySelectorAll('#list li').forEach(l => l.classList.remove('active'));
    if(element) element.classList.add('active');

    if (id === 'Rcontent') renderAnalytics();
}

// --- UPDATED: REAL GPS TRACKER LOGIC ---
// --- ADMIN DASHBOARD: SYSTEM RULES LOGIC ---

async function captureAdminLocation() {
    const gpsStatus = document.getElementById('gpsStatus');
    const latInput = document.getElementById('setLat');
    const lngInput = document.getElementById('setLng');
    const instInput = document.getElementById('setInstitute');

    if (!navigator.geolocation) return alert("GPS not supported.");

    gpsStatus.innerText = "🛰️ Syncing with Satellites...";
    gpsStatus.style.color = "orange";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // Populate inputs
        latInput.value = latitude.toFixed(6);
        lngInput.value = longitude.toFixed(6);
        
        // Reverse Geocode to get the Building Name
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`);
            const data = await res.json();
            const name = data.address.amenity || data.address.university || data.address.building || "Custom Campus";
            
            instInput.value = name;
            gpsStatus.innerText = `✅ Locked: ${name} (Accuracy: ${Math.round(accuracy)}m)`;
            gpsStatus.style.color = "#008080";
        } catch (e) {
            gpsStatus.innerText = "✅ Coordinates Captured.";
        }
    }, (err) => {
        alert("Error: " + err.message);
    }, { enableHighAccuracy: true });
}

function saveSystemRules() {
    const newConfig = {
        institute: document.getElementById('setInstitute').value,
        lat: parseFloat(document.getElementById('setLat').value),
        lng: parseFloat(document.getElementById('setLng').value),
        gps: parseInt(document.getElementById('setGps').value) // The Tolerance (e.g., 150)
    };

    localStorage.setItem('smart_config', JSON.stringify(newConfig));
    alert("System Rules Updated. User dashboards will now sync to this location.");
}
// --- USER MANAGEMENT ---
function adduser() {
    const name = document.getElementById('newUserName').value.trim();
    const id = document.getElementById('newUserId').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPass').value.trim();

    if (!name || !id || !email || !password) {
        return alert("Please fill all fields.");
    }

    if (users.some(u => u.id === id)) {
        return alert("User ID already exists.");
    }

    const newUser = { 
        name, id, email, password,
        enrolledDate: new Date().toLocaleDateString(),
        faceActive: true 
    };

    users.push(newUser);
    saveData('smart_users', users);
    
    alert(`Success: ${name} is now registered.`);
    document.getElementById('addUserForm').reset();
    stopCamera();
    document.getElementById('reg-video-container').style.display = 'none';
    refreshData();
}

function removeUser(index) {
    if (confirm("Permanently delete this user?")) {
        users.splice(index, 1);
        saveData('smart_users', users);
        refreshData();
        renderAnalytics();
    }
}

// --- DYNAMIC RENDERING ---
function refreshData() {
    const userTable = document.getElementById('allUsersTableBody');
    if (userTable) {
        const countEl = document.getElementById('userCount');
        if(countEl) countEl.innerText = users.length;
        
        userTable.innerHTML = users.length ? users.map((u, i) => `
            <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><b>${u.id}</b></td>
                <td style="color: #008080; font-weight: 600;">✔ Active</td>
                <td>
                    <button class="btn-outline" style="border-color:#e74c3c; color:#e74c3c; cursor:pointer;" onclick="removeUser(${i})">
                        <i class='bx bx-trash'></i> Delete
                    </button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="5" style="text-align:center; padding:20px;">No users found.</td></tr>';
    }

    const today = new Date().toISOString().split('T')[0];
    const todayLogs = attendanceLogs.filter(l => l.date === today);
    const quickBody = document.getElementById('quickAttendanceBody');
    
    if (quickBody) {
        quickBody.innerHTML = todayLogs.length ? todayLogs.map(l => `
            <tr>
                <td>${l.name}</td>
                <td><b style="color:#008080">${l.checkIn || '--'}</b></td>
                <td><b style="color:orange">${l.checkOut || 'Active'}</b></td>
                <td><span style="background:#e8f5e9; color:#2e7d32; padding:4px 8px; border-radius:4px;">${l.checkOut ? 'Completed' : 'On-Site'}</span></td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center; padding:20px;">No logs for today.</td></tr>';
    }

    filterLogs();
}

function filterLogs() {
    const dateInput = document.getElementById('attendance-date');
    if(!dateInput) return;
    const filtered = attendanceLogs.filter(l => l.date === dateInput.value);
    const body = document.getElementById('fullLogTableBody');

    if (body) {
        body.innerHTML = filtered.length ? filtered.map(l => `
            <tr>
                <td>${l.date}</td>
                <td>${l.id}</td>
                <td>${l.name}</td>
                <td>${l.checkIn || '--'}</td>
                <td>${l.checkOut || 'Active'}</td>
            </tr>
        `).join('') : '<tr><td colspan="5" style="text-align:center; padding:20px;">No records found.</td></tr>';
    }
}

// --- ANALYTICS ---
function renderAnalytics() {
    const total = users.length;
    const analyticsPercentage = document.getElementById('attendancePercentage');
    if (!analyticsPercentage || total === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const loggedInToday = attendanceLogs.filter(l => l.date === today);
    const presentCount = new Set(loggedInToday.map(l => l.id)).size;
    
    const rate = Math.round((presentCount / total) * 100);
    analyticsPercentage.innerText = rate + "%";
    
    const bar = document.getElementById('reportProgressBar');
    if(bar) bar.style.width = rate + "%";

    const loggedIds = loggedInToday.map(l => l.id);
    const missing = users.filter(u => !loggedIds.includes(u.id));
    
    const absentList = document.getElementById('absentList');
    if(absentList) {
        absentList.innerHTML = missing.map(u => `
            <li style="padding: 10px 0; border-bottom: 1px solid #eee; color: #e74c3c; display: flex; justify-content: space-between;">
                <span><b>ID-${u.id}:</b> ${u.name}</span>
                <span style="font-size: 0.8em; background: #ffdada; padding: 2px 6px; border-radius: 4px;">ABSENT</span>
            </li>
        `).join('') || '<li style="color: #008080; padding: 10px 0;">✨ Everyone is present!</li>';
    }
}

// --- SETTINGS & CONFIG ---
function saveProfile() {
    const name = document.getElementById('setAdminName').value.trim();
    const email = document.getElementById('setAdminEmail').value.trim();

    if(name && email) {
        config.adminName = name;
        config.adminEmail = email;
        saveData('smart_config', config);
        alert("Admin Profile Updated.");
    }
}

function saveSystemRules() {
    config.institute = document.getElementById('setInstitute').value;
    config.lat = parseFloat(document.getElementById('setLat').value);
    config.lng = parseFloat(document.getElementById('setLng').value);
    config.gps = parseInt(document.getElementById('setGps').value);
    
    saveData('smart_config', config);
    document.getElementById('displayLocation').innerText = config.institute;
    alert("System Rules Saved.");
}

function applyConfig() {
    const elements = {
        'displayLocation': config.institute,
        'setAdminName': config.adminName,
        'setAdminEmail': config.adminEmail,
        'setInstitute': config.institute,
        'setLat': config.lat || "",
        'setLng': config.lng || "",
        'setGps': config.gps
    };

    for (let id in elements) {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT') el.value = elements[id];
            else el.innerText = elements[id];
        }
    }
}

// --- UTILITIES ---
function saveData(key, val) { 
    localStorage.setItem(key, JSON.stringify(val)); 
}

function generatePass() {
    const pass = Math.random().toString(36).slice(-8).toUpperCase();
    const passInput = document.getElementById("newUserPass");
    if(passInput) passInput.value = pass;
}

async function openRegistrationCam() {
    const video = document.getElementById('reg-webcam');
    const container = document.getElementById('reg-video-container');
    if(container) container.style.display = 'block';
    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if(video) video.srcObject = currentStream;
    } catch (err) { 
        alert("Camera access denied."); 
    }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

function searchUsers() {
    const term = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#allUsersTableBody tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
    });
}

function exportCSV() {
    if(!attendanceLogs.length) return alert("No logs available.");
    let csv = "Date,ID,Name,CheckIn,CheckOut\n";
    attendanceLogs.forEach(l => {
        csv += `${l.date},${l.id},${l.name},${l.checkIn},${l.checkOut || 'N/A'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Report.csv`;
    a.click();
}

function logout() {
    if (confirm("Logout from Admin Panel?")) window.location.href = "index.html";
}