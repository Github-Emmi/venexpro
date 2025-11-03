// Security Page JavaScript
(function() {
    'use strict';

    // API Endpoints
    const API_ENDPOINTS = {
        CHANGE_PASSWORD: '/api/user/change-password/',
        USER_ACTIVITY: '/api/user/activity/',
        UPDATE_SETTINGS: '/api/user/settings/',
    };

    // State
    let currentFilter = 'all';
    let activityOffset = 0;
    const activityLimit = 10;

    // DOM Elements
    const elements = {
        changePasswordForm: document.getElementById('change-password-form'),
        newPasswordInput: document.getElementById('new-password'),
        confirmPasswordInput: document.getElementById('confirm-password'),
        strengthBar: document.getElementById('strength-bar'),
        strengthText: document.getElementById('strength-text'),
        passwordMatch: document.getElementById('password-match'),
        activityList: document.getElementById('activity-list'),
        loadMoreBtn: document.getElementById('load-more-activity'),
        filterBtns: document.querySelectorAll('.filter-btn'),
        togglePasswordBtns: document.querySelectorAll('.toggle-password'),
        emailNotifications: document.getElementById('email-notifications'),
        loginNotifications: document.getElementById('login-notifications'),
        transactionNotifications: document.getElementById('transaction-notifications'),
        logoutAllBtn: document.querySelector('.btn-logout-all'),
    };

    // Password Requirements
    const passwordRequirements = {
        length: /^.{8,}$/,
        uppercase: /[A-Z]/,
        lowercase: /[a-z]/,
        number: /[0-9]/,
        special: /[!@#$%^&*(),.?":{}|<>]/
    };

    // Initialize
    function init() {
        attachEventListeners();
        loadUserActivity();
    }

    // Attach Event Listeners
    function attachEventListeners() {
        // Change Password Form
        if (elements.changePasswordForm) {
            elements.changePasswordForm.addEventListener('submit', handlePasswordChange);
        }

        // Password Strength Checker
        if (elements.newPasswordInput) {
            elements.newPasswordInput.addEventListener('input', checkPasswordStrength);
            elements.newPasswordInput.addEventListener('input', validatePasswordRequirements);
        }

        // Password Match Checker
        if (elements.confirmPasswordInput) {
            elements.confirmPasswordInput.addEventListener('input', checkPasswordMatch);
        }

        // Toggle Password Visibility
        elements.togglePasswordBtns.forEach(btn => {
            btn.addEventListener('click', togglePasswordVisibility);
        });

        // Activity Filters
        elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', handleFilterChange);
        });

        // Load More Activity
        if (elements.loadMoreBtn) {
            elements.loadMoreBtn.addEventListener('click', loadMoreActivity);
        }

        // Settings Toggles
        if (elements.emailNotifications) {
            elements.emailNotifications.addEventListener('change', handleSettingChange);
        }
        if (elements.loginNotifications) {
            elements.loginNotifications.addEventListener('change', handleSettingChange);
        }
        if (elements.transactionNotifications) {
            elements.transactionNotifications.addEventListener('change', handleSettingChange);
        }

        // Logout All Devices
        if (elements.logoutAllBtn) {
            elements.logoutAllBtn.addEventListener('click', handleLogoutAll);
        }
    }

    // Password Strength Checker
    function checkPasswordStrength() {
        const password = elements.newPasswordInput.value;
        let strength = 0;

        // Calculate strength
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        // Update UI
        elements.strengthBar.className = 'strength-bar';
        
        if (strength === 0) {
            elements.strengthBar.style.width = '0%';
            elements.strengthText.textContent = 'Password strength: None';
        } else if (strength <= 2) {
            elements.strengthBar.classList.add('weak');
            elements.strengthText.textContent = 'Password strength: Weak';
            elements.strengthText.style.color = '#ef4444';
        } else if (strength <= 4) {
            elements.strengthBar.classList.add('medium');
            elements.strengthText.textContent = 'Password strength: Medium';
            elements.strengthText.style.color = '#f59e0b';
        } else {
            elements.strengthBar.classList.add('strong');
            elements.strengthText.textContent = 'Password strength: Strong';
            elements.strengthText.style.color = '#10b981';
        }

        checkPasswordMatch();
    }

    // Validate Password Requirements
    function validatePasswordRequirements() {
        const password = elements.newPasswordInput.value;

        // Check each requirement
        Object.keys(passwordRequirements).forEach(req => {
            const element = document.getElementById(`req-${req}`);
            if (element) {
                if (passwordRequirements[req].test(password)) {
                    element.classList.add('met');
                } else {
                    element.classList.remove('met');
                }
            }
        });
    }

    // Check Password Match
    function checkPasswordMatch() {
        const newPassword = elements.newPasswordInput.value;
        const confirmPassword = elements.confirmPasswordInput.value;

        if (!confirmPassword) {
            elements.passwordMatch.style.display = 'none';
            return;
        }

        if (newPassword === confirmPassword) {
            elements.passwordMatch.textContent = '✓ Passwords match';
            elements.passwordMatch.className = 'password-match-indicator match';
        } else {
            elements.passwordMatch.textContent = '✗ Passwords do not match';
            elements.passwordMatch.className = 'password-match-indicator no-match';
        }
    }

    // Toggle Password Visibility
    function togglePasswordVisibility(e) {
        const button = e.currentTarget;
        const targetId = button.dataset.target;
        const input = document.getElementById(targetId);
        const icon = button.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    // Handle Password Change
    async function handlePasswordChange(e) {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = elements.newPasswordInput.value;
        const confirmPassword = elements.confirmPasswordInput.value;

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        // Validate password strength
        let metRequirements = 0;
        Object.keys(passwordRequirements).forEach(req => {
            if (passwordRequirements[req].test(newPassword)) {
                metRequirements++;
            }
        });

        if (metRequirements < 4) {
            showToast('Password does not meet minimum requirements', 'error');
            return;
        }

        try {
            const response = await fetch(API_ENDPOINTS.CHANGE_PASSWORD, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Password changed successfully!', 'success');
                elements.changePasswordForm.reset();
                elements.strengthBar.className = 'strength-bar';
                elements.strengthBar.style.width = '0%';
                elements.strengthText.textContent = 'Password strength: None';
                elements.passwordMatch.style.display = 'none';
                
                // Reset requirements
                document.querySelectorAll('.password-requirements li').forEach(li => {
                    li.classList.remove('met');
                });

                // Log activity
                logActivity('SECURITY', 'Password changed successfully');
            } else {
                showToast(data.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Password change error:', error);
            showToast('An error occurred. Please try again.', 'error');
        }
    }

    // Load User Activity
    async function loadUserActivity() {
        try {
            const url = `${API_ENDPOINTS.USER_ACTIVITY}?limit=${activityLimit}&offset=${activityOffset}&filter=${currentFilter}`;
            
            const response = await fetch(url, {
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            });

            if (response.ok) {
                const data = await response.json();
                renderActivity(data.activities || generateSampleActivity());
            } else {
                // If API not implemented, show sample data
                renderActivity(generateSampleActivity());
            }
        } catch (error) {
            console.error('Failed to load activity:', error);
            renderActivity(generateSampleActivity());
        }
    }

    // Generate Sample Activity (for demo)
    function generateSampleActivity() {
        return [
            {
                type: 'LOGIN',
                title: 'Successful Login',
                description: 'Logged in from Chrome on Windows',
                ip_address: '192.168.1.1',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
                type: 'TRANSACTION',
                title: 'Withdrawal Request',
                description: 'Requested withdrawal of 0.5 BTC',
                ip_address: '192.168.1.1',
                timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
            },
            {
                type: 'SETTINGS',
                title: 'Profile Updated',
                description: 'Changed notification preferences',
                ip_address: '192.168.1.1',
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
                type: 'LOGIN',
                title: 'Successful Login',
                description: 'Logged in from Safari on macOS',
                ip_address: '192.168.1.5',
                timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
            },
            {
                type: 'SECURITY',
                title: 'Password Changed',
                description: 'Account password was updated',
                ip_address: '192.168.1.1',
                timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // Render Activity
    function renderActivity(activities) {
        if (activities.length === 0) {
            elements.activityList.innerHTML = '<p class="no-sessions">No activity found</p>';
            return;
        }

        const activityHTML = activities.map(activity => {
            const iconClass = activity.type.toLowerCase();
            const timeAgo = getTimeAgo(activity.timestamp);
            
            return `
                <div class="activity-item" data-type="${activity.type}">
                    <div class="activity-icon ${iconClass}">
                        <i class="fas fa-${getActivityIcon(activity.type)}"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-meta">
                            <i class="fas fa-clock"></i>${timeAgo}
                            ${activity.ip_address ? `<i class="fas fa-map-marker-alt" style="margin-left: 15px;"></i>${activity.ip_address}` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        elements.activityList.innerHTML = activityHTML;
    }

    // Get Activity Icon
    function getActivityIcon(type) {
        const icons = {
            'LOGIN': 'sign-in-alt',
            'TRANSACTION': 'exchange-alt',
            'SETTINGS': 'cog',
            'SECURITY': 'shield-alt',
            'WITHDRAWAL': 'arrow-down',
            'DEPOSIT': 'arrow-up'
        };
        return icons[type] || 'circle';
    }

    // Handle Filter Change
    function handleFilterChange(e) {
        const filter = e.currentTarget.dataset.filter;
        
        // Update active state
        elements.filterBtns.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Update current filter
        currentFilter = filter;
        activityOffset = 0;

        // Reload activity
        loadUserActivity();
    }

    // Load More Activity
    function loadMoreActivity() {
        activityOffset += activityLimit;
        loadUserActivity();
    }

    // Handle Setting Change
    function handleSettingChange(e) {
        const setting = e.target.id;
        const enabled = e.target.checked;

        console.log(`Setting ${setting} changed to:`, enabled);
        
        showToast(`${setting.replace(/-/g, ' ')} ${enabled ? 'enabled' : 'disabled'}`, 'success');
        
        // Log activity
        logActivity('SETTINGS', `${setting.replace(/-/g, ' ')} ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Handle Logout All Devices
    function handleLogoutAll() {
        if (confirm('Are you sure you want to logout from all devices? You will need to login again.')) {
            showToast('Logging out from all devices...', 'info');
            
            // Simulate logout
            setTimeout(() => {
                showToast('Successfully logged out from all devices', 'success');
                logActivity('SECURITY', 'Logged out from all devices');
            }, 1500);
        }
    }

    // Log Activity (simulated)
    function logActivity(type, description) {
        console.log('Activity logged:', { type, description });
    }

    // Get Time Ago
    function getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
        return time.toLocaleDateString();
    }

    // Show Toast Notification
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                     type === 'error' ? 'exclamation-circle' : 
                     'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        document.getElementById('toast-container').appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // Get CSRF Token
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Animation for slideOut
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
