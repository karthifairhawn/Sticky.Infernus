import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { nanoid } from 'nanoid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import { getAllNotes, addNote, updateNote, deleteNote, importNotes, clearAllNotes } from './db';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { duotoneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

import './App.css';
import 'react-resizable/css/styles.css';

const NoteModal = memo(({
	isAdd,
	onClose,
	onSave,
	initialTitle = '',
	initialContent = '',
	initialShowPreview = true
}) => {
	const [title, setTitle] = useState(initialTitle);
	const [content, setContent] = useState(initialContent);
	const [showPreview, setShowPreview] = useState(initialShowPreview);

	useEffect(() => {
		const savedPreviewState = localStorage.getItem('notePreviewState');
		if (savedPreviewState !== null) {
			setShowPreview(JSON.parse(savedPreviewState));
		}
	}, []);

	const handlePreviewToggle = useCallback(() => {
		const newState = !showPreview;
		setShowPreview(newState);
		localStorage.setItem('notePreviewState', JSON.stringify(newState));
	}, [showPreview]);

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
							onClick={handlePreviewToggle}
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




const ContextMenu = memo(({ x, y, onEdit, onDelete, onClose }) => {
	const menuRef = useRef(null);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (menuRef.current && !menuRef.current.contains(event.target)) {
				onClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [onClose]);

	return (
		<div
			ref={menuRef}
			className="context-menu"
			style={{ left: x, top: y }}
		>
			<div className="context-menu-item" onClick={onEdit}>
				✏️ Edit
			</div>
			<div className="context-menu-item" onClick={onDelete}>
				🗑️ Delete
			</div>
		</div>
	);
});

ContextMenu.displayName = 'ContextMenu';

const Note = memo(({ note, onTogglePin, onEdit, onDelete, onResize, onDragStop, isOrganized }) => {
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [contextMenu, setContextMenu] = useState(null);
	const colorIndex = (note.id.charCodeAt(0) + note.id.charCodeAt(1)) % 5;
  
	const handleContextMenu = (e) => {
	  e.preventDefault();
	  const containerRect = e.currentTarget.getBoundingClientRect();
	  const x = e.clientX - containerRect.left;
	  const y = e.clientY - containerRect.top;
	  setContextMenu({ x, y });
	};
  
	const handleResize = (e, { size }) => {
	  onResize(note.id, size);
	};
  
	const noteContent = (
	  <div
		className={`note color-${colorIndex} ${note.pinned ? 'pinned' : ''}`}
		style={{
		  width: isOrganized ? '100%' : `${note.width}px`,
		  height: isOrganized ? 'auto' : `${note.height}px`,
		  minHeight: '200px',
		}}
		onMouseEnter={() => setIsHovered(true)}
		onMouseLeave={() => setIsHovered(false)}
		onContextMenu={handleContextMenu}
	  >
		<div className={`note-header ${isHovered ? 'show-actions' : ''}`}>
		  <div className="note-title">{note.title}</div>
		  <div className="note-actions">
			{isOrganized && (
			  <button
				className={`pin-button ${note.pinned ? 'pinned' : ''}`}
				onClick={() => onTogglePin(note)}
				aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
			  >
				📌
			  </button>
			)}
			<button
			  className="action-button edit-button"
			  onClick={() => onEdit(note)}
			  aria-label="Open note"
			>
			  Edit
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
		  <ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
			  code({ node, inline, className, children, ...props }) {
				const match = /language-(\w+)/.exec(className || '');
				const [copied, setCopied] = useState(false);
  
				const handleCopy = async () => {
				  await navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
				  setCopied(true);
				  setTimeout(() => setCopied(false), 2000);
				};
  
				return !inline && match ? (
				  <div style={{ position: 'relative' }}>
					<button
					  onClick={handleCopy}
					  style={{
						position: 'absolute',
						top: '5px',
						right: '5px',
						background: '#333',
						color: '#fff',
						borderRadius: '3px',
						padding: '5px',
						cursor: 'pointer',
						zIndex: 10,
						borderColor: '#fff 2px solid', 
					  }}
					>
					  {copied ? 'Copied!' : 'Copy'}
					</button>

					<div className="code-container">
						<SyntaxHighlighter
							style={duotoneLight}
							language={match[1]}
							PreTag="div"
							{...props}
							>
								{String(children).replace(/\n$/, '')}
						</SyntaxHighlighter>
					</div>
				  </div>
				) : (
				  <code className={className} {...props}>
					{children}
				  </code>
				);
			  },
			}}
		  >
			{note.content}
		  </ReactMarkdown>
		</div>
  
		{contextMenu && (
		  <ContextMenu
			x={contextMenu.x}
			y={contextMenu.y}
			onEdit={() => {
			  setContextMenu(null);
			  onEdit(note);
			}}
			onDelete={() => {
			  setContextMenu(null);
			  setShowDeleteConfirm(true);
			}}
			onClose={() => setContextMenu(null)}
		  />
		)}
  
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
  
	if (isOrganized) {
	  return noteContent;
	}
  
	return (
	  <Draggable
		handle=".note-header"
		defaultPosition={note.position || { x: 0, y: 0 }}
		grid={[10, 10]}
		onStop={(e, data) => onDragStop(note.id, { x: data.x, y: data.y })}
	  >
		<div style={{ position: 'absolute' }}>
		  <Resizable
			width={note.width || 300}
			height={note.height || 200}
			minConstraints={[200, 150]}
			maxConstraints={[800, 600]}
			onResize={handleResize}
			resizeHandles={['se']}
		  >
			{noteContent}
		  </Resizable>
		</div>
	  </Draggable>
	);
});
Note.displayName = 'Note';


function App() {
	const [notes, setNotes] = useState([]);
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingNote, setEditingNote] = useState(null);
	const [showOptions, setShowOptions] = useState(false);
	const [isOrganized, setIsOrganized] = useState(false);
	const fileInputRef = useRef(null);

	useEffect(() => {
		const savedViewMode = localStorage.getItem('viewMode');
		if (savedViewMode !== null) {
			setIsOrganized(JSON.parse(savedViewMode));
		}
	}, []);

	const toggleViewMode = useCallback(() => {
		const newMode = !isOrganized;
		setIsOrganized(newMode);
		localStorage.setItem('viewMode', JSON.stringify(newMode));
	}, [isOrganized]);

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

	const handleAddNote = useCallback(async (title, content) => {
		const newNote = {
			id: nanoid(),
			title: title || 'Untitled',
			content,
			pinned: false,
			width: 300,
			height: 200,
			position: { x: 0, y: 0 }
		};

		await addNote(newNote);
		setShowAddModal(false);
		loadNotes();
	}, [loadNotes]);

	const handleSaveEdit = useCallback(async (title, content) => {
		if (!editingNote) return;

		const updatedNote = {
			...editingNote,
			title,
			content
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

	const handleResize = useCallback(async (id, size) => {
		const note = notes.find(n => n.id === id);
		if (!note) return;

		const updatedNote = {
			...note,
			width: size.width,
			height: size.height
		};

		await updateNote(updatedNote);
		loadNotes();
	}, [notes, loadNotes]);

	const handleDragStop = useCallback(async (id, position) => {
		const note = notes.find(n => n.id === id);
		if (!note) return;

		const updatedNote = {
			...note,
			position
		};

		await updateNote(updatedNote);
		loadNotes();
	}, [notes, loadNotes]);

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

	const savedPreviewState = localStorage.getItem('notePreviewState');
	const initialShowPreview = savedPreviewState !== null ? JSON.parse(savedPreviewState) : true;

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
							<div className="view-options">
								<button
									className={!isOrganized ? 'active' : ''}
									onClick={() => !isOrganized || toggleViewMode()}
								>
									Free Mode
								</button>
								<button
									className={isOrganized ? 'active' : ''}
									onClick={() => isOrganized || toggleViewMode()}
								>
									Organized Mode
								</button>
							</div>
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

			<div className={`notes-container ${isOrganized ? 'organized' : ''}`}>
				{isOrganized ? (
					<>
						{pinnedNotes.length > 0 && (
							<div className="notes-section">
								<h2 className="section-title">📌 Pinned Notes</h2>
								<div className="notes-grid">
									{pinnedNotes.map((note) => (
										<Note
											key={note.id}
											note={note}
											onTogglePin={handleTogglePin}
											onEdit={setEditingNote}
											onDelete={handleDeleteNote}
											onResize={handleResize}
											onDragStop={handleDragStop}
											isOrganized={true}
										/>
									))}
								</div>
							</div>
						)}
						<div className="notes-section">
							{pinnedNotes.length > 0 && <h2 className="section-title">Other Notes</h2>}
							<div className="notes-grid">
								{unpinnedNotes.map((note) => (
									<Note
										key={note.id}
										note={note}
										onTogglePin={handleTogglePin}
										onEdit={setEditingNote}
										onDelete={handleDeleteNote}
										onResize={handleResize}
										onDragStop={handleDragStop}
										isOrganized={true}
									/>
								))}
							</div>
						</div>
					</>
				) : (
					notes.map((note) => (
						<Note
							key={note.id}
							note={note}
							onTogglePin={handleTogglePin}
							onEdit={setEditingNote}
							onDelete={handleDeleteNote}
							onResize={handleResize}
							onDragStop={handleDragStop}
							isOrganized={false}
						/>
					))
				)}
			</div>

			{showAddModal && (
				<NoteModal
					isAdd={true}
					onClose={() => setShowAddModal(false)}
					onSave={handleAddNote}
					initialShowPreview={initialShowPreview}
				/>
			)}
			{editingNote && (
				<NoteModal
					isAdd={false}
					onClose={() => setEditingNote(null)}
					onSave={handleSaveEdit}
					initialTitle={editingNote.title}
					initialContent={editingNote.content}
					initialShowPreview={initialShowPreview}
				/>
			)}
		</div>
	);
}

export default App;