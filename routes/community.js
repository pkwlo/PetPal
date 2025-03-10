const express = require('express');
const router = express.Router();
const { dynamoClient } = require('../index');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/community.html'));
});

router.post('/submit', (req, res) => {
    const { username, photoUrl, comment } = req.body;
    const postId = uuidv4();

    const params = {
        TableName: 'CommunityPosts',
        Item: { postId, username, photoUrl, comment }
    };

    dynamoClient.put(params, (err) => {
        if (err) return res.status(500).send('Error saving community post');
        res.send('Community post saved!');
    });
});

module.exports = router;