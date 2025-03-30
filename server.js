const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory databases (in a real app, these would be in a proper database)
const users = [];
const chats = {}; // Object to store chat history by user ID

// Data persistence functions
function saveData() {
    try {
        // Save users data
        fs.writeFileSync(
            path.join(__dirname, 'data', 'users.json'),
            JSON.stringify(users, null, 2)
        );
        
        // Save chats data
        fs.writeFileSync(
            path.join(__dirname, 'data', 'chats.json'),
            JSON.stringify(chats, null, 2)
        );
        
        console.log('Data saved successfully');
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

function loadData() {
    try {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(path.join(__dirname, 'data'))) {
            fs.mkdirSync(path.join(__dirname, 'data'));
        }
        
        // Load users data if file exists
        if (fs.existsSync(path.join(__dirname, 'data', 'users.json'))) {
            const userData = fs.readFileSync(
                path.join(__dirname, 'data', 'users.json'),
                'utf8'
            );
            users.push(...JSON.parse(userData));
        }
        
        // Load chats data if file exists
        if (fs.existsSync(path.join(__dirname, 'data', 'chats.json'))) {
            const chatData = fs.readFileSync(
                path.join(__dirname, 'data', 'chats.json'),
                'utf8'
            );
            Object.assign(chats, JSON.parse(chatData));
        }
        
        console.log('Data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Load existing data at startup
loadData();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '.')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Chat.html'));
});

// Sign up endpoint
app.post('/api/signup', (req, res) => {
    const { username, email, phone, password } = req.body;
    
    // Check if user already exists
    const userExists = users.some(user => 
        (email && user.email === email) || 
        (phone && user.phone === phone) ||
        user.username === username
    );
    
    if (userExists) {
        return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    // Create new user
    const newUser = {
        id: users.length + 1,
        username,
        email: email || null,
        phone: phone || null,
        password, // In a real app, this would be hashed
        created_at: new Date().toISOString()
    };
    
    users.push(newUser);
    
    // Initialize empty chat history for new user
    chats[newUser.id] = {
        contacts: [],
        conversations: {}
    };
    
    // Save data to file
    saveData();
    
    console.log('New user registered:', username);
    
    res.status(201).json({ 
        success: true, 
        message: 'Signup successful', 
        user: { 
            id: newUser.id, 
            username: newUser.username 
        } 
    });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    // Find user by email
    const user = users.find(user => user.email === email && user.password === password);
    
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    console.log('User logged in:', user.username);
    
    res.status(200).json({ 
        success: true, 
        message: 'Login successful', 
        user: { 
            id: user.id, 
            username: user.username 
        } 
    });
});

// Get user's chat history
app.get('/api/chats/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    
    // Check if user exists
    const user = users.find(user => user.id === userId);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Create user chat data if it doesn't exist
    if (!chats[userId]) {
        chats[userId] = {
            contacts: [],
            conversations: {}
        };
        saveData();
    }
    
    res.status(200).json({
        success: true,
        chats: chats[userId]
    });
});

// Send a message
app.post('/api/chats/message', (req, res) => {
    const { senderId, receiverId, content } = req.body;
    
    if (!senderId || !receiverId || !content) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Validate both users exist
    const sender = users.find(user => user.id === parseInt(senderId));
    const receiver = users.find(user => user.id === parseInt(receiverId));
    
    if (!sender || !receiver) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Create a unique conversation ID for this pair of users
    const conversationId = [parseInt(senderId), parseInt(receiverId)].sort().join('-');
    
    // Create message object
    const message = {
        id: Date.now(), // Simple unique ID
        senderId: parseInt(senderId),
        content,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    // Initialize chat data structures if they don't exist
    if (!chats[senderId]) {
        chats[senderId] = { contacts: [], conversations: {} };
    }
    
    if (!chats[receiverId]) {
        chats[receiverId] = { contacts: [], conversations: {} };
    }
    
    // Add users to each other's contacts if not already there
    if (!chats[senderId].contacts.includes(parseInt(receiverId))) {
        chats[senderId].contacts.push(parseInt(receiverId));
    }
    
    if (!chats[receiverId].contacts.includes(parseInt(senderId))) {
        chats[receiverId].contacts.push(parseInt(senderId));
    }
    
    // Initialize conversation if it doesn't exist
    if (!chats[senderId].conversations[conversationId]) {
        chats[senderId].conversations[conversationId] = [];
    }
    
    if (!chats[receiverId].conversations[conversationId]) {
        chats[receiverId].conversations[conversationId] = [];
    }
    
    // Add message to both users' conversation history
    chats[senderId].conversations[conversationId].push(message);
    chats[receiverId].conversations[conversationId].push(message);
    
    // Save data
    saveData();
    
    res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message
    });
});

// Mark messages as read
app.put('/api/chats/read', (req, res) => {
    const { userId, conversationId } = req.body;
    
    if (!userId || !conversationId) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Check if user and conversation exist
    if (!chats[userId] || !chats[userId].conversations[conversationId]) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    // Mark all messages not sent by this user as read
    chats[userId].conversations[conversationId].forEach(message => {
        if (message.senderId !== parseInt(userId)) {
            message.read = true;
        }
    });
    
    // Save data
    saveData();
    
    res.status(200).json({
        success: true,
        message: 'Messages marked as read'
    });
});

// Delete chat conversation
app.delete('/api/chats/:userId/:conversationId', (req, res) => {
    const { userId, conversationId } = req.params;
    
    // Check if user and conversation exist
    if (!chats[userId] || !chats[userId].conversations[conversationId]) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    // Delete conversation
    delete chats[userId].conversations[conversationId];
    
    // Save data
    saveData();
    
    res.status(200).json({
        success: true,
        message: 'Conversation deleted successfully'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});