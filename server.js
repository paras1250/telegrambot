require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { saveInvite } = require('./database');
const bot = require('./bot');

const app = express();
const port = process.env.PORT || 3000;
const channelId = process.env.CHANNEL_ID;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API Endpoint for frontend to request invite link
app.get('/api/join', async (req, res) => {
    if (!channelId) {
        return res.status(500).json({ error: 'CHANNEL_ID is not configured in .env' });
    }

    try {
        const internalId = crypto.randomUUID();
        const inviteName = `visitor_${internalId.substring(0, 8)}`;

        const inviteData = await bot.createChatInviteLink(channelId, {
            name: inviteName,
            creates_join_request: true
        });

        const inviteLink = inviteData.invite_link;

        // Capture Meta tracking data from request
        const meta = {
            fbp: req.query.fbp || null,
            fbc: req.query.fbc || null,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
            userAgent: req.headers['user-agent'] || null
        };

        await saveInvite(inviteLink, internalId, meta);

        console.log(`[INFO] Created new invite: ${inviteLink} | FBP: ${meta.fbp} | FBC: ${meta.fbc} | IP: ${meta.ip}`);
        res.json({ success: true, url: inviteLink });
    } catch (error) {
        console.error('Error generating invite:', error.message);
        res.status(500).json({ error: 'Unable to create Telegram invitation. Please try again.' });
    }
});

// Telegram Webhook Endpoint (for cloud hosting)
app.post('/telegram/webhook', async (req, res) => {
    res.sendStatus(200);
    const update = req.body;
    if (update && update.chat_join_request) {
        await bot.handleJoinRequest(update.chat_join_request);
    }
});

app.listen(port, async () => {
    console.log(`[SERVER] Running at http://localhost:${port}`);
    if (process.env.WEBHOOK_URL) {
        try {
            await bot.setWebhook(process.env.WEBHOOK_URL);
        } catch (err) {
            console.error('[SERVER] Failed to register webhook:', err.message);
        }
    }
});
