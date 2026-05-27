
let users = JSON.parse(localStorage.getItem('smart_users')) || [];
let attendanceLogs = JSON.parse(localStorage.getItem('smart_attendance_data')) || [];


let config = JSON.parse(localStorage.getItem('smart_config')) || {
    adminName: "Admin User",
    adminEmail: "admin@institution.ac.in",
    institute: "Detecting Location...",
    lat: null,
    lng: null,
    gps: 100
};

let currentStream = null;


document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('attendance-date');
    if (dateInput) dateInput.valueAsDate = new Date();
    
    
    detectCurrentAdminLocation();
    
    applyConfig();
    refreshData();
});


async function detectCurrentAdminLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`
            );
            const data = await response.json();
            
            
            const detectedName = data.address.amenity || 
                                 data.address.university || 
                                 data.address.building || 
                                 data.address.office ||
                                 data.address.point_of_interest ||
                                 (data.address.road && data.address.suburb ? `${data.address.road}, ${data.address.suburb}` : null) ||
                                 data.address.suburb ||
                                 data.address.city ||
                                 data.display_name.split(',')[0];

            
            const displayLoc = document.getElementById('displayLocation');
            if (displayLoc) displayLoc.innerText = detectedName;
            
        } catch (error) {
            console.error("Reverse geocoding failed on load, using coordinates only.", error);
        }
    });
}


function showContent(id, element) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById(id);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('#list li').forEach(l => l.classList.remove('active'));
    if (element) element.classList.add('active');

    if (id === 'Rcontent' || id === 'Dcontent') renderAnalytics();
}


async function captureAdminLocation() {
    const gpsStatus = document.getElementById('gpsStatus');
    const latInput = document.getElementById('setLat');
    const lngInput = document.getElementById('setLng');
    const instInput = document.getElementById('setInstitute');

    if (!navigator.geolocation) return alert("GPS not supported by this browser.");

    if (gpsStatus) {
        gpsStatus.innerText = "🛰️ Syncing with Satellites...";
        gpsStatus.style.color = "orange";
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        
        if (latInput) latInput.value = latitude.toFixed(6);
        if (lngInput) lngInput.value = longitude.toFixed(6);
        
        try {
            
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`);
            const data = await res.json();
            
            
            let realLocationName = "";
            if (data && data.address) {
                realLocationName = data.address.amenity || 
                                   data.address.university || 
                                   data.address.building || 
                                   data.address.office ||
                                   data.address.point_of_interest ||
                                   (data.address.road && data.address.suburb ? `${data.address.road}, ${data.address.suburb}` : null) ||
                                   data.address.suburb || 
                                   data.address.city ||
                                   data.display_name.split(',')[0];
            } else {
                realLocationName = `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            }
            
            if (instInput) instInput.value = realLocationName;
            if (gpsStatus) {
                gpsStatus.innerText = `✅ Locked: ${realLocationName} (Accuracy: ${Math.round(accuracy)}m)`;
                gpsStatus.style.color = "#008080";
            }
        } catch (e) {
            console.error("Reverse geocoding error during dynamic capture:", e);
            if (gpsStatus) gpsStatus.innerText = "✅ Coordinates Captured (Address lookup timed out).";
        }
    }, (err) => {
        alert("Dynamic GPS Error: " + err.message);
        if (gpsStatus) {
            gpsStatus.innerText = "❌ GPS Lock Failed";
            gpsStatus.style.color = "red";
        }
    }, { enableHighAccuracy: true, timeout: 10000 });
}


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
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) addUserForm.reset();
    
    stopCamera();
    const videoContainer = document.getElementById('reg-video-container');
    if (videoContainer) videoContainer.style.display = 'none';
    
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


function refreshData() {
    const userTable = document.getElementById('allUsersTableBody');
    if (userTable) {
        const countEl = document.getElementById('userCount');
        if (countEl) countEl.innerText = users.length;
        
        
        const uniqueDaysInLogs = [...new Set(attendanceLogs.map(l => l.date))];
        const totalDaysTracked = uniqueDaysInLogs.length || 1; 

        userTable.innerHTML = users.length ? users.map((u, i) => {
            
        
            const userLoggedDays = [...new Set(
                attendanceLogs.filter(log => log.id === u.id).map(log => log.date)
            )];
            const attendedDaysCount = userLoggedDays.length;

            
            const finalPercentage = Math.min(Math.round((attendedDaysCount / totalDaysTracked) * 100), 100);

            
            let badgeStyle = "background: #e8f5e9; color: #2e7d32;"; 
            if (finalPercentage < 75) badgeStyle = "background: #fff3e0; color: #e65100;"; 
            if (finalPercentage < 50) badgeStyle = "background: #ffdada; color: #e74c3c;"; 

            return `
                <tr>
                    <td>${u.name}</td>
                    <td>${u.email}</td>
                    <td><b>${u.id}</b></td>
                    <td style="color: #008080; font-weight: 600;">✔ Active</td>
                    <td><b>${attendedDaysCount} / ${totalDaysTracked} Days</b></td>
                    <td>
                        <span style="${badgeStyle} padding: 4px 10px; border-radius: 4px; font-weight: bold; display: inline-block;">
                            ${finalPercentage}%
                        </span>
                    </td>
                    <td>
                        <button class="btn-outline" style="border-color:#e74c3c; color:#e74c3c; cursor:pointer;" onclick="removeUser(${i})">
                            <i class='bx bx-trash'></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('') : '<tr><td colspan="7" style="text-align:center; padding:20px;">No users found.</td></tr>';
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
    if (!dateInput) return;
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


function renderAnalytics() {
    const total = users.length;
    const analyticsPercentage = document.getElementById('attendancePercentage');
    if (!analyticsPercentage) return;
    
    if (total === 0) {
        analyticsPercentage.innerText = "0%";
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const loggedInToday = attendanceLogs.filter(l => l.date === today);
    const presentCount = new Set(loggedInToday.map(l => l.id)).size;
    
    
    const rate = Math.min(Math.round((presentCount / total) * 100), 100);
    analyticsPercentage.innerText = rate + "%";
    
    const bar = document.getElementById('reportProgressBar');
    if (bar) bar.style.width = rate + "%";

    const loggedIds = loggedInToday.map(l => l.id);
    const missing = users.filter(u => !loggedIds.includes(u.id));
    
    const absentList = document.getElementById('absentList');
    if (absentList) {
        absentList.innerHTML = missing.map(u => `
            <li style="padding: 10px 0; border-bottom: 1px solid #eee; color: #e74c3c; display: flex; justify-content: space-between;">
                <span><b>ID-${u.id}:</b> ${u.name}</span>
                <span style="font-size: 0.8em; background: #ffdada; padding: 2px 6px; border-radius: 4px;">ABSENT</span>
            </li>
        `).join('') || '<li style="color: #008080; padding: 10px 0;">✨ Everyone is present!</li>';
    }
}

function saveProfile() {
    const name = document.getElementById('setAdminName').value.trim();
    const email = document.getElementById('setAdminEmail').value.trim();

    if (name && email) {
        config.adminName = name;
        config.adminEmail = email;
        saveData('smart_config', config);
        alert("Admin Profile Updated.");
    }
}


function saveSystemRules() {
    const instInput = document.getElementById('setInstitute');
    const latInput = document.getElementById('setLat');
    const lngInput = document.getElementById('setLng');
    const gpsInput = document.getElementById('setGps');

    config.institute = instInput ? instInput.value : config.institute;
    config.lat = latInput ? parseFloat(latInput.value) : config.lat;
    config.lng = lngInput ? parseFloat(lngInput.value) : config.lng;
    config.gps = gpsInput ? parseInt(gpsInput.value) : config.gps;
    
    saveData('smart_config', config);
    
    const displayLocation = document.getElementById('displayLocation');
    if (displayLocation) displayLocation.innerText = config.institute;
    
    alert("System Rules Saved. User dashboards will now sync to this location.");
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

function saveData(key, val) { 
    localStorage.setItem(key, JSON.stringify(val)); 
}

function generatePass() {
    const pass = Math.random().toString(36).slice(-8).toUpperCase();
    const passInput = document.getElementById("newUserPass");
    if (passInput) passInput.value = pass;
}

async function openRegistrationCam() {
    const video = document.getElementById('reg-webcam');
    const container = document.getElementById('reg-video-container');
    if (container) container.style.display = 'block';
    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (video) video.srcObject = currentStream;
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
    if (!attendanceLogs.length) return alert("No logs available.");
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
    if (confirm("Logout from Admin Panel?")) window.location.href = "../index.html";
}




function Reset() {
    
    const confirmReset = confirm("CRITICAL WARNING: This will completely delete all registered users, attendance history, and dashboard statistics. Only admin accounts will be saved. Do you want to proceed?");
    
    if (!confirmReset) {
        return;
    }

  
    const preservedAdmins = localStorage.getItem('facemark_admins');
    const adminSessionToken = localStorage.getItem('adminSession');

    
    localStorage.clear();

   
    if (preservedAdmins) {
        localStorage.setItem('facemark_admins', preservedAdmins);
    }
    if (adminSessionToken) {
        localStorage.setItem('adminSession', adminSessionToken);
    }

   
    localStorage.setItem('todays_presence_percent', '0%');


    alert("System hard reset complete. All users and logs removed. Admins preserved.");
    window.location.reload();
}