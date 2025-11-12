const express = require('express');
const { body, validationResult } = require('express-validator');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// 获取推荐院校列表
router.post(
    '/',
    authRequired,
    body('province').optional().trim().isLength({ min: 1, max: 64 }),
    body('majorIds').optional().isArray(),
    body('page').optional().isInt({ min: 1 }).toInt(),
    body('pageSize').optional().isInt({ min: 1, max: 200 }).toInt(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { province, majorIds, page = 1, pageSize = 20 } = req.body;

        try {
            // TODO: 1. 从数据库获取用户成绩
            // TODO: 2. 根据筛选条件查询院校数据
            // TODO: 3. 调用推荐算法计算匹配度和风险
            // TODO: 4. 返回推荐结果

            return res.json({
                data: [],
                meta: { page, pageSize, total: 0 }
            });
        } catch (err) {
            console.error('Error in POST /recommend:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }
);

module.exports = router;
