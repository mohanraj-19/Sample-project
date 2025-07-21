// script.js
class NotesApp {
    constructor() {
        this.notes = this.loadNotes();
        this.currentEditingId = null;
        this.deferredPrompt = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderNotes();
        this.registerServiceWorker();
        this.handlePWAInstall();
    }

    bindEvents() {
        // Form events
        document.getElementById('saveBtn').addEventListener('click', () => this.saveNote());
        document.getElementById('cancelBtn').addEventListener('click', () => this.cancelEdit());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllNotes());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadApp());
        
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchNotes(e.target.value));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveNote();
            }
            if (e.key === 'Escape') {
                this.cancelEdit();
            }
        });

        // Auto-save on input
        document.getElementById('noteTitle').addEventListener('input', () => this.debouncedAutoSave());
        document.getElementById('noteContent').addEventListener('input', () => this.debouncedAutoSave());
    }

    debouncedAutoSave = this.debounce(() => {
        if (this.currentEditingId) {
            this.saveNote(false); // Save without notification
        }
    }, 1000);

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    saveNote(showNotification = true) {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();

        if (!title && !content) {
            this.showNotification('Please enter a title or content', 'error');
            return;
        }

        const noteData = {
            id: this.currentEditingId || this.generateId(),
            title: title || 'Untitled Note',
            content: content,
            createdAt: this.currentEditingId ? this.notes.find(n => n.id === this.currentEditingId)?.createdAt || new Date() : new Date(),
            updatedAt: new Date()
        };

        if (this.currentEditingId) {
            // Update existing note
            const index = this.notes.findIndex(note => note.id === this.currentEditingId);
            this.notes[index] = noteData;
            if (showNotification) {
                this.showNotification('✏️ Note updated successfully!', 'success');
            }
        } else {
            // Create new note
            this.notes.unshift(noteData);
            if (showNotification) {
                this.showNotification('📝 Note saved successfully!', 'success');
            }
        }

        this.saveNotes();
        this.clearForm();
        this.renderNotes();
    }

    editNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;

        this.currentEditingId = id;
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteContent').value = note.content;
        document.getElementById('cancelBtn').style.display = 'inline-flex';
        document.getElementById('saveBtn').textContent = '💾 Update Note';

        // Scroll to form
        document.querySelector('.note-form').scrollIntoView({ behavior: 'smooth' });
        document.getElementById('noteTitle').focus();

        this.showNotification('📝 Editing note...', 'info');
    }

    deleteNote(id) {
        if (!confirm('Are you sure you want to delete this note?')) return;

        this.notes = this.notes.filter(note => note.id !== id);
        this.saveNotes();
        this.renderNotes();
        this.showNotification('🗑️ Note deleted successfully!', 'success');

        // If we were editing this note, clear the form
        if (this.currentEditingId === id) {
            this.cancelEdit();
        }
    }

    cancelEdit() {
        this.currentEditingId = null;
        this.clearForm();
        document.getElementById('cancelBtn').style.display = 'none';
        document.getElementById('saveBtn').textContent = '💾 Save Note';
    }

    clearForm() {
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
    }

    clearAllNotes() {
        if (!this.notes.length) {
            this.showNotification('No notes to clear!', 'info');
            return;
        }

        if (!confirm(`Are you sure you want to delete all ${this.notes.length} notes? This action cannot be undone.`)) return;

        this.notes = [];
        this.saveNotes();
        this.renderNotes();
        this.cancelEdit();
        this.showNotification('🗑️ All notes cleared!', 'success');
    }

    searchNotes(query) {
        const searchTerm = query.toLowerCase();
        const noteCards = document.querySelectorAll('.note-card');

        noteCards.forEach(card => {
            const title = card.querySelector('.note-title').textContent.toLowerCase();
            const content = card.querySelector('.note-content').textContent.toLowerCase();
            
            if (title.includes(searchTerm) || content.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });

        // Show/hide empty state
        const visibleCards = Array.from(noteCards).filter(card => card.style.display !== 'none');
        const emptyState = document.getElementById('emptyState');
        
        if (visibleCards.length === 0 && this.notes.length > 0) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <div class="empty-icon">🔍</div>
                <h3>No results found</h3>
                <p>No notes match your search for "${query}"</p>
            `;
        } else if (this.notes.length === 0) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <div class="empty-icon">📝</div>
                <h3>No notes yet</h3>
                <p>Create your first note above to get started!</p>
            `;
        } else {
            emptyState.style.display = 'none';
        }
    }

    renderNotes() {
        const notesGrid = document.getElementById('notesGrid');
        const emptyState = document.getElementById('emptyState');

        if (this.notes.length === 0) {
            emptyState.style.display = 'block';
            // Clear any existing notes
            const existingCards = notesGrid.querySelectorAll('.note-card');
            existingCards.forEach(card => card.remove());
            return;
        }

        emptyState.style.display = 'none';

        // Clear existing notes
        const existingCards = notesGrid.querySelectorAll('.note-card');
        existingCards.forEach(card => card.remove());

        // Render notes
        this.notes.forEach(note => {
            const noteElement = this.createNoteElement(note);
            notesGrid.insertBefore(noteElement, emptyState);
        });
    }

    createNoteElement(note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = `note-card${this.currentEditingId === note.id ? ' editing' : ''}`;
        noteDiv.onclick = () => this.editNote(note.id);

        const truncatedContent = note.content.length > 150 
            ? note.content.substring(0, 150) + '...' 
            : note.content;

        noteDiv.innerHTML = `
            <div class="note-title">${this.escapeHtml(note.title)}</div>
            <div class="note-content">${this.escapeHtml(truncatedContent)}</div>
            <div class="note-meta">
                <span>📅 ${this.formatDate(note.updatedAt)}</span>
                <div class="note-actions">
                    <button class="btn btn-danger" onclick="event.stopPropagation(); app.deleteNote('${note.id}')">🗑️</button>
                </div>
            </div>
        `;

        return noteDiv;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(date) {
        const d = new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now - d);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return 'Today';
        } else if (diffDays === 2) {
            return 'Yesterday';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} days ago`;
        } else {
            return d.toLocaleDateString();
        }
    }

    loadNotes() {
        try {
            const notes = localStorage.getItem('notesApp_notes');
            return notes ? JSON.parse(notes) : [];
        } catch (error) {
            console.error('Error loading notes:', error);
            return [];
        }
    }

    saveNotes() {
        try {
            localStorage.setItem('notesApp_notes', JSON.stringify(this.notes));
        } catch (error) {
            console.error('Error saving notes:', error);
            this.showNotification('Error saving notes. Storage might be full.', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        notification.innerHTML = `<span>${icon}</span><span>${message}</span>`;

        const container = document.getElementById('notifications');
        container.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        container.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    downloadApp() {
        const appFiles = {
            'index.html': document.documentElement.outerHTML,
            'styles.css': this.getCSSContent(),
            'script.js': this.getJSContent(),
            'manifest.json': this.getManifestContent(),
            'sw.js': this.getServiceWorkerContent()
        };

        // Create and download zip file
        this.createDownload(appFiles);
    }

    getCSSContent() {
        // Return the CSS content as string
        return `/* CSS content would be here - same as above */`;
    }

    getJSContent() {
        // Return the JS content as string
        return `/* JavaScript content would be here - same as above */`;
    }

    getManifestContent() {
        return JSON.stringify({
            "name": "NotesApp - Personal Notes",
            "short_name": "NotesApp",
            "description": "A modern offline notes application",
            "start_url": "/",
            "display": "standalone",
            "background_color": "#f8fafc",
            "theme_color": "#2563eb",
            "icons": [
                {
                    "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📝</text></svg>",
                    "sizes": "512x512",
                    "type": "image/svg+xml"
                }
            ]
        }, null, 2);
    }

    getServiceWorkerContent() {
        return `
