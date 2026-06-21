!macro NSIS_HOOK_PREINSTALL
  ; The final Electron bridge was installed by electron-builder in this path.
  ; Remove only that application directory; user projects and migration data
  ; live under AppData\Roaming\MasterScript and are intentionally preserved.
  IfFileExists "$LOCALAPPDATA\Programs\MasterScript\Uninstall MasterScript.exe" 0 electron_cleanup_done
    ExecWait '"$LOCALAPPDATA\Programs\MasterScript\Uninstall MasterScript.exe" /S' $0
  electron_cleanup_done:
!macroend

!macro NSIS_HOOK_POSTINSTALL
  RMDir /r "$LOCALAPPDATA\Programs\MasterScript"
!macroend
