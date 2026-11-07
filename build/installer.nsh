; ==============================================================================
; Hinterland Browser - Hand-Tailored NSIS Installer Extension
; Simplifies installation: per-user zero-prompt setup, registers browser
; capabilities, URL protocols (http, https, hinterland) and HTML associations.
; ==============================================================================

!macro customInstall
  DetailPrint "Configuring Hinterland browser integration..."

  ; Register in Windows StartMenuInternet (Default Programs)
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland" "" "Hinterland"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\DefaultIcon" "" "$INSTDIR\Hinterland.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\shell\open\command" "" '"$INSTDIR\Hinterland.exe"'

  ; Register Browser Capabilities for Windows 10 & 11 Default Apps settings
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\Capabilities" "ApplicationName" "Hinterland"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\Capabilities" "ApplicationDescription" "A fast, secure and freely customisable browser."
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\Capabilities" "ApplicationIcon" "$INSTDIR\Hinterland.exe,0"

  ; URL protocol associations
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\Capabilities\URLAssociations" "http" "HinterlandHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\Capabilities\URLAssociations" "https" "HinterlandHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\Capabilities\URLAssociations" "hinterland" "HinterlandHTML"

  ; File type associations
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\Capabilities\FileAssociations" ".htm" "HinterlandHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Hinterland\Capabilities\FileAssociations" ".html" "HinterlandHTML"

  ; Register in Windows RegisteredApplications
  WriteRegStr HKCU "Software\RegisteredApplications" "Hinterland" "Software\Clients\StartMenuInternet\Hinterland\Capabilities"

  ; Register ProgID HinterlandHTML
  WriteRegStr HKCU "Software\Classes\HinterlandHTML" "" "Hinterland HTML Document"
  WriteRegStr HKCU "Software\Classes\HinterlandHTML\DefaultIcon" "" "$INSTDIR\Hinterland.exe,0"
  WriteRegStr HKCU "Software\Classes\HinterlandHTML\shell\open\command" "" '"$INSTDIR\Hinterland.exe" "%1"'

  ; Register custom protocol handler for hinterland://
  WriteRegStr HKCU "Software\Classes\hinterland" "" "URL:Hinterland Protocol"
  WriteRegStr HKCU "Software\Classes\hinterland" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\hinterland\DefaultIcon" "" "$INSTDIR\Hinterland.exe,0"
  WriteRegStr HKCU "Software\Classes\hinterland\shell\open\command" "" '"$INSTDIR\Hinterland.exe" "%1"'
!macroend

!macro customUnInstall
  DetailPrint "Cleaning up Hinterland browser integration..."

  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Hinterland"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Hinterland"
  DeleteRegKey HKCU "Software\Classes\HinterlandHTML"
  DeleteRegKey HKCU "Software\Classes\hinterland"
!macroend