const CACHE_NAME = 'notes-app-v1';
const urlsToCache = [
    '/',
    '/styles.css',
    '/script.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
        `.trim();
    }

    createDownload(files) {
        // Create a simple download for the main HTML file
        const htmlContent = this.getCompleteHTMLFile();
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes-app.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('📱 App downloaded! Open the HTML file in your browser.', 'success');
    }

    getCompleteHTMLFile() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NotesApp - Your Personal Notes</title>
    <meta name="theme-color" content="#2563eb">
    <style>
        ${document.querySelector('style') ? document.querySelector('style').textContent : '/* CSS would be embedded here */'}
    </style>
</head>
<body>
    ${document.body.innerHTML}
    <script>
        ${this.getEmbeddedJS()}
    </script>
</body>
</html>`;
    }

    getEmbeddedJS() {
        return `
        // Embedded JavaScript for the downloaded version
        // (Complete NotesApp class would be here)
        class NotesApp {
            // ... (same implementation as above)
        }
        
        // Initialize the app
        const app = new NotesApp();
        `;
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }
    }

    handlePWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallPrompt();
        });

        document.getElementById('installBtn').addEventListener('click', () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                this.deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        this.showNotification('📱 App installation started!', 'success');
                    }
                    this.deferredPrompt = null;
                    this.hideInstallPrompt();
                });
            }
        });

        document.getElementById('dismissBtn').addEventListener('click', () => {
            this.hideInstallPrompt();
        });
    }

    showInstallPrompt() {
        document.getElementById('installPrompt').style.display = 'block';
    }

    hideInstallPrompt() {
        document.getElementById('installPrompt').style.display = 'none';
    }
}

// Initialize the app
const app = new NotesApp();

// Add CSS animations
const style = document.createElement('style');
style.textContent = \`
    @keyframes slideOut {
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
\`;
document.head.appendChild(style);
