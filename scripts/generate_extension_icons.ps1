Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath([float]$bx, [float]$by, [float]$bw, [float]$bh, [float]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($bx, $by, [float]($radius * 2), [float]($radius * 2), 180, 90)
    $path.AddArc([float]($bx + $bw - $radius * 2), $by, [float]($radius * 2), [float]($radius * 2), 270, 90)
    $path.AddArc([float]($bx + $bw - $radius * 2), [float]($by + $bh - $radius * 2), [float]($radius * 2), [float]($radius * 2), 0, 90)
    $path.AddArc($bx, [float]($by + $bh - $radius * 2), [float]($radius * 2), [float]($radius * 2), 90, 90)
    $path.CloseFigure()
    return $path
}

function Start-NeocromBadge([int]$size, [ref]$bmpOut, [ref]$gOut) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $scale = [float]($size / 128.0)
    $path = New-RoundedRectPath ([float](4.0 * $scale)) ([float](4.0 * $scale)) ([float](120.0 * $scale)) ([float](120.0 * $scale)) ([float](28.0 * $scale))

    $p1 = New-Object System.Drawing.PointF 0, 0
    $p2 = New-Object System.Drawing.PointF ([float]$size), ([float]$size)
    $c1 = [System.Drawing.Color]::FromArgb(255, 22, 22, 22)
    $c2 = [System.Drawing.Color]::FromArgb(255, 11, 11, 11)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $p1, $p2, $c1, $c2
    $g.FillPath($bgBrush, $path)

    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 52, 52, 52)), ([float][Math]::Max(1.0, 2.8 * $scale))
    $g.DrawPath($borderPen, $path)

    $borderPen.Dispose()
    $bgBrush.Dispose()
    $path.Dispose()

    $bmpOut.Value = $bmp
    $gOut.Value = $g
}

function Create-FocusIcon([int]$size, [string]$outPath) {
    $bmp = $null; $g = $null
    Start-NeocromBadge $size ([ref]$bmp) ([ref]$g)
    $scale = [float]($size / 128.0)
    $center = [float]($size / 2.0)

    $ring1R = [float](36.0 * $scale)
    $ringPen1 = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 189, 189, 189)), ([float][Math]::Max(1.2, 4.5 * $scale))
    $g.DrawEllipse($ringPen1, [float]($center - $ring1R), [float]($center - $ring1R), [float]($ring1R * 2), [float]($ring1R * 2))

    $ring2R = [float](20.0 * $scale)
    $ringPen2 = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 140, 140, 140)), ([float][Math]::Max(1.0, 3.5 * $scale))
    $g.DrawEllipse($ringPen2, [float]($center - $ring2R), [float]($center - $ring2R), [float]($ring2R * 2), [float]($ring2R * 2))

    $dotR = [float](7.5 * $scale)
    $dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 248, 248, 248))
    $g.FillEllipse($dotBrush, [float]($center - $dotR), [float]($center - $dotR), [float]($dotR * 2), [float]($dotR * 2))

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dotBrush.Dispose(); $ringPen2.Dispose(); $ringPen1.Dispose(); $g.Dispose(); $bmp.Dispose()
}

function Create-PanelIcon([int]$size, [string]$outPath) {
    $bmp = $null; $g = $null
    Start-NeocromBadge $size ([ref]$bmp) ([ref]$g)
    $scale = [float]($size / 128.0)

    $winX = [float](24.0 * $scale)
    $winY = [float](26.0 * $scale)
    $winW = [float](80.0 * $scale)
    $winH = [float](76.0 * $scale)
    $winPath = New-RoundedRectPath $winX $winY $winW $winH ([float](10.0 * $scale))

    $winPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 189, 189, 189)), ([float][Math]::Max(1.2, 4.0 * $scale))
    $g.DrawPath($winPen, $winPath)

    $headerY = [float]($winY + 20.0 * $scale)
    $g.DrawLine($winPen, $winX, $headerY, [float]($winX + $winW), $headerY)

    $panelX = [float]($winX + 48.0 * $scale)
    $g.DrawLine($winPen, $panelX, $headerY, $panelX, [float]($winY + $winH))

    $panelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 248, 248, 248))
    $g.FillRectangle($panelBrush, [float]($panelX + 1.5 * $scale), [float]($headerY + 1.5 * $scale), [float]($winX + $winW - $panelX - 3.0 * $scale), [float]($winY + $winH - $headerY - 3.0 * $scale))

    $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 248, 248, 248)), ([float][Math]::Max(1.0, 3.0 * $scale))
    $g.DrawLine($linePen, [float]($winX + 9.0 * $scale), [float]($headerY + 15.0 * $scale), [float]($panelX - 9.0 * $scale), [float]($headerY + 15.0 * $scale))
    $g.DrawLine($linePen, [float]($winX + 9.0 * $scale), [float]($headerY + 29.0 * $scale), [float]($panelX - 9.0 * $scale), [float]($headerY + 29.0 * $scale))
    $g.DrawLine($linePen, [float]($winX + 9.0 * $scale), [float]($headerY + 43.0 * $scale), [float]($panelX - 18.0 * $scale), [float]($headerY + 43.0 * $scale))

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $linePen.Dispose(); $panelBrush.Dispose(); $winPen.Dispose(); $winPath.Dispose(); $g.Dispose(); $bmp.Dispose()
}

function Create-PassIcon([int]$size, [string]$outPath) {
    $bmp = $null; $g = $null
    Start-NeocromBadge $size ([ref]$bmp) ([ref]$g)
    $scale = [float]($size / 128.0)

    $shieldPts = @(
        (New-Object System.Drawing.PointF ([float](64.0 * $scale)), ([float](22.0 * $scale))),
        (New-Object System.Drawing.PointF ([float](98.0 * $scale)), ([float](36.0 * $scale))),
        (New-Object System.Drawing.PointF ([float](94.0 * $scale)), ([float](68.0 * $scale))),
        (New-Object System.Drawing.PointF ([float](64.0 * $scale)), ([float](104.0 * $scale))),
        (New-Object System.Drawing.PointF ([float](34.0 * $scale)), ([float](68.0 * $scale))),
        (New-Object System.Drawing.PointF ([float](30.0 * $scale)), ([float](36.0 * $scale)))
    )
    $shieldPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 189, 189, 189)), ([float][Math]::Max(1.3, 4.5 * $scale))
    $shieldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPolygon($shieldPen, $shieldPts)

    $keyPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 248, 248, 248)), ([float][Math]::Max(1.2, 4.5 * $scale))
    $keyPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $keyPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $r = [float](10.5 * $scale)
    $cx = [float](64.0 * $scale)
    $cy = [float](55.0 * $scale)
    $g.DrawEllipse($keyPen, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
    $g.DrawLine($keyPen, $cx, [float]($cy + $r), $cx, [float](82.0 * $scale))

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $keyPen.Dispose(); $shieldPen.Dispose(); $g.Dispose(); $bmp.Dispose()
}

$sizes = @(16, 32, 48, 128)

foreach ($target in @(
    @{ Dir = "src/extensions/horizonFocus/icons"; Fn = "Create-FocusIcon" },
    @{ Dir = "src/extensions/horizonPanel/icons"; Fn = "Create-PanelIcon" },
    @{ Dir = "src/extensions/horizonPass/icons"; Fn = "Create-PassIcon" }
)) {
    if (-not (Test-Path $target.Dir)) { New-Item -ItemType Directory -Path $target.Dir -Force | Out-Null }
    foreach ($s in $sizes) {
        $p = "$($target.Dir)/icon$s.png"
        & $target.Fn $s $p
        Write-Host "Created $p"
    }
}
