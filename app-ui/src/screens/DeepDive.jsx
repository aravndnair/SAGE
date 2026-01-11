import { useEffect, useState, useRef } from 'react';
import { SCREENS, useApp } from '../state/appState';
import {
  deepdiveGetSession,
  deepdiveChat,
  deepdiveAddFile,
  deepdiveRemoveFile,
  deepdiveSearchFiles,
} from '../api/backend';
import '../theme/theme.css';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`deepdive-message ${isUser ? 'is-user' : 'is-assistant'}`}>
      <div className="deepdive-message-avatar">
        {isUser ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM6 8a6 6 0 1 1 12 0A6 6 0 0 1 6 8zm2 10a3 3 0 0 0-3 3 1 1 0 1 1-2 0 5 5 0 0 1 5-5h8a5 5 0 0 1 5 5 1 1 0 1 1-2 0 3 3 0 0 0-3-3H8z"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        )}
      </div>
      <div className="deepdive-message-content">
        <div className="deepdive-message-text">{message.content}</div>
      </div>
    </div>
  );
}

function FileChip({ file, onRemove }) {
  const filename = file.filename || file.path.split(/[/\\]/).pop();
  
  return (
    <div className="deepdive-file-chip">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5a2 2 0 0 0-.586-1.414l-3.5-3.5A2 2 0 0 0 14.5 2H4z"/>
      </svg>
      <span className="deepdive-file-name" title={file.path}>{filename}</span>
      <button className="deepdive-file-remove" onClick={() => onRemove(file.path)} title="Remove file">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z"/>
        </svg>
      </button>
    </div>
  );
}

function AddFileModal({ isOpen, onClose, onAddFile, existingPaths }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setSearching(true);
    try {
      const data = await deepdiveSearchFiles(query.trim());
      // Filter out files already in session
      const filtered = (data.results || []).filter(
        r => !existingPaths.includes(r.path)
      );
      setResults(filtered);
    } catch (err) {
      console.error('Search error:', err);
    }
    setSearching(false);
  };
  
  const handleSelect = (file) => {
    onAddFile(file.path);
    setResults(results.filter(r => r.path !== file.path));
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="deepdive-modal-backdrop" onClick={onClose}>
      <div className="deepdive-modal" onClick={e => e.stopPropagation()}>
        <div className="deepdive-modal-header">
          <h3>Add Files to DeepDive</h3>
          <button className="deepdive-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z"/>
            </svg>
          </button>
        </div>
        
        <form className="deepdive-modal-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search your indexed files..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
        
        <div className="deepdive-modal-results">
          {results.length === 0 && query && !searching && (
            <div className="deepdive-modal-empty">No files found</div>
          )}
          {results.map((file, idx) => (
            <div key={file.path || idx} className="deepdive-modal-result" onClick={() => handleSelect(file)}>
              <div className="deepdive-modal-result-name">{file.file}</div>
              <div className="deepdive-modal-result-snippet">{file.snippet}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DeepDive() {
  const { setScreen, deepdiveSessionId } = useApp();
  const [session, setSession] = useState(null);
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddFile, setShowAddFile] = useState(false);
  const [sources, setSources] = useState([]);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Load session data
  useEffect(() => {
    if (!deepdiveSessionId) {
      setScreen(SCREENS.SEARCH);
      return;
    }
    
    loadSession();
  }, [deepdiveSessionId]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const loadSession = async () => {
    setLoading(true);
    try {
      const data = await deepdiveGetSession(deepdiveSessionId);
      setSession(data.session);
      setFiles(data.files);
      setMessages(data.messages);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
    setLoading(false);
  };
  
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    
    const userMessage = input.trim();
    setInput('');
    setSending(true);
    
    // Optimistically add user message
    const tempUserMsg = { id: Date.now(), role: 'user', content: userMessage, timestamp: Date.now() / 1000 };
    setMessages(prev => [...prev, tempUserMsg]);
    
    try {
      const data = await deepdiveChat(deepdiveSessionId, userMessage);
      
      // Add assistant response
      const assistantMsg = { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: data.response, 
        timestamp: Date.now() / 1000 
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Store sources for reference
      if (data.sources) {
        setSources(data.sources);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: '⚠️ Failed to get response. Please try again.', 
        timestamp: Date.now() / 1000 
      };
      setMessages(prev => [...prev, errorMsg]);
    }
    
    setSending(false);
    inputRef.current?.focus();
  };
  
  const handleAddFile = async (filePath) => {
    try {
      await deepdiveAddFile(deepdiveSessionId, filePath);
      await loadSession(); // Reload to get updated files
    } catch (err) {
      console.error('Add file error:', err);
    }
  };
  
  const handleRemoveFile = async (filePath) => {
    if (files.length <= 1) {
      alert('Cannot remove the last file. A DeepDive session needs at least one file.');
      return;
    }
    
    try {
      await deepdiveRemoveFile(deepdiveSessionId, filePath);
      setFiles(files.filter(f => f.path !== filePath));
    } catch (err) {
      console.error('Remove file error:', err);
    }
  };
  
  const handleClose = () => {
    setScreen(SCREENS.SEARCH);
  };
  
  if (loading) {
    return (
      <div className="deepdive-loading">
        <div className="loader"></div>
        <p>Loading DeepDive session...</p>
      </div>
    );
  }
  
  return (
    <div className="deepdive-container">
      {/* Left Panel - Chat */}
      <div className="deepdive-chat-panel">
        <div className="deepdive-chat-header">
          <button className="deepdive-back-btn" onClick={handleClose} title="Back to Search">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10z" clipRule="evenodd"/>
            </svg>
          </button>
          <div className="deepdive-chat-title">
            <h2>{session?.title || 'DeepDive'}</h2>
            <span className="deepdive-file-count">{files.length} file{files.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        <div className="deepdive-messages">
          {messages.length === 0 ? (
            <div className="deepdive-empty">
              <div className="deepdive-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <h3>Start your DeepDive</h3>
              <p>Ask questions about your attached files. SAGE will search through them and provide grounded answers.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form className="deepdive-input-area" onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask about your files..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}>
            {sending ? (
              <div className="deepdive-sending-spinner"></div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.289z"/>
              </svg>
            )}
          </button>
        </form>
      </div>
      
      {/* Right Panel - Files */}
      <div className="deepdive-files-panel">
        <div className="deepdive-files-header">
          <h3>Attached Files</h3>
          <button className="deepdive-add-file-btn" onClick={() => setShowAddFile(true)}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5z"/>
            </svg>
            Add File
          </button>
        </div>
        
        <div className="deepdive-files-list">
          {files.map((file) => (
            <FileChip key={file.path} file={file} onRemove={handleRemoveFile} />
          ))}
        </div>
        
        {sources.length > 0 && (
          <div className="deepdive-sources">
            <h4>Last Query Sources</h4>
            <div className="deepdive-sources-list">
              {sources.map((src, idx) => (
                <div key={idx} className="deepdive-source-item">
                  <span className="deepdive-source-file">{src.file}</span>
                  <span className="deepdive-source-snippet">{src.snippet?.slice(0, 100)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="deepdive-info">
          <p>💡 DeepDive answers are grounded to only these files. No external knowledge is used.</p>
        </div>
      </div>
      
      {/* Add File Modal */}
      <AddFileModal
        isOpen={showAddFile}
        onClose={() => setShowAddFile(false)}
        onAddFile={handleAddFile}
        existingPaths={files.map(f => f.path)}
      />
    </div>
  );
}
