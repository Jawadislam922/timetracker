'use strict';

const axios = require('axios');
const fs = require('node:fs');
const FormData = require('form-data');
const store = require('./store');
const { DEFAULTS } = require('./config');

function baseUrl() {
  return (store.get('apiBaseUrl') || DEFAULTS.apiBaseUrl).replace(/\/+$/, '');
}

function client() {
  const token = store.get('token');
  return axios.create({
    baseURL: baseUrl() + '/api/desktop',
    timeout: 20000,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function login({ email, password, deviceName, apiBaseUrl }) {
  if (apiBaseUrl) {
    store.set('apiBaseUrl', apiBaseUrl.replace(/\/+$/, ''));
  }
  const url = baseUrl() + '/api/desktop/login';
  const res = await axios.post(url, {
    email,
    password,
    device_name: deviceName,
  }, { timeout: 20000, headers: { Accept: 'application/json' } });

  store.set('token', res.data.token);
  store.set('user', res.data.user);
  store.set('deviceName', deviceName);
  return res.data.user;
}

async function logout() {
  try {
    await client().post('/logout');
  } catch {
    // ignore; we wipe the local token anyway
  }
  store.delete('token');
  store.delete('user');
}

async function me() {
  const res = await client().get('/me');
  return res.data;
}

async function getClients() {
  const res = await client().get('/clients');
  return res.data.clients;
}

async function getWorkTypes() {
  const res = await client().get('/work-types');
  return res.data.work_types;
}

async function getUpworkProfiles() {
  const res = await client().get('/upwork-profiles');
  return res.data.profiles;
}

async function getSettings() {
  const res = await client().get('/settings');
  return res.data.settings;
}

async function startSession(payload) {
  const res = await client().post('/sessions/start', payload);
  return res.data;
}

async function heartbeat(sessionId, payload) {
  const res = await client().patch(`/sessions/${sessionId}/heartbeat`, payload);
  return res.data;
}

async function stopSession(sessionId, payload) {
  const res = await client().post(`/sessions/${sessionId}/stop`, payload);
  return res.data;
}

async function uploadScreenshot(localPath, payload) {
  const form = new FormData();
  form.append('tracking_session_id', String(payload.tracking_session_id));
  form.append('captured_at', payload.captured_at);
  if (payload.activity_percent != null) form.append('activity_percent', String(payload.activity_percent));
  if (payload.keyboard_count != null) form.append('keyboard_count', String(payload.keyboard_count));
  if (payload.mouse_count != null) form.append('mouse_count', String(payload.mouse_count));
  if (payload.active_app) form.append('active_app', payload.active_app);
  if (payload.active_window_title) form.append('active_window_title', payload.active_window_title);
  if (payload.url_domain) form.append('url_domain', payload.url_domain);
  form.append('image', fs.createReadStream(localPath));

  const token = store.get('token');
  const res = await axios.post(baseUrl() + '/api/desktop/screenshots', form, {
    timeout: 60000,
    maxBodyLength: Infinity,
    headers: {
      ...form.getHeaders(),
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res.data;
}

async function sendActivityBatch(payload) {
  const res = await client().post('/activity/batch', payload);
  return res.data;
}

function isOnline(error) {
  // axios network error has no response; treat anything without response as offline
  return !!(error && error.response);
}

module.exports = {
  baseUrl,
  login,
  logout,
  me,
  getClients,
  getWorkTypes,
  getUpworkProfiles,
  getSettings,
  startSession,
  heartbeat,
  stopSession,
  uploadScreenshot,
  sendActivityBatch,
  isOnline,
};
