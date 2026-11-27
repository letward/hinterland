; Neocrom Horizon Windows Browser Registration & Installer Hooks
; Hand-tailored NSIS script registering Neocrom Horizon's Windows Default Apps
; capabilities, URL protocols (http, https, horizon) and HTML associations.

!macro customInstall
  ; Clean up legacy Hinterland registry keys on upgrade
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Hinterland"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Hinterland"
  DeleteRegKey HKCU "Software\Classes\HinterlandHTML"
  DeleteRegKey HKCU "Software\Classes\hinterland"

  ; Register Neocrom Horizon under RegisteredApplications so Windows Settings > Default Apps lists it cleanly
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon" "" "Neocrom Horizon"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\DefaultIcon" "" "$INSTDIR\Neocrom Horizon.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\shell\open\command" "" '"$INSTDIR\Neocrom Horizon.exe"'

  ; Capabilities metadata for Windows Default Programs UI
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities" "ApplicationName" "Neocrom Horizon"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities" "ApplicationDescription" "Neocrom Horizon — fast, private, customizable Chromium browser built for the Neocrom ecosystem."
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities" "ApplicationIcon" "$INSTDIR\Neocrom Horizon.exe,0"

  ; Declare supported URL protocols
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities\URLAssociations" "http" "NeocromHorizonHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities\URLAssociations" "https" "NeocromHorizonHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities\URLAssociations" "horizon" "NeocromHorizonHTML"

  ; Declare supported HTML file associations
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities\FileAssociations" ".htm" "NeocromHorizonHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities\FileAssociations" ".html" "NeocromHorizonHTML"

  ; Expose Neocrom Horizon in RegisteredApplications
  WriteRegStr HKCU "Software\RegisteredApplications" "Neocrom Horizon" "Software\Clients\StartMenuInternet\Neocrom Horizon\Capabilities"

  ; Define NeocromHorizonHTML ProgID class
  WriteRegStr HKCU "Software\Classes\NeocromHorizonHTML" "" "Neocrom Horizon HTML Document"
  WriteRegStr HKCU "Software\Classes\NeocromHorizonHTML\DefaultIcon" "" "$INSTDIR\Neocrom Horizon.exe,0"
  WriteRegStr HKCU "Software\Classes\NeocromHorizonHTML\shell\open\command" "" '"$INSTDIR\Neocrom Horizon.exe" "%1"'

  ; Register custom protocol handler for horizon://
  WriteRegStr HKCU "Software\Classes\horizon" "" "URL:Neocrom Horizon Protocol"
  WriteRegStr HKCU "Software\Classes\horizon" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\horizon\DefaultIcon" "" "$INSTDIR\Neocrom Horizon.exe,0"
  WriteRegStr HKCU "Software\Classes\horizon\shell\open\command" "" '"$INSTDIR\Neocrom Horizon.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Neocrom Horizon"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Neocrom Horizon"
  DeleteRegKey HKCU "Software\Classes\NeocromHorizonHTML"
  DeleteRegKey HKCU "Software\Classes\horizon"
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Hinterland"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Hinterland"
  DeleteRegKey HKCU "Software\Classes\HinterlandHTML"
  DeleteRegKey HKCU "Software\Classes\hinterland"
!macroend
