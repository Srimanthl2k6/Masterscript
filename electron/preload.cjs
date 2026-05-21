const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('masterscript', {
  isElectron: true,
  autosave: (project) => ipcRenderer.invoke('project:autosave', project),
  readAutosave: () => ipcRenderer.invoke('project:read-autosave'),
  saveProject: (project, title) =>
    ipcRenderer.invoke('project:save-file', { project, title }),
  saveProjectPath: (filePath, project) =>
    ipcRenderer.invoke('project:save-path', { filePath, project }),
  openProject: () => ipcRenderer.invoke('project:open-file'),
  openProjectPath: (filePath) => ipcRenderer.invoke('project:open-path', filePath),
  exportFountain: (title, content) =>
    ipcRenderer.invoke('project:export-fountain', { title, content }),
  importFountain: () => ipcRenderer.invoke('project:import-fountain'),
  importFdx: () => ipcRenderer.invoke('project:import-fdx'),
  exportFdx: (title, content) =>
    ipcRenderer.invoke('project:export-fdx', { title, content }),
  importDocx: () => ipcRenderer.invoke('project:import-docx'),
  exportDocx: (title, base64) =>
    ipcRenderer.invoke('project:export-docx', { title, base64 }),
  exportPdf: (title, base64) =>
    ipcRenderer.invoke('project:export-pdf', { title, base64 }),
  hostLanCollaboration: (options) =>
    ipcRenderer.invoke('collaboration:lan-host', options),
  joinLanCollaboration: (options) =>
    ipcRenderer.invoke('collaboration:lan-join', options),
  stopLanCollaboration: () => ipcRenderer.invoke('collaboration:lan-stop'),
  getLanCollaborationStatus: () => ipcRenderer.invoke('collaboration:lan-status'),
})
