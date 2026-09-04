require('dotenv').config();
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;
let saveInvite, updateInviteStatus, getInviteByLink;

if (databaseUrl) {
    console.log('[DB] Connecting to Cloud PostgreSQL database...');
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    // Initialize Postgres table with Meta tracking columns
    pool.query(`
        CREATE TABLE IF NOT EXISTS invites (
            id SERIAL PRIMARY KEY,
            invite_link TEXT NOT NULL,
            status TEXT DEFAULT 'generated',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            internal_id TEXT UNIQUE,
            fbp TEXT,
            fbc TEXT,
            ip_address TEXT,
            user_agent TEXT
        )
    `).catch(err => console.error('[DB] Error creating Postgres table:', err.message));

    // Also try to add columns if they don't exist (for existing databases)
    pool.query(`ALTER TABLE invites ADD COLUMN IF NOT EXISTS fbp TEXT`).catch(() => {});
    pool.query(`ALTER TABLE invites ADD COLUMN IF NOT EXISTS fbc TEXT`).catch(() => {});
    pool.query(`ALTER TABLE invites ADD COLUMN IF NOT EXISTS ip_address TEXT`).catch(() => {});
    pool.query(`ALTER TABLE invites ADD COLUMN IF NOT EXISTS user_agent TEXT`).catch(() => {});

    saveInvite = async (inviteLink, internalId, meta = {}) => {
        const res = await pool.query(
            'INSERT INTO invites (invite_link, internal_id, fbp, fbc, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [inviteLink, internalId, meta.fbp || null, meta.fbc || null, meta.ip || null, meta.userAgent || null]
        );
        return res.rows[0].id;
    };

    updateInviteStatus = async (inviteLink, status, userId) => {
        const res = await pool.query(
            'UPDATE invites SET status = $1, user_id = $2 WHERE invite_link = $3',
            [status, userId, inviteLink]
        );
        return res.rowCount;
    };

    getInviteByLink = async (inviteLink) => {
        const res = await pool.query('SELECT * FROM invites WHERE invite_link = $1', [inviteLink]);
        return res.rows[0];
    };
} else {
    console.log('[DB] Connecting to Local SQLite database...');
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('[DB] Error opening SQLite database:', err.message);
        } else {
            console.log('[DB] Connected to the Local SQLite database.');
            db.run(`CREATE TABLE IF NOT EXISTS invites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invite_link TEXT NOT NULL,
                status TEXT DEFAULT 'generated',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id TEXT,
                internal_id TEXT UNIQUE,
                fbp TEXT,
                fbc TEXT,
                ip_address TEXT,
                user_agent TEXT
            )`);
        }
    });

    saveInvite = (inviteLink, internalId, meta = {}) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO invites (invite_link, internal_id, fbp, fbc, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)`,
                [inviteLink, internalId, meta.fbp || null, meta.fbc || null, meta.ip || null, meta.userAgent || null],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    };

    updateInviteStatus = (inviteLink, status, userId) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE invites SET status = ?, user_id = ? WHERE invite_link = ?`, [status, userId, inviteLink], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    };

    getInviteByLink = (inviteLink) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM invites WHERE invite_link = ?`, [inviteLink], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };
}

module.exports = {
    saveInvite,
    updateInviteStatus,
    getInviteByLink
};
