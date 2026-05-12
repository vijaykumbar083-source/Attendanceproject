/**
 * FaceMark Unified Authentication Logic
 */

// --- Admin Registration Logic ---
function handleAdminRegister() {
    const fname = document.getElementById('fname').value.trim();
    const lname = document.getElementById('lname').value.trim();
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    // 1. Basic Validation
    if (pass !== confirmPass) {
        alert("Passwords do not match!");
        return;
    }

    // 2. Get existing admins or initialize empty array
    const admins = JSON.parse(localStorage.getItem('facemark_admins')) || [];

    // 3. Check if email already exists
    if (admins.find(a => a.email === email)) {
        alert("An admin with this email already exists.");
        return;
    }

    // 4. Create Admin Object
    const newAdmin = {
        name: `${fname} ${lname}`,
        email: email,
        password: pass,
        role: 'admin',
        createdAt: new Date().toISOString()
    };

    // 5. Save to localStorage
    admins.push(newAdmin);
    localStorage.setItem('facemark_admins', JSON.stringify(admins));

    alert("Admin Account Created Successfully!");
    window.location.href = "adminlogin.html";
}

// --- Admin Login Logic (Updated to check registered admins) ---
function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;

    const admins = JSON.parse(localStorage.getItem('facemark_admins')) || [];
    
    // Check hardcoded default OR registered admins
    const registeredAdmin = admins.find(a => a.email === email && a.password === pass);

    if ((email === "admin@facemark.com" && pass === "admin123") || registeredAdmin) {
        localStorage.setItem('adminSession', 'active');
        // If it's a registered admin, store their specific info
        if(registeredAdmin) sessionStorage.setItem('active_admin', JSON.stringify(registeredAdmin));
        
        window.location.href = "admindashboard.html";
    } else {
        alert("Invalid Admin Credentials!");
    }
}

// --- Faculty (User) Login Logic ---
function handleUserLogin() {
    const inputUser = document.getElementById('userName').value.trim();
    const inputPass = document.getElementById('userPass').value.trim();
    const users = JSON.parse(localStorage.getItem('smart_users')) || [];
    
    const user = users.find(u => 
        (u.name === inputUser || u.email === inputUser) && u.password === inputPass
    );
    
    if (user) {
        sessionStorage.setItem('active_user', JSON.stringify(user));
        window.location.href = "userdashboard.html";
    } else {
        alert("Invalid Credentials.");
    }
}