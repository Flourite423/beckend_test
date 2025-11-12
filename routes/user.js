const express = require('express');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post(
    '/profile',
    authRequired,
    body('username')
        .optional()
        .trim()
        .isLength({ min: 5, max: 20 })
        .matches(/^[A-Za-z0-9_]+$/),
    body('province')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 1, max: 48 }),
    body('schoolName')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 1, max: 255 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, province, schoolName } = req.body;

        if (username === undefined && province === undefined && schoolName === undefined) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const fields = [];
        const params = [];

        if (username !== undefined) {
            fields.push('USERNAME = ?');
            params.push(username);
        }

        if (province !== undefined) {
            fields.push('PROVINCE = ?');
            params.push(province);
        }

        if (schoolName !== undefined) {
            fields.push('SCHOOL_NAME = ?');
            params.push(schoolName);
        }

        params.push(req.user.userId);

        const updateSql = `UPDATE users SET ${fields.join(', ')} WHERE USER_ID = ?`;

        try {
            const [result] = await db.execute(updateSql, params);
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const [rows] = await db.execute(
                'SELECT USER_ID, USERNAME, PROVINCE, SCHOOL_NAME FROM users WHERE USER_ID = ?',
                [req.user.userId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = rows[0];

            return res.json({
                message: 'Profile updated successfully',
                user: {
                    userId: user.USER_ID,
                    username: user.USERNAME,
                    province: user.PROVINCE,
                    schoolName: user.SCHOOL_NAME,
                },
            });
        } catch (err) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Username already exists' });
            }
            console.error('Failed to update user profile:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }
);

module.exports = router;
