require('dotenv').config();
const axios = require('axios');
const { updateInviteStatus } = require('./database');

const token = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${token}`;

if (!token) {
    console.error('FATAL: BOT_TOKEN is missing in .env');
}

const handleJoinRequest = async (request) => {
    try {
        console.log(`[INFO] Join request received from user ${request.from.id} for chat ${request.chat.id}`);
        
        const userId = request.from.id;
        const chatId = request.chat.id;
        
        let inviteLink = null;
        if (request.invite_link && request.invite_link.invite_link) {
            inviteLink = request.invite_link.invite_link;
        }

        // Approve user
        await axios.post(`${TELEGRAM_API}/approveChatJoinRequest`, {
            chat_id: chatId,
            user_id: userId
        });
        console.log(`[INFO] User ${userId} approved successfully.`);

        // Revoke the specific invite link to ensure one-time use
        if (inviteLink) {
            await axios.post(`${TELEGRAM_API}/revokeChatInviteLink`, {
                chat_id: chatId,
                invite_link: inviteLink
            });
            console.log(`[INFO] Invite link revoked: ${inviteLink}`);
            
            // Update database status
            await updateInviteStatus(inviteLink, 'approved_and_revoked', userId.toString());
        }
    } catch (apiError) {
        console.error('Error handling join request:', apiError.response ? apiError.response.data : apiError.message);
    }
};

let lastUpdateId = 0;
const poll = async () => {
    try {
        const response = await axios.get(`${TELEGRAM_API}/getUpdates`, {
            params: {
                offset: lastUpdateId + 1,
                timeout: 30,
                allowed_updates: ['chat_join_request']
            }
        });

        const updates = response.data.result;
        for (const update of updates) {
            lastUpdateId = update.update_id;
            if (update.chat_join_request) {
                await handleJoinRequest(update.chat_join_request);
            }
        }
    } catch (error) {
        console.error('Polling error:', error.message);
    } finally {
        if (!process.env.WEBHOOK_URL) {
            setTimeout(poll, 1000);
        }
    }
};

// If WEBHOOK_URL is not set, use Polling
if (!process.env.WEBHOOK_URL && token) {
    console.log('[BOT] WEBHOOK_URL not set. Running in Polling mode...');
    poll();
}

module.exports = {
    handleJoinRequest,
    createChatInviteLink: async (chat_id, options) => {
        const response = await axios.post(`${TELEGRAM_API}/createChatInviteLink`, {
            chat_id: chat_id,
            ...options
        });
        return response.data.result;
    },
    setWebhook: async (webhookUrl) => {
        const targetUrl = `${webhookUrl}/telegram/webhook`;
        console.log(`[BOT] Setting Telegram Webhook to: ${targetUrl}`);
        const response = await axios.post(`${TELEGRAM_API}/setWebhook`, {
            url: targetUrl,
            allowed_updates: ['chat_join_request']
        });
        console.log('[BOT] Webhook status:', response.data.description);
        return response.data;
    }
};
