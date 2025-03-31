const { dynamoClient } = require('./db');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const AWS = require('aws-sdk');
require('dotenv').config();

const ses = new AWS.SES({ 
    region: 'us-west-2',
    credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY
    },
    apiVersion: '2010-12-01'
});

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
    region: 'us-west-2',
    credentials: {
        accessKeyId: process.env.COGNITO_AWS_ID,
        secretAccessKey: process.env.COGNITO_AWS_ACCESS_KEY
    }
});

const listAllUsers = () => {
    const params = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Limit: 60,
    };

    return new Promise((resolve, reject) => {
        let users = [];
        let data;
        const fetchUsers = async () => {
            try {
                do {
                    data = await cognitoIdentityServiceProvider.listUsers(params).promise();
                    users = users.concat(data.Users);
                    if (data.PaginationToken) {
                        params.PaginationToken = data.PaginationToken; 
                    }
                } while (data.PaginationToken);
                resolve(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                reject(error);
            }
        };

        fetchUsers();
    });
};

// Function to fetch all records from DynamoDB table
const fetchAllRecords = (tableName) => {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: tableName
        };
        let items = [];
        let lastEvaluatedKey = null;

        const scanRecords = async () => {
            try {
                do {
                    if (lastEvaluatedKey) {
                        params.ExclusiveStartKey = lastEvaluatedKey; 
                    }

                    const data = await dynamoClient.send(new ScanCommand(params));
                    items = items.concat(data.Items);
                    lastEvaluatedKey = data.LastEvaluatedKey; 
                } while (lastEvaluatedKey);
                console.log(`Fetched ${items.length} records from table: ${tableName}`);
                resolve(items);
            } catch (error) {
                console.error('Error scanning DynamoDB:', error);
                reject(error);
            }
        };

        scanRecords();
    });
};

const isNextDay = (reminderDate) => {
    return new Promise((resolve) => {
        const today = new Date();
        const nextDay = new Date(today);
        nextDay.setDate(today.getDate() + 1); 

        const reminderDateObj = new Date(reminderDate);
        reminderDateObj.setHours(0, 0, 0, 0); 

        nextDay.setHours(0, 0, 0, 0);

        console.log('Reminder Date:', reminderDateObj);
        console.log('Next Day:', nextDay);

        resolve(reminderDateObj.getTime() === nextDay.getTime());
    });
};

const getUsersAndEmails = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const users = await listAllUsers();
            resolve(users.map(user => ({
                userid: user.Attributes.find(attr => attr.Name === 'sub')?.Value,
                email: user.Attributes.find(attr => attr.Name === 'email')?.Value
            })));
        } catch (err) {
            console.error('Failed to fetch all user data:', err);
            reject(err);
        }
    });
};

const sendReminderEmails = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const items = await fetchAllRecords('PetPal');
            const users = await getUsersAndEmails();

            const sendEmails = items.map(item => {
                return new Promise((resolveItem, rejectItem) => {
                    const user = users.find(user => user.userid === item.userId);
                    if (user) {
                        item.reminders.forEach(async reminder => {
                            if (await isNextDay(reminder.reminderDate)) {
                                console.log(`Sending reminder email for: ${reminder.reminderType}`);

                                const params = {
                                    Destination: {
                                        CcAddresses: [],
                                        ToAddresses: [user.email],
                                    },
                                    Message: {
                                        Body: {
                                            Html: {
                                                Charset: "UTF-8",
                                                Data: `
                                                    <html>
                                                    <body>
                                                        <p>Hello,</p>
                                                        <p>You have the following reminder for tomorrow:</p>
                                                        <ul>
                                                            <li><strong>Reminder Type:</strong> ${reminder.reminderType}</li>
                                                            <li><strong>Reminder Time:</strong> ${reminder.reminderTime}</li>
                                                            <li><strong>Description:</strong> ${reminder.reminderDescription}</li>
                                                        </ul>
                                                        <p>Please make sure to take action on this reminder.</p>
                                                        <p>Best regards,<br>Your Reminder Service</p>
                                                    </body>
                                                    </html>
                                            `,
                                            },
                                            Text: {
                                                Charset: "UTF-8",
                                                Data: `
                                                    Hello,
                                                    
                                                    You have the following reminder for tomorrow:

                                                    Reminder Type: ${reminder.reminderType}
                                                    Reminder Time: ${reminder.reminderTime}
                                                    Description: ${reminder.reminderDescription}

                                                    Please make sure to take action on this reminder.

                                                    Best regards,
                                                    Your Reminder Service
                                                `,
                                            },
                                        },
                                        Subject: {
                                            Charset: "UTF-8",
                                            Data: `Reminder: ${reminder.reminderType}`,
                                        },
                                    },
                                    Source: "donotreply.petpal@gmail.com",
                                    ReplyToAddresses: [
                                        "donotreply.petpal@gmail.com",
                                    ],
                                };

                                ses.sendEmail(params).promise()
                                    .then(data => {
                                        console.log(data.MessageId);
                                        resolveItem();
                                    })
                                    .catch(err => {
                                        console.error(err, err.stack);
                                        rejectItem(err);
                                    });
                            }
                        });
                    }
                });
            });

            // Wait for all email promises to be resolved
            Promise.all(sendEmails)
                .then(() => {
                    resolve('Reminder emails sent successfully');
                })
                .catch(reject);
        } catch (error) {
            console.error('Error sending reminder emails:', error);
            reject(error);
        }
    });
};

// module.exports.handler = async (event) => {
//     await sendReminderEmails();
//     const response = {
//       statusCode: 200,
//       body: JSON.stringify('Hello from Lambda!'),
//     };
//     return response;
// };


module.exports = { sendReminderEmails };