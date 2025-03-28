import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { nanoid } from 'nanoid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAllNotes, addNote, updateNote, deleteNote, importNotes, clearAllNotes } from './db';
import './App.css';

const NoteModal = memo(({ 
  isAdd, 
  onClose, 
  onSave, 
  initialTitle = '', 
  initialContent = '' 
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [showPreview, setShowPreview] = useState(true);

  const handleSave = useCallback(() => {
    if (!content.trim()) return;
    onSave(title, content);
  }, [title, content, onSave]);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isAdd ? 'Add Note' : 'Edit Note'}</div>
          <div className="modal-actions">
            <button
              className={`preview-toggle ${showPreview ? 'active' : ''}`}
              onClick={() => setShowPreview(!showPreview)}
              aria-label={showPreview ? 'Hide preview' : 'Show preview'}
            >
              👁️
            </button>
            <button
              className="modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        </div>
        <div className="modal-content">
          <div className={`modal-editor ${!showPreview ? 'full-width' : ''}`}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              className="modal-title-input"
            />
            <textarea
              className="modal-editor-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here... (Markdown supported)"
            />
          </div>
          {showPreview && (
            <div className="modal-preview">
              <div className="note-header">
                <div className="note-title">{title || 'Untitled'}</div>
              </div>
              <div className="modal-preview-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || 'Preview will appear here...'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            className="modal-button modal-button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="modal-button modal-button-primary"
            onClick={handleSave}
          >
            {isAdd ? 'Add Note' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
});

NoteModal.displayName = 'NoteModal';

const Note = memo(({ note, onTogglePin, onEdit, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const colorIndex = (note.id.charCodeAt(0) + note.id.charCodeAt(1)) % 5;

  return (
    <div
      className={`note color-${colorIndex} ${note.pinned ? 'pinned' : ''}`}
      style={{
        width: note.width + 'px',
        height: note.height + 'px',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`note-header ${isHovered ? 'show-actions' : ''}`}>
        <div className="note-title">{note.title}</div>
        <div className="note-actions">
          <button
            className={`pin-button ${note.pinned ? 'pinned' : ''}`}
            onClick={() => onTogglePin(note)}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          >
            📌
          </button>
          <button
            className="action-button edit-button"
            onClick={() => onEdit(note)}
            aria-label="Open note"
          >
            👁️
          </button>
          <button
            className="action-button delete-button"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete note"
          >
            ×
          </button>
        </div>
      </div>

      <div className="note-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {note.content}
        </ReactMarkdown>
      </div>

      {showDeleteConfirm && (
        <div className="delete-confirm">
          <p>Are you sure you want to delete this note?</p>
          <div className="delete-confirm-buttons">
            <button
              className="confirm-button confirm-delete"
              onClick={() => onDelete(note.id)}
            >
              Delete
            </button>
            <button
              className="confirm-button confirm-cancel"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

Note.displayName = 'Note';

function App() {
  const [notes, setNotes] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef(null);

  const loadNotes = useCallback(async () => {
    const loadedNotes = await getAllNotes();
    const sortedNotes = loadedNotes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
    setNotes(sortedNotes);
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  function calculateNoteSize(content) {
    const length = content.length;
    let width, height;
    
    if (length < 100) {
      width = 300;
      height = 200;
    } else if (length < 300) {
      width = 350;
      height = 250;
    } else {
      width = 400;
      height = 300;
    }

    width += Math.floor(Math.random() * 50);
    height += Math.floor(Math.random() * 50);

    return { width, height };
  }

  const handleAddNote = useCallback(async (title, content) => {
    const size = calculateNoteSize(content);
    const newNote = {
      id: nanoid(),
      title: title || 'Untitled',
      content,
      pinned: false,
      ...size
    };

    await addNote(newNote);
    setShowAddModal(false);
    loadNotes();
  }, [loadNotes]);

  const handleSaveEdit = useCallback(async (title, content) => {
    if (!editingNote) return;

    const size = calculateNoteSize(content);
    const updatedNote = {
      ...editingNote,
      title,
      content,
      ...size
    };

    await updateNote(updatedNote);
    setEditingNote(null);
    loadNotes();
  }, [editingNote, loadNotes]);

  const handleTogglePin = useCallback(async (note) => {
    const updatedNote = { ...note, pinned: !note.pinned };
    await updateNote(updatedNote);
    loadNotes();
  }, [loadNotes]);

  const handleDeleteNote = useCallback(async (id) => {
    await deleteNote(id);
    loadNotes();
  }, [loadNotes]);

  const handleExport = useCallback(async () => {
    const allNotes = await getAllNotes();
    const dataStr = JSON.stringify(allNotes, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sticky-notes-backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setShowOptions(false);
  }, []);

  const handleImport = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedNotes = JSON.parse(text);
      
      await clearAllNotes();
      await importNotes(importedNotes);
      await loadNotes();
      
      setShowOptions(false);
      event.target.value = null;
    } catch (error) {
      console.error('Error importing notes:', error);
      alert('Error importing notes. Please check the file format.');
    }
  }, [loadNotes]);

  const pinnedNotes = notes.filter(note => note.pinned);
  const unpinnedNotes = notes.filter(note => !note.pinned);

  return (
    <div className="app">
      <div className="top-bar">
        <button 
          className="add-note-button"
          onClick={() => setShowAddModal(true)}
          aria-label="Add new note"
        >
          +
        </button>

        <div className="options-container">
          <button
            className="options-button"
            onClick={() => setShowOptions(!showOptions)}
            aria-label="Options menu"
          >
            ⚙️
          </button>
          {showOptions && (
            <div className="options-menu">
              <button onClick={handleExport}>
                Export Notes
              </button>
              <button onClick={() => fileInputRef.current?.click()}>
                Import Notes
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="notes-sections">
        {pinnedNotes.length > 0 && (
          <div className="notes-section">
            <h2 className="section-title">📌 Pinned Notes</h2>
            <div className="notes-container">
              {pinnedNotes.map((note) => (
                <Note
                  key={note.id}
                  note={note}
                  onTogglePin={handleTogglePin}
                  onEdit={setEditingNote}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          </div>
        )}

        <div className="notes-section">
          {pinnedNotes.length > 0 && <h2 className="section-title">Other Notes</h2>}
          <div className="notes-container">
            {unpinnedNotes.map((note) => (
              <Note
                key={note.id}
                note={note}
                onTogglePin={handleTogglePin}
                onEdit={setEditingNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        </div>
      </div>

      {showAddModal && (
        <NoteModal
          isAdd={true}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddNote}
        />
      )}
      {editingNote && (
        <NoteModal
          isAdd={false}
          onClose={() => setEditingNote(null)}
          onSave={handleSaveEdit}
          initialTitle={editingNote.title}
          initialContent={editingNote.content}
        />
      )}
    </div>
  );
}

export default App;