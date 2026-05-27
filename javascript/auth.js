
function registerNewUser() {
    const name = document.getElementById('regName').value.trim();
    const id = document.getElementById('regId').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;

    
    if (!name || !id || !email || !pass) {
        alert("Please fill in all fields before submitting.");
        return;
    }

    
    const users = JSON.parse(localStorage.getItem('smart_users')) || [];

    
    if (users.find(u => u.email === email)) {
        alert("A user with this email address already exists.");
        return;
    }
    if (users.find(u => u.id === id)) {
        alert("A user with this Student / Employee ID already exists.");
        return;
    }

    const newUser = {
        name: name,
        id: id,
        email: email,
        password: pass,
        role: 'user',
        faceDataStatus: 'Active', 
        createdAt: new Date().toISOString()
    };


    users.push(newUser);
    localStorage.setItem('smart_users', JSON.stringify(users));

    alert("Account Created Successfully!");
    window.location.href = "../index.html"; 
}


function openRegistrationCam() {
    const cameraWrapper = document.getElementById('camera-wrapper');
    const video = document.getElementById('reg-webcam');

    if (cameraWrapper.style.display === "none") {
        cameraWrapper.style.display = "block";
        
        
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                video.srcObject = stream;
            })
            .catch(err => {
                console.error("Camera access blocked or unavailable: ", err);
                alert("Could not access webcam. Please verify device permissions.");
            });
    } else {
        
        cameraWrapper.style.display = "none";
        if (video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        }
    }
}


function handleUserLogin() {
    const inputUser = document.getElementById('userName').value.trim();
    const inputPass = document.getElementById('userPass').value.trim();
    const users = JSON.parse(localStorage.getItem('smart_users')) || [];
    
    
    const user = users.find(u => 
        (u.name === inputUser || u.email === inputUser || u.id === inputUser) && u.password === inputPass
    );
    
    if (user) {
        sessionStorage.setItem('active_user', JSON.stringify(user));
        window.location.href = "userdashboard.html";
    } else {
        alert("Invalid Faculty Credentials.");
    }
}



(function initAdminDatabase() {
    const existingAdmins = JSON.parse(localStorage.getItem('facemark_admins')) || [];
    
    
    const hasAdmin1 = existingAdmins.some(a => a.username === 'admin1' || a.email === 'admin1');
    const hasAdmin2 = existingAdmins.some(a => a.username === 'admin2' || a.email === 'admin2');
    
    
    if (!hasAdmin1 || !hasAdmin2) {
        const structuralAdmins = [
            { name: "Admin One", username: "admin1", email: "admin1", password: "123456", role: "admin" },
            { name: "Admin Two", username: "admin2", email: "admin2", password: "654321", role: "admin" }
        ];
        
        localStorage.setItem('facemark_admins', JSON.stringify(structuralAdmins));
        console.log("⚡ FaceMark Admin storage initialized with admin1 and admin2 credentials.");
    }
})();
function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPass').value;

    // Fetch the admins array directly out of localStorage
    const admins = JSON.parse(localStorage.getItem('facemark_admins')) || [];
    
    
    const authenticatedAdmin = admins.find(a => 
        (a.username === email || a.email === email) && a.password === pass
    );

    if (authenticatedAdmin) {
        localStorage.setItem('adminSession', 'active');
        
        
        const secureSessionObject = {
            name: authenticatedAdmin.name,
            username: authenticatedAdmin.username,
            role: authenticatedAdmin.role
        };
        
        sessionStorage.setItem('active_admin', JSON.stringify(secureSessionObject));
        window.location.href = "admindashboard.html";
    } else {
        alert("Invalid Admin Credentials! Access Denied.");
    }
}