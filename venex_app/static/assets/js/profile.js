/**
 * ========================================
 * PROFILE PAGE JAVASCRIPT
 * ========================================
 * Manages user profile, KYC, security, and wallets
 */

(function($) {
    'use strict';

    // ========================================
    // STATE MANAGEMENT
    // ========================================
    const state = {
        currentTab: 'personal',
        isEditing: {
            personal: false,
            wallets: false
        },
        originalData: {
            personal: {},
            wallets: {}
        }
    };

    // ========================================
    // INITIALIZATION
    // ========================================
    $(document).ready(function() {
        console.log('✅ Profile Page JavaScript loaded!');
        initializeEventListeners();
        updateWalletCount();
        initializePasswordStrength();
    });

    // ========================================
    // EVENT LISTENERS
    // ========================================
    function initializeEventListeners() {
        // Tab switching
        $('.tab-btn').on('click', function() {
            const tab = $(this).data('tab');
            switchTab(tab);
        });

        // Personal info edit mode
        $('#edit-personal-btn').on('click', togglePersonalEditMode);
        $('#cancel-personal-btn').on('click', cancelPersonalEdit);
        $('#personal-info-form').on('submit', savePersonalInfo);

        // Profile picture upload
        $('#change-pic-btn').on('click', function() {
            $('#profile-pic-input').click();
        });
        $('#profile-pic-input').on('change', handleProfilePictureChange);

        // KYC document upload
        $('#kyc-document').on('change', handleKYCDocumentChange);
        $('#remove-file-btn').on('click', removeKYCDocument);
        $('#kyc-form').on('submit', submitKYCVerification);

        // Drag and drop for KYC
        const uploadArea = $('#kyc-upload-area');
        uploadArea.on('dragover', function(e) {
            e.preventDefault();
            $(this).css('border-color', 'var(--primary-color)');
        });
        uploadArea.on('dragleave', function(e) {
            e.preventDefault();
            $(this).css('border-color', 'var(--border-color)');
        });
        uploadArea.on('drop', function(e) {
            e.preventDefault();
            $(this).css('border-color', 'var(--border-color)');
            const files = e.originalEvent.dataTransfer.files;
            if (files.length) {
                $('#kyc-document')[0].files = files;
                handleKYCDocumentChange();
            }
        });

        // Password form
        $('#password-form').on('submit', changePassword);
        $('#new-password').on('input', checkPasswordStrength);
        
        // Password visibility toggle
        $('.btn-toggle-password').on('click', function() {
            const targetId = $(this).data('target');
            const input = $(`#${targetId}`);
            const icon = $(this).find('i');
            
            if (input.attr('type') === 'password') {
                input.attr('type', 'text');
                icon.removeClass('fa-eye').addClass('fa-eye-slash');
            } else {
                input.attr('type', 'password');
                icon.removeClass('fa-eye-slash').addClass('fa-eye');
            }
        });

        // 2FA enable button
        $('.btn-enable-2fa').on('click', enable2FA);

        // Wallets edit mode
        $('#edit-wallets-btn').on('click', toggleWalletsEditMode);
        $('#cancel-wallets-btn').on('click', cancelWalletsEdit);
        $('#wallets-form').on('submit', saveWalletAddresses);

        // Copy wallet addresses
        $('.btn-copy').on('click', function() {
            const wallet = $(this).data('wallet');
            copyWalletAddress(wallet);
        });
    }

    // ========================================
    // TAB SWITCHING
    // ========================================
    function switchTab(tab) {
        state.currentTab = tab;
        
        // Update tab buttons
        $('.tab-btn').removeClass('active');
        $(`.tab-btn[data-tab="${tab}"]`).addClass('active');
        
        // Update tab content
        $('.tab-content').removeClass('active');
        $(`#${tab}-tab`).addClass('active');
    }

    // ========================================
    // PERSONAL INFO MANAGEMENT
    // ========================================
    function togglePersonalEditMode() {
        if (state.isEditing.personal) {
            cancelPersonalEdit();
        } else {
            // Save original data
            state.originalData.personal = {
                firstName: $('#first-name').val(),
                lastName: $('#last-name').val(),
                phone: $('#phone').val(),
                gender: $('#gender').val(),
                address: $('#address').val()
            };

            // Enable inputs
            $('#first-name, #last-name, #phone, #gender, #address').prop('disabled', false);
            
            // Update button
            $('#edit-personal-btn').html('<i class="fas fa-times"></i> Cancel Edit');
            
            // Show form actions
            $('#personal-info-form .form-actions').show();
            
            state.isEditing.personal = true;
        }
    }

    function cancelPersonalEdit() {
        // Restore original data
        if (state.originalData.personal) {
            $('#first-name').val(state.originalData.personal.firstName);
            $('#last-name').val(state.originalData.personal.lastName);
            $('#phone').val(state.originalData.personal.phone);
            $('#gender').val(state.originalData.personal.gender);
            $('#address').val(state.originalData.personal.address);
        }

        // Disable inputs
        $('#first-name, #last-name, #phone, #gender, #address').prop('disabled', true);
        
        // Update button
        $('#edit-personal-btn').html('<i class="fas fa-edit"></i> Edit');
        
        // Hide form actions
        $('#personal-info-form .form-actions').hide();
        
        state.isEditing.personal = false;
    }

    function savePersonalInfo(e) {
        e.preventDefault();

        const formData = {
            first_name: $('#first-name').val(),
            last_name: $('#last-name').val(),
            phone_no: $('#phone').val(),
            gender: $('#gender').val(),
            address: $('#address').val()
        };

        $.ajax({
            url: '/api/user/profile/update/',
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(formData),
            success: function(response) {
                if (response.success) {
                    showToast('Personal information updated successfully!');
                    cancelPersonalEdit();
                    
                    // Update profile display
                    $('.profile-pic-info h4').text(`${formData.first_name} ${formData.last_name}`);
                } else {
                    showToast('Failed to update personal information', 'error');
                }
            },
            error: function(xhr) {
                console.error('Error updating profile:', xhr);
                showToast('An error occurred. Please try again.', 'error');
            }
        });
    }

    function handleProfilePictureChange() {
        const file = $('#profile-pic-input')[0].files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.match('image.*')) {
            showToast('Please upload an image file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size must be less than 5MB', 'error');
            return;
        }

        // Preview image
        const reader = new FileReader();
        reader.onload = function(e) {
            $('#profile-pic-display').html(`<img src="${e.target.result}" alt="Profile">`);
        };
        reader.readAsDataURL(file);

        // Upload to server
        const formData = new FormData();
        formData.append('profile_pic', file);

        $.ajax({
            url: '/api/user/profile/update/',
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    showToast('Profile picture updated successfully!');
                } else {
                    showToast('Failed to update profile picture', 'error');
                }
            },
            error: function(xhr) {
                console.error('Error uploading profile picture:', xhr);
                showToast('An error occurred. Please try again.', 'error');
            }
        });
    }

    // ========================================
    // KYC VERIFICATION
    // ========================================
    function handleKYCDocumentChange() {
        const file = $('#kyc-document')[0].files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            showToast('Please upload a JPG, PNG, or PDF file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('File size must be less than 5MB', 'error');
            return;
        }

        // Display file preview
        const fileName = file.name;
        const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        
        $('#file-name').text(fileName);
        $('#file-size').text(fileSize);
        $('#file-preview').show();
        $('#kyc-upload-area').hide();
    }

    function removeKYCDocument() {
        $('#kyc-document').val('');
        $('#file-preview').hide();
        $('#kyc-upload-area').show();
    }

    function submitKYCVerification(e) {
        e.preventDefault();

        const file = $('#kyc-document')[0].files[0];
        if (!file) {
            showToast('Please upload a document', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('id_document', file);

        // Show loading state
        const submitBtn = $('.btn-submit-kyc');
        const originalText = submitBtn.html();
        submitBtn.html('<i class="fas fa-spinner fa-spin"></i> Uploading...').prop('disabled', true);

        $.ajax({
            url: '/api/user/profile/update/',
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    showToast('KYC document uploaded successfully! We will review it shortly.');
                    setTimeout(() => location.reload(), 2000);
                } else {
                    showToast('Failed to upload KYC document', 'error');
                    submitBtn.html(originalText).prop('disabled', false);
                }
            },
            error: function(xhr) {
                console.error('Error uploading KYC document:', xhr);
                showToast('An error occurred. Please try again.', 'error');
                submitBtn.html(originalText).prop('disabled', false);
            }
        });
    }

    // ========================================
    // PASSWORD MANAGEMENT
    // ========================================
    function initializePasswordStrength() {
        $('#new-password').on('input', checkPasswordStrength);
    }

    function checkPasswordStrength() {
        const password = $('#new-password').val();
        let strength = 0;
        
        // Check requirements
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        // Update requirement indicators
        $('#req-length').toggleClass('valid', requirements.length);
        $('#req-uppercase').toggleClass('valid', requirements.uppercase);
        $('#req-lowercase').toggleClass('valid', requirements.lowercase);
        $('#req-number').toggleClass('valid', requirements.number);
        $('#req-special').toggleClass('valid', requirements.special);

        // Calculate strength
        Object.values(requirements).forEach(met => {
            if (met) strength++;
        });

        // Update strength bar
        const strengthFill = $('#strength-fill');
        const strengthText = $('#strength-text span');
        
        strengthFill.removeClass('weak medium strong');
        
        if (strength <= 2) {
            strengthFill.addClass('weak');
            strengthText.text('Weak');
        } else if (strength <= 4) {
            strengthFill.addClass('medium');
            strengthText.text('Medium');
        } else {
            strengthFill.addClass('strong');
            strengthText.text('Strong');
        }
    }

    function changePassword(e) {
        e.preventDefault();

        const currentPassword = $('#current-password').val();
        const newPassword = $('#new-password').val();
        const confirmPassword = $('#confirm-password').val();

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            showToast('Password must be at least 8 characters', 'error');
            return;
        }

        // Send to server
        $.ajax({
            url: '/api/user/change-password/',
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            }),
            success: function(response) {
                if (response.success) {
                    showToast('Password changed successfully!');
                    $('#password-form')[0].reset();
                    $('#strength-fill').removeClass('weak medium strong');
                } else {
                    showToast(response.error || 'Failed to change password', 'error');
                }
            },
            error: function(xhr) {
                console.error('Error changing password:', xhr);
                const error = xhr.responseJSON?.error || 'An error occurred. Please try again.';
                showToast(error, 'error');
            }
        });
    }

    // ========================================
    // TWO-FACTOR AUTHENTICATION
    // ========================================
    function enable2FA() {
        showToast('2FA setup will be implemented soon', 'info');
        // TODO: Implement 2FA setup flow
    }

    // ========================================
    // WALLET ADDRESSES MANAGEMENT
    // ========================================
    function toggleWalletsEditMode() {
        if (state.isEditing.wallets) {
            cancelWalletsEdit();
        } else {
            // Save original data
            state.originalData.wallets = {
                btc: $('#btc-wallet').val(),
                ethereum: $('#ethereum-wallet').val(),
                usdt: $('#usdt-wallet').val(),
                litecoin: $('#litecoin-wallet').val(),
                tron: $('#tron-wallet').val()
            };

            // Enable inputs
            $('.wallet-input').prop('disabled', false);
            
            // Update button
            $('#edit-wallets-btn').html('<i class="fas fa-times"></i> Cancel Edit');
            
            // Show form actions
            $('#wallets-form .form-actions').show();
            
            state.isEditing.wallets = true;
        }
    }

    function cancelWalletsEdit() {
        // Restore original data
        if (state.originalData.wallets) {
            $('#btc-wallet').val(state.originalData.wallets.btc);
            $('#ethereum-wallet').val(state.originalData.wallets.ethereum);
            $('#usdt-wallet').val(state.originalData.wallets.usdt);
            $('#litecoin-wallet').val(state.originalData.wallets.litecoin);
            $('#tron-wallet').val(state.originalData.wallets.tron);
        }

        // Disable inputs
        $('.wallet-input').prop('disabled', true);
        
        // Update button
        $('#edit-wallets-btn').html('<i class="fas fa-edit"></i> Edit');
        
        // Hide form actions
        $('#wallets-form .form-actions').hide();
        
        state.isEditing.wallets = false;
    }

    function saveWalletAddresses(e) {
        e.preventDefault();

        const walletData = {
            btc_wallet: $('#btc-wallet').val(),
            ethereum_wallet: $('#ethereum-wallet').val(),
            usdt_wallet: $('#usdt-wallet').val(),
            litecoin_wallet: $('#litecoin-wallet').val(),
            tron_wallet: $('#tron-wallet').val()
        };

        $.ajax({
            url: '/api/user/profile/update/',
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(walletData),
            success: function(response) {
                if (response.success) {
                    showToast('Wallet addresses updated successfully!');
                    cancelWalletsEdit();
                    updateWalletCount();
                } else {
                    showToast('Failed to update wallet addresses', 'error');
                }
            },
            error: function(xhr) {
                console.error('Error updating wallets:', xhr);
                showToast('An error occurred. Please try again.', 'error');
            }
        });
    }

    function copyWalletAddress(wallet) {
        const walletId = `${wallet === 'eth' ? 'ethereum' : wallet}-wallet`;
        const address = $(`#${walletId}`).val();

        if (!address) {
            showToast('No wallet address to copy', 'error');
            return;
        }

        // Copy to clipboard
        navigator.clipboard.writeText(address).then(() => {
            showToast('Wallet address copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy address', 'error');
        });
    }

    function updateWalletCount() {
        const wallets = [
            $('#btc-wallet').val(),
            $('#ethereum-wallet').val(),
            $('#usdt-wallet').val(),
            $('#litecoin-wallet').val(),
            $('#tron-wallet').val()
        ];

        const count = wallets.filter(w => w && w.trim() !== '').length;
        $('#wallet-count').text(count);
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
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

    function showToast(message, type = 'success') {
        const toast = $('#toast');
        const icon = toast.find('i');
        
        // Update icon based on type
        icon.removeClass('fa-check-circle fa-exclamation-circle fa-info-circle');
        if (type === 'error') {
            icon.addClass('fa-exclamation-circle');
            toast.css('background', 'linear-gradient(135deg, var(--danger-color), #dc2626)');
        } else if (type === 'info') {
            icon.addClass('fa-info-circle');
            toast.css('background', 'linear-gradient(135deg, var(--info-color), #2563eb)');
        } else {
            icon.addClass('fa-check-circle');
            toast.css('background', 'linear-gradient(135deg, var(--success-color), #059669)');
        }
        
        $('#toast-message').text(message);
        toast.addClass('show');
        
        setTimeout(() => {
            toast.removeClass('show');
        }, 3000);
    }

})(jQuery);
