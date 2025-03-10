const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/', (req, res) => {
    if (!req.session.userInfo) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    // Render profile.html with user info
    res.sendFile(path.join(__dirname, '../views/profile.html'));
});

// Route to fetch user info
router.get('/user-info', (req, res) => {
    if (!req.session.userInfo) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    // Return user info from the session
    res.json({
        email: req.session.userInfo.email,
        gender: req.session.userInfo.gender,
        name: req.session.userInfo.name,
        picture: req.session.userInfo.picture
    });
});

module.exports = router;