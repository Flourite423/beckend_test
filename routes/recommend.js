const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// 安全的整数转换
function toSafeInt(val, defaultVal, min = 1, max = 1000000) {
    const n = Number(val);
    if (!Number.isFinite(n) || Number.isNaN(n)) return defaultVal;
    const i = Math.floor(n);
    if (i < min) return min;
    if (i > max) return max;
    return i;
}

// 安全的浮点数转换
function toSafeFloat(val) {
    const n = Number(val);
    if (!Number.isFinite(n) || Number.isNaN(n)) return null;
    return n;
}

// POST /recommend - 获取推荐院校列表
router.post(
    '/',
    authRequired,
    body('province')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 1, max: 64 }),
    body('majorIds')
        .optional({ checkFalsy: true })
        .isArray()
        .custom(arr => {
            if (!Array.isArray(arr)) return false;
            return arr.every(id => Number.isInteger(id) && id > 0);
        }),
    body('page')
        .optional()
        .isInt({ min: 1 })
        .toInt(),
    body('pageSize')
        .optional()
        .isInt({ min: 1, max: 200 })
        .toInt(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { province, majorIds } = req.body;
        const page = toSafeInt(req.body.page ?? 1, 1, 1, 1000000);
        const pageSize = toSafeInt(req.body.pageSize ?? 20, 20, 1, 200);
        const offset = (page - 1) * pageSize;

        try {
            // 从数据库获取用户最新成绩
            const [scoreRows] = await db.execute(
                'SELECT TOTAL_SCORE FROM student_score WHERE STUDENT_ID = ? ORDER BY CREATED_AT DESC LIMIT 1',
                [req.user.userId]
            );

            if (scoreRows.length === 0) {
                return res.status(400).json({
                    error: 'No score found',
                    message: '您还未上传成绩，请先提交成绩后再获取推荐'
                });
            }

            const totalScore = scoreRows[0].TOTAL_SCORE;

            // 查询符合条件的院校
            let where = 'WHERE 1=1';
            const params = [];

            if (province) {
                where += ' AND cas.PROVINCE = ?';
                params.push(province);
            }

            if (majorIds && majorIds.length > 0) {
                const placeholders = majorIds.map(() => '?').join(',');
                where += ` AND cas.MAJOR_ID IN (${placeholders})`;
                params.push(...majorIds);
            }

            const recommendationSql = `
                SELECT DISTINCT
                    ci.COLLEGE_ID as collegeId,
                    ci.COLLEGE_NAME as collegeName,
                    ci.COLLEGE_CODE as collegeCode,
                    cas.PROVINCE as province,
                    ci.COLLEGE_LEVEL as collegeLevel,
                    cas.MIN_SCORE as minScore,
                    cas.ADMISSION_YEAR as admissionYear
                FROM college_info ci
                JOIN college_admission_score cas ON ci.COLLEGE_ID = cas.COLLEGE_ID
                ${where}
                ORDER BY cas.ADMISSION_YEAR DESC, ci.COLLEGE_ID
            `;

            const [colleges] = await db.execute(recommendationSql, params);

            if (colleges.length === 0) {
                return res.json({
                    data: [],
                    meta: { page, pageSize, total: 0 }
                });
            }

            const enrichedColleges = await enrichCollegesWithRecommendation(
                colleges,
                totalScore
            );

            const total = enrichedColleges.length;
            const paginatedData = enrichedColleges.slice(offset, offset + pageSize);

            return res.json({
                data: paginatedData,
                meta: {
                    page,
                    pageSize,
                    total
                }
            });

        } catch (err) {
            console.error('Error in POST /recommend:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }
);

/**
 * 推荐算法(输出输出可调整)
 * 
 * 输入：
 * - colleges: 院校列表，每条记录包含 collegeId, collegeName, collegeCode,province, collegeLevel, minScore, admissionYear
 * - totalScore: 用户成绩
 * 
 * 输出：
 * - 增强后的院校列表，每条记录新增 matchDegree (0-100) 和 risk ('low'/'medium'/'high')
 * - 应按推荐优先级排序
 */
async function enrichCollegesWithRecommendation(colleges, totalScore) {
    // TODO: 接入推荐算法
    return colleges.map(college => ({
        ...college,
        matchDegree: 0,
        risk: ''
    }));
}

module.exports = router;
