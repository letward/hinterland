$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/letward/Hinterland/releases/download/v1.39.0/Hinterland-Setup-1.39.0.exe'
  checksum64     = 'ac5886afdb447eec7e1fa19f406971f382bd35ffb195e20ae3c1bf2fb68582b6'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'Hinterland Browser*'
}

Install-ChocolateyPackage @packageArgs
