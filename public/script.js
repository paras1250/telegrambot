document.addEventListener('DOMContentLoaded', () => {
    const joinBtn = document.getElementById('join-btn');
    const errorMsg = document.getElementById('error-message');

    joinBtn.addEventListener('click', async () => {
        // Prevent multiple clicks
        if (joinBtn.classList.contains('loading')) return;

        joinBtn.classList.add('loading');
        joinBtn.disabled = true;
        errorMsg.classList.remove('visible');
        errorMsg.textContent = '';

        try {
            const response = await fetch('/api/join');
            const data = await response.json();

            if (data.success && data.url) {
                // Redirect to the Telegram invite link
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
    });
});
