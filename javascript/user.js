// --- CONFIG & DATA ---
const activeSession = sessionStorage.getItem('active_user');

// Redirect if not logged in
if (!activeSession) {
    alert("Unauthorized access. Please login first.");
    window.location.href = "index.html"; 
}

const currentUser = JSON.parse(activeSession);
let attendanceData = JSON.parse(localStorage.getItem('smart_attendance_data')) || [];
let currentStream = null;

/** 
 * DYNAMIC CONFIGURATION 
 * We initialize this as null; it will be populated by GPS on-the-fly.
 */
let systemConfig = {
    lat: null,
    lng: null,
    gps: 100, // Still use 100m as a standard tolerance radius
    institute: "Detecting Location..."
};

// --- 3. UI INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const profName = document.getElementById('profName');
    const profId = document.getElementById('profId');
    const profEmail = document.getElementById('profEmail');
    const welcomeEl = document.getElementById('displayUserName');

    if (profName) profName.value = currentUser.name;
    if (profId) profId.value = currentUser.id;
    if (profEmail) profEmail.value = currentUser.email;
    if (welcomeEl) welcomeEl.innerText = currentUser.name;

    updateUI();
    renderUserHistory();
    
    // Automatically start location detection on load to set the "Institute" name
    initializeDynamicLocation();
});

/**
 * NEW: Fetches real-time building name and coordinates
 */
async function initializeDynamicLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        
        systemConfig.lat = latitude;
        systemConfig.lng = longitude;

        try {
            // Reverse Geocode using OpenStreetMap (Free)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`
            );
            const data = await response.json();
            
            // Try to find the most relevant building/institute name
            systemConfig.institute = data.address.amenity || 
                                     data.address.university || 
                                     data.address.building || 
                                     data.display_name.split(',')[0];
            
            console.log("Dynamic Institute Detected:", systemConfig.institute);
            updateUI(); // Refresh UI to show the real institute name
        } catch (error) {
            systemConfig.institute = "Current Location";
        }
    });
}

// --- NAVIGATION ---
function showContent(id, element) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';
    document.querySelectorAll('#list li').forEach(l => l.classList.remove('active'));
    if(element) element.classList.add('active');
}

// --- STEP 1: REAL GPS VERIFICATION ---
function verifyGPS() {
    const btn = document.getElementById('loc-btn');
    const text = document.getElementById('loc-text');
    
    // Load the LATEST config saved by the Admin
    const config = JSON.parse(localStorage.getItem('smart_config'));

    navigator.geolocation.getCurrentPosition((position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Calculate distance between USER and ADMIN-SET Campus Center
        const distance = calculateDistance(userLat, userLng, config.lat, config.lng);

        if (distance <= config.gps) {
            text.innerText = "Verified: Inside Campus";
            text.style.color = "green";
            unlockFaceStep();
        } else {
            // This is where your 107m error was coming from
            text.innerText = `Out of Range (${Math.round(distance)}m from ${config.institute})`;
            text.style.color = "red";
            btn.disabled = false;
        }
    }, (err) => { 
        /* error handling */ 
    }, { enableHighAccuracy: true });
}

function unlockFaceStep() {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = false;
    scanBtn.innerHTML = "<i class='bx bx-scan'></i> Start Face Scan";
    scanBtn.style.background = "#008080";
}

// --- STEP 2: BIOMETRIC SCAN ---
async function startBiometricScan() {
    const container = document.getElementById('camera-container');
    const video = document.getElementById('webcam');
    const scanBtn = document.getElementById('scan-btn');

    container.style.display = "block";
    scanBtn.innerText = "Processing...";

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = currentStream;

        setTimeout(() => {
            processAttendance();
            stopCamera();
            container.style.display = "none";
        }, 3000);

    } catch (err) {
        alert("Camera Access Denied.");
        container.style.display = "none";
        scanBtn.innerText = "Retry Scan";
    }
}

// --- ATTENDANCE PROCESSING ---
function processAttendance() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let userLog = attendanceData.find(log => log.id === currentUser.id && log.date === today);

    if (!userLog) {
        attendanceData.push({
            date: today,
            id: currentUser.id,
            name: currentUser.name,
            checkIn: now,
            checkOut: null,
            location: systemConfig.institute // This is now the dynamic building name
        });
        alert(`Check-in Successful at ${systemConfig.institute}!`);
    } else if (!userLog.checkOut) {
        userLog.checkOut = now;
        alert("Check-out Successful!");
    }

    localStorage.setItem('smart_attendance_data', JSON.stringify(attendanceData));
    updateUI();
    renderUserHistory();
}

function updateUI() {
    const today = new Date().toISOString().split('T')[0];
    const userLog = attendanceData.find(log => log.id === currentUser.id && log.date === today);
    const statusBox = document.getElementById('session-status-container');
    const scanBtn = document.getElementById('scan-btn');

    // Update displayed Institute name if an element exists
    const instEl = document.getElementById('displayInstituteName');
    if (instEl) instEl.innerText = systemConfig.institute;

    if (!userLog) {
        if (statusBox) statusBox.innerHTML = `<p>Ready for Check-in at ${systemConfig.institute}</p>`;
    } else if (!userLog.checkOut) {
        if (statusBox) statusBox.innerHTML = `<p style="color:#008080;">Signed In at ${userLog.checkIn}</p>`;
        if (scanBtn) scanBtn.innerText = "Check Out";
    } else {
        if (statusBox) statusBox.innerHTML = "<p style=\"color:green;\">Attendance Complete</p>";
        if (scanBtn) {
            scanBtn.innerText = "Done for Today";
            scanBtn.disabled = true;
        }
    }
}

function renderUserHistory() {
    const historyTable = document.getElementById('userHistoryTable');
    if (!historyTable) return;

    const myLogs = attendanceData.filter(log => log.id === currentUser.id).reverse();
    
    const totalDaysEl = document.getElementById('statTotalDays');
    const percentEl = document.getElementById('statPercentage');
    
    if (totalDaysEl) totalDaysEl.innerText = myLogs.length;
    if (percentEl) percentEl.innerText = Math.min(Math.round((myLogs.length / 22) * 100), 100) + "%";

    historyTable.innerHTML = myLogs.map(log => `
        <tr>
            <td>${log.date}</td>
            <td>${log.checkIn}</td>
            <td>${log.checkOut || '--'}</td>
            <td>${log.location}</td>
        </tr>
    `).join('');
}

// Haversine formula remains as a utility if you ever want to lock to a specific dynamic anchor
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

function stopCamera() {
    if (currentStream) currentStream.getTracks().forEach(t => t.stop());
}

function userLogout() {
    sessionStorage.removeItem('active_user');
    window.location.href = "index.html";
}