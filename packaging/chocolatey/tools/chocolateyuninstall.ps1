$ErrorActionPreference = 'Stop'

$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
$found = Get-ItemProperty $uninstallKey -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'Hinterland*' }

foreach ($app in $found) {
  $uninstaller = $app.UninstallString
  if ($uninstaller) {
    $exe = ($uninstaller -split '"')[1]
    if (-not $exe) { $exe = $uninstaller }
    Uninstall-ChocolateyPackage -PackageName $env:ChocolateyPackageName -FileType 'exe' -SilentArgs '/S' -File $exe
  }
}
