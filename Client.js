// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Login and signup form handling
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('Log In', handleLogin);
    }
    
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('Sign Up', handleSignup);
    }
    
    // Chat elements
    setupChatFunctionality();
    
    // Load user data from localStorage if it exists
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (userData) {
        // Auto-login if we have user data
        loadUserChats(userData.id);
    }
});

// Auth functions
async function handleSignup(e) {
    e.preventDefault();
    
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, phone, password })
        });

        const data = await response.json();
        
        if (data.success) {
            // Store user data in localStorage
            localStorage.setItem('userData', JSON.stringify(data.user));
            
            // Redirect to chat page
            window.location.href = '/';
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('An error occurred during signup. Please try again.');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (data.success) {
            // Store user data in localStorage
            localStorage.setItem('userData', JSON.stringify(data.user));
            
            // Redirect to chat page
            window.location.href = '/';
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login. Please try again.');
    }
}

function logout() {
    // Clear user data from localStorage
    localStorage.removeItem('userData');
    
    // Redirect to login page
    window.location.href = '/login.html';
}

// Chat functionality
async function loadUserChats(userId) {
    try {
        const response = await fetch(`/api/chats/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            // Display the user's contacts and conversations
            displayChats(data.chats);
        } else {
            console.error('Failed to load chats:', data.message);
        }
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

function displayChats(chatData) {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;
    
    // Clear existing chat list
    chatList.innerHTML = '';
    
    // Get user info for contacts
    const contacts = chatData.contacts;
    const conversations = chatData.conversations;
    
    // Create HTML for each contact/conversation
    contacts.forEach(contactId => {
        // Find the conversation with this contact
        const conversationId = Object.keys(conversations).find(
            convId => convId.split('-').includes(contactId.toString())
        );
        
        if (!conversationId || !conversations[conversationId].length) return;
        
        // Get the last message in the conversation
        const lastMessage = conversations[conversationId][conversations[conversationId].length - 1];
        
        // Count unread messages
        const unreadCount = conversations[conversationId].filter(
            msg => msg.senderId === contactId && !msg.read
        ).length;
        
        // Format timestamp
        const timestamp = new Date(lastMessage.timestamp);
        const timeString = formatTime(timestamp);
        
        // Create chat item HTML
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = contactId;
        chatItem.dataset.conversationId = conversationId;
        
        chatItem.innerHTML = `
            <div class="chat-avatar">C</div>
            <div class="chat-info">
                <div class="chat-name">Contact ${contactId}</div>
                <div class="chat-preview">${lastMessage.content}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${timeString}</div>
                ${unreadCount ? `<div class="chat-unread">${unreadCount}</div>` : ''}
            </div>
        `;
        
        // Add click event to load conversation
        chatItem.addEventListener('click', () => {
            loadConversation(conversationId, contactId);
            markMessagesAsRead(conversationId);
            
            // Update active class
            document.querySelectorAll('.chat-item').forEach(item => {
                item.classList.remove('active');
            });
            chatItem.classList.add('active');
        });
        
        chatList.appendChild(chatItem);
    });
}

async function loadConversation(conversationId, contactId) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData) return;
    
    try {
        const response = await fetch(`/api/chats/${userData.id}`);
        const data = await response.json();
        
        if (data.success) {
            // Get the conversation
            const conversation = data.chats.conversations[conversationId];
            if (!conversation) return;
            
            // Display the conversation
            displayConversation(conversation, userData.id);
            
            // Update contact name in header
            document.getElementById('currentChatName').textContent = `Contact ${contactId}`;
        } else {
            console.error('Failed to load conversation:', data.message);
        }
    } catch (error) {
        console.error('Error loading conversation:', error);
    }
}

function displayConversation(messages, currentUserId) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    // Clear existing messages
    messagesContainer.innerHTML = '';
    
    // Group messages by date
    const messagesByDate = groupMessagesByDate(messages);
    
    // Display messages by date
    Object.keys(messagesByDate).forEach(date => {
        // Add date separator
        const dateElement = document.createElement('div');
        dateElement.className = 'message-timestamp';
        dateElement.textContent = date;
        messagesContainer.appendChild(dateElement);
        
        // Add messages for this date
        messagesByDate[date].forEach(message => {
            const isSent = message.senderId.toString() === currentUserId.toString();
            
            const messageElement = document.createElement('div');
            messageElement.className = `message message-${isSent ? 'sent' : 'received'}`;
            
            const time = new Date(message.timestamp);
            const timeString = `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`;
            
            messageElement.innerHTML = `
                <div class="message-content">
                    ${message.content}
                </div>
                <div class="message-meta">
                    <span>${timeString}</span>
                    ${isSent ? `<span class="message-status">${message.read ? '✓✓' : '✓'}</span>` : ''}
                </div>
            `;
            
            messagesContainer.appendChild(messageElement);
        });
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function groupMessagesByDate(messages) {
    const groups = {};
    
    messages.forEach(message => {
        const date = new Date(message.timestamp);
        const dateString = formatDate(date);
        
        if (!groups[dateString]) {
            groups[dateString] = [];
        }
        
        groups[dateString].push(message);
    });
    
    return groups;
}

async function sendNewMessage(content) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData) return;
    
    // Get active conversation
    const activeChat = document.querySelector('.chat-item.active');
    if (!activeChat) return;
    
    const receiverId = activeChat.dataset.chatId;
    const conversationId = activeChat.dataset.conversationId;
    
    try {
        const response = await fetch('/api/chats/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: userData.id,
                receiverId,
                content
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload the conversation to show the new message
            loadConversation(conversationId, receiverId);
            
            // Update chat preview in the chat list
            const chatPreview = activeChat.querySelector('.chat-preview');
            if (chatPreview) {
                chatPreview.textContent = content;
            }
            
            // Update timestamp
            const chatTime = activeChat.querySelector('.chat-time');
            if (chatTime) {
                chatTime.textContent = 'Just now';
            }
        } else {
            console.error('Failed to send message:', data.message);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

async function markMessagesAsRead(conversationId) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData) return;
    
    try {
        await fetch('/api/chats/read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userData.id,
                conversationId
            })
        });
        
        // Remove unread indicator
        const activeChat = document.querySelector('.chat-item.active');
        if (activeChat) {
            const unreadIndicator = activeChat.querySelector('.chat-unread');
            if (unreadIndicator) {
                unreadIndicator.remove();
            }
        }
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

async function deleteConversation(conversationId) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData) return;
    
    if (!confirm('Are you sure you want to delete this conversation?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/chats/${userData.id}/${conversationId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload user chats
            loadUserChats(userData.id);
            
            // Clear messages container
            const messagesContainer = document.getElementById('messagesContainer');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
            
            // Reset chat name
            document.getElementById('currentChatName').textContent = 'Select a chat';
        } else {
            console.error('Failed to delete conversation:', data.message);
        }
    } catch (error) {
        console.error('Error deleting conversation:', error);
    }
}

// Helper functions
function formatDate(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString();
    }
}

function formatTime(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString();
    }
}

function setupChatFunctionality() {
    // Message sending functionality
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (messageInput && sendButton) {
        // Send message on button click
        sendButton.addEventListener('click', () => {
            const content = messageInput.value.trim();
            if (content) {
                sendNewMessage(content);
                messageInput.value = '';
            }
        });
        
        // Send message on Enter key
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const content = messageInput.value.trim();
                if (content) {
                    sendNewMessage(content);
                    messageInput.value = '';
                }
            }
        });
    }
    
    // Info button for conversation actions
    const infoButton = document.getElementById('infoButton');
    if (infoButton) {
        infoButton.addEventListener('click', () => {
            const activeChat = document.querySelector('.chat-item.active');
            if (activeChat) {
                const conversationId = activeChat.dataset.conversationId;
                
                // Create and show context menu
                const contextMenu = document.getElementById('contextMenu') || document.createElement('div');
                contextMenu.id = 'contextMenu';
                contextMenu.className = 'context-menu';
                contextMenu.innerHTML = `
                    <div class="context-menu-item" id="deleteConversation">
                        <span class="context-menu-icon">🗑️</span>
                        <span>Delete Conversation</span>
                    </div>
                `;
                
                // Position the menu
                const rect = infoButton.getBoundingClientRect();
                contextMenu.style.top = `${rect.bottom + 5}px`;
                contextMenu.style.right = `${window.innerWidth - rect.right}px`;
                contextMenu.style.display = 'block';
                
                // Add to body if not already there
                if (!document.getElementById('contextMenu')) {
                    document.body.appendChild(contextMenu);
                }
                
                // Add delete event listener
                document.getElementById('deleteConversation').addEventListener('click', () => {
                    deleteConversation(conversationId);
                    contextMenu.style.display = 'none';
                });
                
                // Close menu when clicking outside
                document.addEventListener('click', function closeMenu(e) {
                    if (!contextMenu.contains(e.target) && e.target !== infoButton) {
                        contextMenu.style.display = 'none';
                        document.removeEventListener('click', closeMenu);
                    }
                });
            }
        });
    }
    
    // User menu functionality
    const userMenuButton = document.getElementById('userMenuButton');
    if (userMenuButton) {
        userMenuButton.addEventListener('click', () => {
            // Create and show user menu
            const userMenu = document.getElementById('userMenu') || document.createElement('div');
            userMenu.id = 'userMenu';
            userMenu.className = 'context-menu';
            userMenu.innerHTML = `
                <div class="context-menu-item" id="logoutButton">
                    <span class="context-menu-icon">🚪</span>
                    <span>Logout</span>
                </div>
            `;
            
            // Position the menu
            const rect = userMenuButton.getBoundingClientRect();
            userMenu.style.top = `${rect.bottom + 5}px`;
            userMenu.style.right = `${window.innerWidth - rect.right}px`;
            userMenu.style.display = 'block';
            
            // Add to body if not already there
            if (!document.getElementById('userMenu')) {
                document.body.appendChild(userMenu);
            }
            
            // Add logout event listener
            document.getElementById('logoutButton').addEventListener('click', logout);
            
            // Close menu when clicking outside
            document.addEventListener('click', function closeMenu(e) {
                if (!userMenu.contains(e.target) && e.target !== userMenuButton) {
                    userMenu.style.display = 'none';
                    document.removeEventListener('click', closeMenu);
                }
            });
        });
    }
}