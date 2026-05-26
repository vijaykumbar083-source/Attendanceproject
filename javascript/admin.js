// --- GLOBAL STATE & PERSISTENCE ---
let users = JSON.parse(localStorage.getItem('smart_users')) || [];
let attendanceLogs = JSON.parse(localStorage.getItem('smart_attendance_data')) || [];

/** * DYNAMIC CONFIG 
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
let modelsLoaded = false;
let currentFaceDescriptor = null; // Holds the scanned face array signature

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('attendance-date');
    if (dateInput) dateInput.valueAsDate = new Date();
    
    // Automatically try to detect where the Admin is currently managing from
    detectCurrentAdminLocation();
    
    applyConfig();
    refreshData();
});

// --- DYNAMIC LOCATION DETECTION (On Load) ---
async function detectCurrentAdminLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`
            );
            const data = await response.json();
            
            // Comprehensive fallback parsing chain for real location names
            const detectedName = data.address.amenity || 
                                 data.address.university || 
                                 data.address.building || 
                                 data.address.office ||
                                 data.address.point_of_interest ||
                                 (data.address.road && data.address.suburb ? `${data.address.road}, ${data.address.suburb}` : null) ||
                                 data.address.suburb ||
                                 data.address.city ||
                                 data.display_name.split(',')[0];

            // Update UI element if it exists
            const displayLoc = document.getElementById('displayLocation');
            if (displayLoc) displayLoc.innerText = detectedName;
            
        } catch (error) {
            console.error("Reverse geocoding failed on load, using coordinates only.", error);
        }
    });
}

// --- CORE NAVIGATION ---
function showContent(id, element) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById(id);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('#list li').forEach(l => l.classList.remove('active'));
    if (element) element.classList.add('active');

    if (id === 'Rcontent') renderAnalytics();
}

// --- REAL GPS TRACKER LOGIC ---
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

        // Populate dynamic coordinate inputs
        if (latInput) latInput.value = latitude.toFixed(6);
        if (lngInput) lngInput.value = longitude.toFixed(6);
        
        try {
            // Reverse Geocode using OpenStreetMap Nominatim
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`);
            const data = await res.json();
            
            // Progressive lookup chain ensuring real location names are assigned
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

    // Explicit Verification Guard ensuring face scan was run before final record submission
    if (!currentFaceDescriptor) {
        return alert("Error: Please capture and scan facial vector dataset mapping before final registration.");
    }

    const newUser = { 
        name, id, email, password,
        enrolledDate: new Date().toLocaleDateString(),
        faceActive: true,
        // Convert array to numeric structure format string to store safely inside LocalStorage database
        faceDescriptor: Array.from(currentFaceDescriptor)
    };

    users.push(newUser);
    saveData('smart_users', users);
    
    alert(`Success: ${name} is now registered.`);
    
    // Clear registration cache
    currentFaceDescriptor = null;
    
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

// --- DYNAMIC RENDERING ---
function refreshData() {
    const userTable = document.getElementById('allUsersTableBody');
    if (userTable) {
        const countEl = document.getElementById('userCount');
        if (countEl) countEl.innerText = users.length;
        
        userTable.innerHTML = users.length ? users.map((u, i) => `
            <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><b>${u.id}</b></td>
                <td style="color: #008080; font-weight: 600;">${u.faceDescriptor ? '✔ Enrolled' : '❌ Missing'}</td>
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

// --- ANALYTICS ---
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
    
    const rate = Math.round((presentCount / total) * 100);
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

// --- SETTINGS & CONFIG ---
function saveProfile() {
    const name = document.getElementById('setAdminName').value.trim();
    const email = document.getElementById('setAdminEmail').value.trim();

    if (!name || !email) {
        return alert("Please fill out both Name and Email fields.");
    }

    config.adminName = name;
    config.adminEmail = email;
    
    saveData('smart_config', config);
    
    // Refresh visual layers immediately across application
    applyConfig();
    
    alert("Admin Profile Updated.");
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

// --- UTILITIES ---
function saveData(key, val) { 
    localStorage.setItem(key, JSON.stringify(val)); 
}

// Generates an alphanumeric temporary entry credential
function generatePass() {
    const pass = Math.random().toString(36).slice(-8).toUpperCase();
    const passInput = document.getElementById("newUserPass");
    if (passInput) passInput.value = pass;
}

// --- CORE AI COGNITIVE COMPUTATION MODULES ---
async function loadFaceApiModels() {
    if (modelsLoaded) return true;
    const statusText = document.querySelector('#reg-video-container p');
    if (statusText) statusText.innerText = "⏳ Loading Biometric AI Models...";
    
    try {
        // Points to CDN model binary configuration streams
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        modelsLoaded = true;
        if (statusText) statusText.innerText = "✨ AI Framework Operational.";
        return true;
    } catch (err) {
        console.error("Model engine crash: ", err);
        if (statusText) statusText.innerText = "❌ Engine Error loading weights.";
        return false;
    }
}

async function openRegistrationCam() {
    const video = document.getElementById('reg-webcam');
    const container = document.getElementById('reg-video-container');
    const statusText = container.querySelector('p');
    
    if (container) container.style.display = 'block';
    
    // Trigger lazy model engine load sequence
    const modelsReady = await loadFaceApiModels();
    if (!modelsReady) return;

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 240, frameRate: { ideal: 15 } } 
        });
        if (video) {
            video.srcObject = currentStream;
            // Fire frame-capture validation watch loops once video begins drawing
            video.addEventListener('play', () => {
                analyzeRegistrationFrame(video, statusText);
            });
        }
    } catch (err) { 
        alert("Camera access denied."); 
    }
}

// Tracking Loop for Scanning Faces
async function analyzeRegistrationFrame(video, statusLabel) {
    if (!currentStream || video.paused || video.ended) return;

    try {
        // Runs optimized TinyFace feature scanning
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            currentFaceDescriptor = detection.descriptor;
            if (statusLabel) {
                statusLabel.innerText = "🔒 Biometric Lock Acquired! Ready to save.";
                statusLabel.style.color = "#2e7d32";
            }
        } else {
            if (statusLabel) {
                statusLabel.innerText = "🎥 Align face clearly inside camera frame...";
                statusLabel.style.color = "#008080";
            }
        }
    } catch (e) {
        console.warn("Frame analysis skip loop context window.", e);
    }

    // Recurse scan iteration delay processing threshold
    setTimeout(() => {
        if (currentStream) analyzeRegistrationFrame(video, statusLabel);
    }, 400);
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
    if (confirm("Logout from Admin Panel?")) window.location.href = "index.html";
}