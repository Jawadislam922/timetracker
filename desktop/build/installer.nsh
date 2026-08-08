; Custom NSIS include for SA Track.
;
; Force-close any running instance before installing. SA Track is an Electron
; app with a tray icon and several helper processes (all named the same exe),
; so the installer's default "please close the app" check can get stuck on
; "SA Track cannot be closed. Please close it manually and click Retry."
; Defining customCheckAppRunning overrides that check with a hard taskkill,
; so updates/installs proceed without user prompts.
;
; NEVER add /T here. During an auto-update, electron-updater spawns THIS
; installer as a CHILD PROCESS of the running SA Track.exe. taskkill's /T flag
; kills matched processes AND their entire child trees - which includes the
; installer itself. The result on the 0.4.7->0.4.9 update (2026-07-31) was the
; installer dying between its uninstall and install phases, leaving every
; machine in the fleet with NO APP AT ALL: install dir emptied, registry entry
; gone, staged update orphaned. Trackers were silent for 9 days.
; /IM alone is sufficient: every Electron helper process shares the same exe
; name, so they all match by image name - while the installer (named
; "SA Track Setup X.Y.Z.exe") can never match, and therefore can never be
; killed by its own cleanup step.
!macro customCheckAppRunning
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Sleep 1500
!macroend
