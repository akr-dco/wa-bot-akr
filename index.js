const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const recentMessages = [];
const MAX_MESSAGES = 50;
console.log("🚀 Starting WhatsApp client initialization...");

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

// QR Code
client.on('qr', (qr) => {
    console.log('Scan the following QR with WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('🔑 Authenticated event triggered! Session should be saved.');
});

client.on('ready', async () => {
    console.log('✅ The bot is ready to use!');
});

client.on('auth_failure', msg => {
    console.error('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('❌ Disconnected from WhatsApp:', reason);
});

client.initialize();
app.listen(3000, () => {
    console.log('🚀 The server is running on http://192.168.192.80:3000');
});

//Send whatsapp
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ error: 'number and message required' });
    }

    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

    try {
        await client.sendMessage(chatId, message);
        res.json({ success: true, message: 'Message successfully sent to number' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// get whatsapp
client.on('message', async (msg) => {
    const contact = await msg.getContact();
    const chat = await msg.getChat();

    recentMessages.unshift({
        from: contact.number,
        name: contact.pushname || contact.name || '',
        message: msg.body,
        chatName: chat.name,
        timestamp: msg.timestamp,
        fromMe: msg.fromMe,
        type: msg.type,
        IsGrouping: msg.isGroupMsg
    });

    if (recentMessages.length > MAX_MESSAGES) {
        recentMessages.pop();
    }
});

app.get('/messages', (req, res) => {
    res.json({
        success: true,
        messages: recentMessages
    });
});

require('./poller'); 

