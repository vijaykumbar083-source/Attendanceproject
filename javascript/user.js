
const activeSession = sessionStorage.getItem('active_user');

if (!activeSession) {
    alert("Unauthorized access. Please login first.");
    window.location.href = "index.html"; 
}

const currentUser = JSON.parse(activeSession);
let attendanceData = JSON.parse(localStorage.getItem('smart_attendance_data')) || [];
let currentStream = null;


let systemConfig = JSON.parse(localStorage.getItem('smart_config')) || {
    lat: null,
    lng: null,
    gps: 100, 
    institute: "Detecting Location..."
};


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
    
    
    initializeDynamicLocation();
});


async function initializeDynamicLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        
        if (!systemConfig.lat) {
            systemConfig.lat = latitude;
            systemConfig.lng = longitude;
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`
            );
            const data = await response.json();
            
            const detectedLocation = data.address.amenity || 
                                     data.address.university || 
                                     data.address.building || 
                                     data.display_name.split(',')[0];
            
            if (systemConfig.institute === "Detecting Location...") {
                systemConfig.institute = detectedLocation;
            }
            
            updateUI(); 
        } catch (error) {
            if (systemConfig.institute === "Detecting Location...") {
                systemConfig.institute = "Current Location";
            }
        }
    });
}


function showContent(id, element) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';
    document.querySelectorAll('#list li').forEach(l => l.classList.remove('active'));
    if(element) element.classList.add('active');
}


function verifyGPS() {
    const btn = document.getElementById('loc-btn');
    const text = document.getElementById('loc-text');
    
    
    const adminConfig = JSON.parse(localStorage.getItem('smart_config')) || systemConfig;

    if (!adminConfig.lat || !adminConfig.lng) {
        text.innerText = "Error: Admin hasn't initialized center coordinates.";
        text.style.color = "orange";
        return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        
        const distance = calculateDistance(userLat, userLng, adminConfig.lat, adminConfig.lng);
        const allowedRadius = adminConfig.gps || 100;

        if (distance <= allowedRadius) {
            text.innerText = `Verified: Inside ${adminConfig.institute || 'Campus'}`;
            text.style.color = "green";
            unlockFaceStep();
        } else {
            text.innerText = `Out of Range (${Math.round(distance)}m from ${adminConfig.institute || 'Campus Center'})`;
            text.style.color = "red";
            btn.disabled = false;
        }
    }, (err) => { 
        alert("GPS Error: Access denied or timed out.");
    }, { enableHighAccuracy: true });
}

function unlockFaceStep() {
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = "<i class='bx bx-scan'></i> Start Face Scan";
        scanBtn.style.background = "#008080";
    }
}

async function startBiometricScan() {
    const container = document.getElementById('camera-container');
    const video = document.getElementById('webcam');
    const scanBtn = document.getElementById('scan-btn');

    if (container) container.style.display = "block";
    if (scanBtn) scanBtn.innerText = "Processing...";

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (video) video.srcObject = currentStream;

        setTimeout(() => {
            processAttendance();
            stopCamera();
            if (container) container.style.display = "none";
        }, 3000);

    } catch (err) {
        alert("Camera Access Denied.");
        if (container) container.style.display = "none";
        if (scanBtn) scanBtn.innerText = "Retry Scan";
    }
}


function processAttendance() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    
    attendanceData = JSON.parse(localStorage.getItem('smart_attendance_data')) || [];
    const adminConfig = JSON.parse(localStorage.getItem('smart_config')) || systemConfig;
    const currentInstitute = adminConfig.institute || "Campus Center";

    let userLog = attendanceData.find(log => log.id === currentUser.id && log.date === today);

    if (!userLog) {
        attendanceData.push({
            date: today,
            id: currentUser.id,
            name: currentUser.name,
            checkIn: now,
            checkOut: null,
            location: currentInstitute
        });
        alert(`Check-in Successful at ${currentInstitute}!`);
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
    const adminConfig = JSON.parse(localStorage.getItem('smart_config')) || systemConfig;
    const currentInstitute = adminConfig.institute || "Campus";

    // Refresh memory data instance mapping arrays dynamically 
    attendanceData = JSON.parse(localStorage.getItem('smart_attendance_data')) || [];
    const userLog = attendanceData.find(log => log.id === currentUser.id && log.date === today);
    
    const statusBox = document.getElementById('session-status-container');
    const scanBtn = document.getElementById('scan-btn');

    if (!userLog) {
        if (statusBox) statusBox.innerHTML = `<p>Ready for Check-in at <b>${currentInstitute}</b></p>`;
    } else if (!userLog.checkOut) {
        if (statusBox) statusBox.innerHTML = `<p style="color:#008080;">Signed In at <b>${userLog.checkIn}</b></p>`;
        if (scanBtn) {
            scanBtn.innerText = "Check Out";
            scanBtn.disabled = false;
            scanBtn.style.background = "orange";
        }
    } else {
        if (statusBox) statusBox.innerHTML = "<p style=\"color:green; font-weight:bold;\">✨ Attendance Complete for Today</p>";
        if (scanBtn) {
            scanBtn.innerText = "Done for Today";
            scanBtn.disabled = true;
            scanBtn.style.background = "#ccc";
        }
    }
}

function renderUserHistory() {
    const historyTable = document.getElementById('userHistoryTable');
    if (!historyTable) return;

    attendanceData = JSON.parse(localStorage.getItem('smart_attendance_data')) || [];
    
    
    const myLogs = attendanceData.filter(log => log.id === currentUser.id);
    

    const uniqueGlobalDays = [...new Set(attendanceData.map(log => log.date))];
    const totalSystemDays = uniqueGlobalDays.length || 1; 

    
    const userDistinctDays = [...new Set(myLogs.map(log => log.date))].length;

    
    const calculatedPercentage = Math.round((userDistinctDays / totalSystemDays) * 100);

    const totalDaysEl = document.getElementById('statTotalDays');
    const percentEl = document.getElementById('statPercentage');
    
    if (totalDaysEl) totalDaysEl.innerText = `${userDistinctDays} / ${totalSystemDays} Days`;
    if (percentEl) {
        percentEl.innerText = calculatedPercentage + "%";
        
        
        if (calculatedPercentage >= 75) percentEl.style.color = "#2e7d32";
        else if (calculatedPercentage >= 50) percentEl.style.color = "#e65100";
        else percentEl.style.color = "#e74c3c";
    }

    
    const displayLogs = [...myLogs].reverse();
    historyTable.innerHTML = displayLogs.length ? displayLogs.map(log => `
        <tr>
            <td>${log.date}</td>
            <td><b style="color:#008080">${log.checkIn}</b></td>
            <td><b style="color:${log.checkOut ? 'orange' : '#666'}">${log.checkOut || 'Active'}</b></td>
            <td><i class='bx bx-current-location'></i> ${log.location}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" style="text-align:center; padding:20px;">No historical data available.</td></tr>';
}

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
    if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
    }
}

function userLogout() {
    stopCamera();
    sessionStorage.removeItem('active_user');
    window.location.href = "../index.html";
}