// Helper to read a cookie by name
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

// Helper to get fbc from URL (Facebook click ID)
function getFbc() {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (fbclid) {
        const timestamp = Math.floor(Date.now() / 1000);
        return `fb.1.${timestamp}.${fbclid}`;
    }
    return getCookie('_fbc');
}

document.addEventListener('DOMContentLoaded', () => {
    const joinBtn = document.getElementById('join-btn');
    const btnText = joinBtn.querySelector('.btn-text');
    const errorMsg = document.getElementById('error-message');

    let userClicked = false;
    let autoRedirectTimer = null;
    let countdownInterval = null;

    // --- Core join logic (shared by manual click & auto-redirect) ---
    async function triggerJoin() {
        if (joinBtn.classList.contains('loading')) return;

        joinBtn.classList.add('loading');
        joinBtn.disabled = true;
        errorMsg.classList.remove('visible');
        errorMsg.textContent = '';

        try {
            // Capture Meta tracking cookies
            const fbp = getCookie('_fbp') || '';
            const fbc = getFbc() || '';

            // Build query params with Meta data
            const params = new URLSearchParams();
            if (fbp) params.append('fbp', fbp);
            if (fbc) params.append('fbc', fbc);

            const url = `/api/join?${params.toString()}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.success && data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to generate invite');
            }
        } catch (error) {
            console.error('Error:', error);
            errorMsg.textContent = error.message || 'Unable to create Telegram invitation. Please try again.';
            errorMsg.classList.add('visible');
        } finally {
            joinBtn.classList.remove('loading');
            joinBtn.disabled = false;
        }
    }

    // --- Manual click handler ---
    joinBtn.addEventListener('click', () => {
        userClicked = true;
        clearTimeout(autoRedirectTimer);
        clearInterval(countdownInterval);
        btnText.textContent = 'Join Telegram';
        triggerJoin();
    });

    // --- Auto-redirect countdown (5 seconds) ---
    const AUTO_REDIRECT_SECONDS = 5;
    let remaining = AUTO_REDIRECT_SECONDS;

    btnText.textContent = `Auto-joining in ${remaining}s...`;

    countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            btnText.textContent = `Auto-joining in ${remaining}s...`;
        } else {
            clearInterval(countdownInterval);
        }
    }, 1000);

    autoRedirectTimer = setTimeout(() => {
        if (!userClicked) {
            clearInterval(countdownInterval);
            btnText.textContent = 'Joining...';
            triggerJoin();
        }
    }, AUTO_REDIRECT_SECONDS * 1000);
});
