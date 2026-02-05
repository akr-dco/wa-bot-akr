const fetch = require('node-fetch');
const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const https = require('https');

const logDirToken = './token';
const logFileToken = path.join(logDirToken, 'auth_token.txt');

const logDirLogs = './logs';
const logFileLogs = path.join(logDirLogs, 'message_log.log');


let knownMessages = new Set();

async function getAuthenticationToken() {
  const authOptions = {
    hostname: 'jktdc-mfileapp.akr.co.id', // TANPA http://
    port: 80,
    path: '/REST/server/authenticationtokens',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const authBody = JSON.stringify({
    "Username": "AKRTechnology",
    "Password": "Akrjakarta123!",
    "VaultGuid": "{18E9C0F3-8D0-4229-857C-55C3CF5A0F0E}"
  });

  return new Promise((resolve, reject) => {
    const req = http.request(authOptions, res => {
      let data = '';

      res.on('data', chunk => data += chunk);

      res.on('end', async () => {
        console.log('🟢 Token raw response:', data);

        try {
          const parsed = JSON.parse(data);
          const token = parsed?.Value;

          if (!token) {
            console.error('❌ Token not found in response:', parsed);
            return reject('Token not found in response');
          }

          try {
            await fs.mkdir(logDirToken, { recursive: true });
            await fs.writeFile(logFileToken, token + '\n', 'utf-8');
            console.log('✅ Token saved to file:', logFileToken);
            resolve(token);
          } catch (err) {
            console.error('❌ Failed to write token to file:', err.message);
            reject(err);
          }

        } catch (e) {
          console.error('❌ Failed to parse JSON response:', e.message);
          reject('❌ Failed to parse token: ' + e.message);
        }
      });
    });

    req.on('error', err => {
      console.error('❌ Request error:', err.message);
      reject('❌ Error during request: ' + err.message);
    });

    req.write(authBody);
    req.end();
  });
}

// Loop 10 detik
setInterval(async () => {
  try {
    // Calling the API to get messages from WhatsApp.
    // Replace the URL and port below with your own configuration.
    const res = await fetch('http://192.168.150.150:3000/messages');
    const data = await res.json();

    if (!data.success || !data.messages) {
        console.error('❌ Failed to retrieve message data.');
      return;
    }

    const newMessages = data.messages.filter(msg => {
      const uniqueId = `${msg.timestamp}-${msg.from}`;
      return !knownMessages.has(uniqueId) && !msg.fromMe && msg.type == "chat" && !msg.isGroupMsg;
    });

    for (const msg of newMessages) {
      
      const uniqueId = `${msg.timestamp}-${msg.from}`;
      const logEntry = `[${new Date(msg.timestamp * 1000).toISOString()}] From: ${msg.from} (${msg.name || ''})\nMessage: ${msg.message}\n\n`;

      fs.appendFile(logFileLogs, logEntry, err => {
        if (err) console.error('❌ Gagal menulis ke file log:', err.message);
        else console.log(`📝 Pesan ditulis ke ${logFile}`);
      });

      knownMessages.add(uniqueId);

      const msgLower = msg.message.toLowerCase();
      const containsProvinsi = msgLower.includes("provinsi");
      const containsKeluhan = msgLower.includes("keluhan");

      if (containsProvinsi && containsKeluhan) { //check wheather the chat from customer contain provinsi, keluhan
        const message = msg.message;
        const provinsiMatch = message.match(/provinsi\s*:\s*(\d+)/i);
        const spbkpMatch = message.match(/SPBKB\s*:\s*(.+)/i);
        const spbkpText = spbkpMatch?.[1]?.trim();
        const keluhanMatch = message.match(/keluhan\s*:\s*(.+)/i);
        const keluhanText = keluhanMatch?.[1]?.trim();
        let provinsiId = null;

        if (provinsiMatch && provinsiMatch[1]) {
          provinsiId = parseInt(provinsiMatch[1], 10);
        }

        try 
        {
            let authToken = (await fs.readFile(logFileToken, 'utf-8')).trim();
            console.log('✅ Read Auth Token:', authToken);

            if (!authToken) {
              console.log('⚠️ Token kosong, ambil token baru...');
              authToken = await getAuthenticationToken();
            }

            // Log semua variabel penting
            console.log('🟡 msg:', msg);
            console.log('🟡 keluhanText:', keluhanText);
            console.log('🟡 provinsiId:', provinsiId);

            const requestBody = {
              PropertyValues: [
				//class
                { PropertyDef: 100, TypedValue: { DataType: 9, Lookup: { Item: 325, Version: -1 } } },
				//Date Raised
                { PropertyDef: 1486, TypedValue: { DataType: 5, Value: new Date(msg.timestamp * 1000).toISOString() } },
				//Raised By
                { PropertyDef: 1519, TypedValue: { DataType: 1, Value: msg.name } },
				//Phone No
                { PropertyDef: 1533, TypedValue: { DataType: 1, Value: msg.from } },
				//Issue
                { PropertyDef: 1543, TypedValue: { DataType: 13, Value: keluhanText } },
				//branch
                { PropertyDef: 2700, TypedValue: { DataType: 9, Lookup: { Item: provinsiId } } },
				//Cust type
                { PropertyDef: 1541, TypedValue: { DataType: 9, Lookup: { Item: 1 } } },
				//Cust incident type
                { PropertyDef: 1530, TypedValue: { DataType: 9, Lookup: { Item: 6 } } },
				
                { PropertyDef: 38, TypedValue: { DataType: 9, Lookup: { Item: 161 } } },
                { PropertyDef: 39, TypedValue: { DataType: 9, Lookup: { Item: 856 } } }
              ]
            };

            console.log('📦 Request Body:', JSON.stringify(requestBody, null, 2));

            const mfilesRes = await fetch('http://192.168.160.112/REST/objects/238', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Authentication': authToken
              },
              body: JSON.stringify(requestBody)
            });

            console.log('📡 M-Files response status:', mfilesRes.status);

            const text = await mfilesRes.text();
            console.log('📃 M-Files raw response:', text);

            let mfilesData = {};
            try {
              mfilesData = JSON.parse(text);
            } catch (parseErr) {
              console.error('❌ JSON parse error:', parseErr.message);
            }

            if (mfilesData.Status === 403) {
              authToken = await getAuthenticationToken();
              await fs.writeFile('./token/auth_token.txt', authToken, 'utf-8');
            }

            await fs.appendFile(logFileLogs, JSON.stringify(mfilesData, null, 2) + '\n');

            if (mfilesData && mfilesData.DisplayID && mfilesData.Title) {
              const autoReplyMessage = `✅ Terima kasih, keluhan anda telah kami terima dan akan segera ditindak lanjuti.`;

              await fetch('http://192.168.150.150:3000/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  number: msg.from,
                  message: autoReplyMessage
                })
              });
            } else {
              console.error('❌ The response from M-Files is invalid or incomplete.');
              await fs.appendFile(logFileLogs, '❌ The response from M-Files is invalid or incomplete. \n');

              const invalidFormatMessage = "*Format tidak tepat.*\n\nSilahkan input Provinsi dan detail keluhan anda *sesuai dengan format dibawah ini termasuk judul menu* :\n\nProvinsi : (Isi nomor Provinsi sesuai list dibawah)\nKeluhan : (detail keluhan dan cantumkan nomor SPBKB/SPBN)\n\nList no Provinsi\n1. Sumatera Utara\n2. Lampung\n3. DKI Jakarta\n4. Jawa Barat\n5. Jawa Tengah\n6. DIY\n7. Jawa Timur\n8. Kalimantan Barat\n9. Kalimantan Selatan\n10. Kalimantan Timur";

              await fetch('http://192.168.150.150:3000/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  number: msg.from,
                  message: invalidFormatMessage
                })
              });
            }

          } catch (err) {
            const errorMessage = `❌ Failed to send to M-Files: ${err?.message || JSON.stringify(err)}`;
            console.error(errorMessage);
            await fs.appendFile(logFileLogs, errorMessage + '\n');
          }

      } else {
        //format whatsapp
        const autoReplyMessage = "Silahkan input Provinsi dan detail keluhan anda *sesuai dengan format dibawah ini termasuk judul menu* :\n\nProvinsi : (Isi nomor Provinsi sesuai list dibawah)\nKeluhan : (detail keluhan dan cantumkan nomor SPBKB/SPBN)\n\nList no Provinsi\n1. Sumatera Utara\n2. Lampung\n3. DKI Jakarta\n4. Jawa Barat\n5. Jawa Tengah\n6. DIY\n7. Jawa Timur\n8. Kalimantan Barat\n9. Kalimantan Selatan\n10. Kalimantan Timur";

        try {
          // Calling the API to send messages from WhatsApp.
          // Replace the URL and port below with your own configuration.
          const replyRes = await fetch('http://192.168.150.150:3000/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: msg.from,
              message: autoReplyMessage
            })
          });

          const replyData = await replyRes.json();
          if (replyData.success) {
              console.log(`✅ Auto-reply successfully sent to ${msg.from}`);

              const responMessage = `✅ Auto-reply successfully sent to ${msg.from}`;

              fs.appendFile(logFileLogs, responMessage + '\n', (writeErr) => {
                if (writeErr) {
                  console.error('❌ Failed to write error to log file:', writeErr.message);
                }
              });
          } else {
              console.error(`❌ Failed to send auto-reply to ${msg.from}: ${replyData.error}`);

              const loErrorAutoReply = `❌ Failed to send auto-reply to ${msg.from}: ${replyData.error}`;

              fs.appendFile(logFileLogs, loErrorAutoReply + '\n', (writeErr) => {
                if (writeErr) {
                  console.error('❌ Failed to write error to log file:', writeErr.message);
                }
              });
          }
        } catch (sendErr) {
            console.error(`❌ Error while sending auto-reply: ${sendErr.message}`);

            const loErrorAutoReply2 = `❌ Error while sending auto-reply: ${sendErr.message}`;

            fs.appendFile(logFileLogs, loErrorAutoReply2 + '\n', (writeErr) => {
              if (writeErr) {
                console.error('❌ Failed to write error to log file:', writeErr.message);
              }
            });
        }
      }
    }

    if (newMessages.length > 0) {
        console.log(`✅ ${newMessages.length} new message is processed.`);
    }

  } catch (err) {
      console.error('❌ Fetch failed:', err.message);
  }
}, 10000); //runs every 10 seconds
