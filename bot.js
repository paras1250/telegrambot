require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const { updateInviteStatus, getInviteByLink } = require('./database');

const token = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${token}`;
const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API_URL = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events`;

if (!token) {
    console.error('FATAL: BOT_TOKEN is missing in .env');
}

// ─── Fire Meta Conversions API Event ───────────────────────────────────────────
const fireMetaConversion = async (invite) => {
    if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
        console.log('[META] Skipping Meta conversion: credentials not set.');
        return;
    }

    try {
        const eventTime = Math.floor(Date.now() / 1000);
        const eventId = crypto.randomUUID();

        const userData = {};
        if (invite.fbp) userData.fbp = invite.fbp;
        if (invite.fbc) userData.fbc = invite.fbc;
        if (invite.ip_address) userData.client_ip_address = invite.ip_address;
        if (invite.user_agent) userData.client_user_agent = invite.user_agent;

        const payload = {
            data: [
                {
                    event_name: 'Lead',
                    event_time: eventTime,
                    event_id: eventId,
                    action_source: 'website',
                    user_data: userData
                }
            ]
        };

        const response = await axios.post(META_API_URL, payload, {
            params: { access_token: META_ACCESS_TOKEN }
        });

        console.log(`[META] Conversion fired successfully! Events received: ${response.data.events_received}`);
    } catch (err) {
        const errorData = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error('[META] Error firing conversion:', errorData);
    }
};

// ─── Handle Telegram Join Request ──────────────────────────────────────────────
const handleJoinRequest = async (request) => {
    try {
        console.log(`[INFO] Join request from user ${request.from.id} for chat ${request.chat.id}`);

        const userId = request.from.id;
        const chatId = request.chat.id;

        let inviteLink = null;
        if (request.invite_link && request.invite_link.invite_link) {
            inviteLink = request.invite_link.invite_link;
        }

        // Approve user
        try {
            await axios.post(`${TELEGRAM_API}/approveChatJoinRequest`, {
                chat_id: chatId,
                user_id: userId
            });
            console.log(`[INFO] User ${userId} approved.`);
        } catch (approveErr) {
            const approveErrData = approveErr.response ? approveErr.response.data : approveErr.message;
            // USER_ALREADY_PARTICIPANT or similar non-critical errors — log and continue
            console.warn(`[BOT] Could not approve user ${userId} (may already be a member):`, approveErrData);
        }

        if (inviteLink) {
            // Revoke link — wrap separately so an expired/already-revoked link doesn't abort Meta conversion
            try {
                await axios.post(`${TELEGRAM_API}/revokeChatInviteLink`, {
                    chat_id: chatId,
                    invite_link: inviteLink
                });
                console.log(`[INFO] Invite link revoked: ${inviteLink}`);
            } catch (revokeErr) {
                const revokeErrData = revokeErr.response ? revokeErr.response.data : revokeErr.message;
                console.warn(`[BOT] Could not revoke invite link (may already be expired/revoked):`, revokeErrData);
            }

            // Get invite data from DB (contains fbp, fbc, ip, user_agent)
            const invite = await getInviteByLink(inviteLink);

            // Update DB status
            await updateInviteStatus(inviteLink, 'approved_and_revoked', userId.toString());

            // 🔥 Fire Meta Conversions API event at the moment of approval!
            if (invite) {
                await fireMetaConversion(invite);
            }
        }
    } catch (apiError) {
        console.error('[BOT] Error handling join request:', apiError.response ? apiError.response.data : apiError.message);
    }
};

// ─── Long Polling (for local dev) ──────────────────────────────────────────────
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
        for (const update of response.data.result) {
            lastUpdateId = update.update_id;
            if (update.chat_join_request) {
                await handleJoinRequest(update.chat_join_request);
            }
        }
    } catch (error) {
        console.error('[BOT] Polling error:', error.message);
    } finally {
        if (!process.env.WEBHOOK_URL) {
            setTimeout(poll, 1000);
        }
    }
};

if (!process.env.WEBHOOK_URL && token) {
    console.log('[BOT] Running in Polling mode...');
    poll();
}

module.exports = {
    handleJoinRequest,
    createChatInviteLink: async (chat_id, options) => {
        const response = await axios.post(`${TELEGRAM_API}/createChatInviteLink`, { chat_id, ...options });
        return response.data.result;
    },
    setWebhook: async (webhookUrl) => {
        const targetUrl = `${webhookUrl}/telegram/webhook`;
        console.log(`[BOT] Setting Webhook to: ${targetUrl}`);
        const response = await axios.post(`${TELEGRAM_API}/setWebhook`, {
            url: targetUrl,
            allowed_updates: ['chat_join_request']
        });
        console.log('[BOT] Webhook status:', response.data.description);
        return response.data;
    }
};
