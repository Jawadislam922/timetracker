'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  auth: {
    login: (payload) => ipcRenderer.invoke('auth:login', payload),
    logout: () => ipcRenderer.invoke('auth:logout'),
    me: () => ipcRenderer.invoke('auth:me'),
    state: () => ipcRenderer.invoke('auth:state'),
  },
  settings: {
    setApiBaseUrl: (url) => ipcRenderer.invoke('settings:apiBaseUrl:set', url),
  },
  meta: {
    clients: () => ipcRenderer.invoke('meta:clients'),
    workTypes: () => ipcRenderer.invoke('meta:workTypes'),
    upworkProfiles: () => ipcRenderer.invoke('meta:upworkProfiles'),
    settings: () => ipcRenderer.invoke('meta:settings'),
  },
  tracker: {
    start: (opts) => ipcRenderer.invoke('tracker:start', opts),
    stop: (opts) => ipcRenderer.invoke('tracker:stop', opts),
    status: () => ipcRenderer.invoke('tracker:status'),
    onChanged: (cb) => {
      const listener = (_e, status) => cb(status);
      ipcRenderer.on('tracker:changed', listener);
      return () => ipcRenderer.removeListener('tracker:changed', listener);
    },
    onStopped: (cb) => {
      const listener = (_e, session) => cb(session);
      ipcRenderer.on('tracker:stopped', listener);
      return () => ipcRenderer.removeListener('tracker:stopped', listener);
    },
    onWarning: (cb) => {
      const listener = (_e, message) => cb(message);
      ipcRenderer.on('tracker:warning', listener);
      return () => ipcRenderer.removeListener('tracker:warning', listener);
    },
  },
};

contextBridge.exposeInMainWorld('tt', api);
