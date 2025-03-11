const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const router = express.Router();
const path = require('path');

// AWS setup
const s3 = new S3Client({ region: process.env.AWS_REGION });
const ddb = DynamoDBDocumentClient.from(require('../db').dynamoClient);

// Multer setup for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/community.html'));
});

router.post('/submit', upload.single('photo'), async (req, res) => {
    const { comment } = req.body;
    const file = req.file;

    try {
        if (!file) return res.status(400).send('No image uploaded');

        const imageId = uuidv4();
        const key = `community/${imageId}-${file.originalname}`;

        // Upload to S3
        const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        await s3.send(new PutObjectCommand(s3Params));

        const imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        // Store in DynamoDB
        const dbParams = {
            TableName: 'CommunityPosts',
            Item: {
                imageId: imageUrl,
                comment,
                timestamp: new Date().toISOString()
            }
        };

        await ddb.send(new PutCommand(dbParams));

        res.send('Post uploaded successfully!');
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).send('Error uploading post');
    }
});

router.get('/posts', async (req, res) => {
    try {
        const dbParams = {
            TableName: 'CommunityPosts',
            Limit: 10,
            ScanIndexForward: false
        };

        const data = await ddb.send(new ScanCommand(dbParams));

        res.json(data.Items);
    } catch (err) {
        console.error('Error getting posts:', err);
        res.status(500).send('Error getting posts');
    }
});

module.exports = router;
