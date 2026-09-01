$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$W = 1080
$H = 1080
$OutPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "n8n_ad_dz_1080x1080.png"

function New-Color([int]$a, [int]$r, [int]$g, [int]$b) {
    return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

$cDark     = New-Color 255 10 15 31
$cDark2    = New-Color 255 20 31 58
$cCoral    = New-Color 255 255 109 90
$cTeal     = New-Color 255 45 212 191
$cAmber    = New-Color 255 250 204 21
$cWhite    = New-Color 255 255 255 255
$cGray     = New-Color 255 164 178 204
$cGreen    = New-Color 255 37 211 102
$cChipLine = New-Color 90 255 255 255

function RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $d = $r * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.StartFigure()
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function Draw-Glow($g, [float]$cx, [float]$cy, [float]$r, $color) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddEllipse($cx - $r, $cy - $r, $r * 2, $r * 2)
    $pb = New-Object System.Drawing.Drawing2D.PathGradientBrush($p)
    $pb.CenterColor = New-Color 150 $color.R $color.G $color.B
    $pb.SurroundColors = @(New-Color 0 $color.R $color.G $color.B)
    $pb.CenterPoint = New-Object System.Drawing.PointF($cx, ($cy + $r * 0.25))
    $g.FillPath($pb, $p)
    $pb.Dispose(); $p.Dispose()
}

function New-Rtlfmt {
    $f = New-Object System.Drawing.StringFormat
    $f.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft -bor [System.Drawing.StringFormatFlags]::NoClip
    $f.Alignment = [System.Drawing.StringAlignment]::Center
    $f.LineAlignment = [System.Drawing.StringAlignment]::Center
    return $f
}

function Get-FitFont($g, [string]$text, [string]$family, [float]$size, $style, [float]$maxW) {
    $f = New-Object System.Drawing.Font($family, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    while ($g.MeasureString($text, $f).Width -gt $maxW -and $f.Size -gt 24) {
        $f.Dispose()
        $size -= 4
        $f = New-Object System.Drawing.Font($family, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    }
    return $f
}

$bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

try {
    # --- Background gradient ---
    $bgRect = New-Object System.Drawing.RectangleF(0, 0, $W, $H)
    $lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, $cDark, $cDark2, 55)
    $g.FillRectangle($lg, $bgRect)
    $lg.Dispose()

    # --- Accent glows ---
    Draw-Glow $g 150 130 260 $cCoral
    Draw-Glow $g 980 950 300 $cTeal
    Draw-Glow $g 990 170 150 $cAmber

    # --- Flow chain (nodes + connectors) ---
    $linePen = New-Object System.Drawing.Pen((New-Color 110 255 255 255), 4)
    $g.DrawLine($linePen, 152, 210, 458, 210)
    $g.DrawLine($linePen, 622, 210, 928, 210)
    $linePen.Dispose()

    function Draw-Node($g, [float]$x, [float]$y, $outer, $inner, [float]$r) {
        $ringPen = New-Object System.Drawing.Pen((New-Color 230 $outer.R $outer.G $outer.B), 3)
        $g.DrawEllipse($ringPen, ($x - $r), ($y - $r), ($r * 2), ($r * 2))
        $brush = New-Object System.Drawing.SolidBrush($inner)
        $g.FillEllipse($brush, ($x - ($r * 0.55)), ($y - ($r * 0.55)), ($r * 1.1), ($r * 1.1))
        $ringPen.Dispose(); $brush.Dispose()
    }
    Draw-Node $g 150 210 $cCoral $cCoral 18
    Draw-Node $g 310 210 $cCoral $cCoral 12
    Draw-Node $g 770 210 $cTeal $cTeal 12
    Draw-Node $g 930 210 $cTeal $cTeal 18

    # Arrowheads pointing inward
    $arrPen = New-Object System.Drawing.Pen($cCoral, 6)
    $arrPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $arrPen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
    $g.DrawLine($arrPen, 200, 210, 455, 210)
    $arrPen.Dispose()
    $arrPen2 = New-Object System.Drawing.Pen($cTeal, 6)
    $arrPen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $arrPen2.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
    $g.DrawLine($arrPen2, 625, 210, 880, 210)
    $arrPen2.Dispose()

    # --- n8n badge ---
    $bRect = RoundedRectPath 465 135 150 150 38
    $bFill = New-Object System.Drawing.SolidBrush((New-Color 255 22 28 51))
    $g.FillPath($bFill, $bRect)
    $bFill.Dispose()
    $bPen = New-Object System.Drawing.Pen($cCoral, 7)
    $g.DrawPath($bPen, $bRect)
    $bPen.Dispose()
    $bRect.Dispose()

    $nFont = New-Object System.Drawing.Font("Segoe UI", 56, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $nfmt = New-Object System.Drawing.StringFormat
    $nfmt.Alignment = [System.Drawing.StringAlignment]::Center
    $nfmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $nRect = New-Object System.Drawing.RectangleF(465, 132, 150, 155)
    $g.DrawString("n8n", $nFont, (New-Object System.Drawing.SolidBrush($cWhite)), $nRect, $nfmt)
    $nFont.Dispose(); $nfmt.Dispose()

    # --- Headline ---
    $fmt = New-Rtlfmt
    $headBrush = New-Object System.Drawing.SolidBrush($cWhite)
    $headFont = Get-FitFont $g "أتمتة أعمالك بلا برمجة" "Segoe UI" 78 ([System.Drawing.FontStyle]::Bold) 950
    $headRect = New-Object System.Drawing.RectangleF(65, 455, 950, 165)
    $g.DrawString("أتمتة أعمالك بلا برمجة", $headFont, $headBrush, $headRect, $fmt)
    $headFont.Dispose(); $headBrush.Dispose()

    # --- Subhead ---
    $subBrush = New-Object System.Drawing.SolidBrush($cGray)
    $subFont = Get-FitFont $g "خدمة n8n Self-Hosted كاملة فالدزاير" "Segoe UI" 40 ([System.Drawing.FontStyle]::Regular) 900
    $subRect = New-Object System.Drawing.RectangleF(90, 645, 900, 85)
    $g.DrawString("خدمة n8n Self-Hosted كاملة فالدزاير", $subFont, $subBrush, $subRect, $fmt)
    $subFont.Dispose(); $subBrush.Dispose()

    # --- Chips ---
    $chipLabels = @("بدون برمجة", "استضافة 24/7", "دعم بالدريجة")
    $chipFont = New-Object System.Drawing.Font("Segoe UI", 27, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $chips = @()
    foreach ($t in $chipLabels) {
        $tw = $g.MeasureString($t, $chipFont).Width
        $chips += @{ Text = $t; W = [float]($tw + 60) }
    }
    $gap = 30.0
    $total = ($chips | ForEach-Object { $_.W }) + ($gap * ($chips.Count - 1)) | Measure-Object -Sum | Select-Object -ExpandProperty Sum
    $x = ($W - $total) / 2
    foreach ($ch in $chips) {
        $h = 66
        $y = 760
        $cp = RoundedRectPath $x $y $ch.W $h 33
        $chFill = New-Object System.Drawing.SolidBrush((New-Color 26 255 255 255))
        $g.FillPath($chFill, $cp)
        $chFill.Dispose()
        $chPen = New-Object System.Drawing.Pen($cChipLine, 2)
        $g.DrawPath($chPen, $cp)
        $chPen.Dispose()
        $cp.Dispose()
        $chFmt = New-Rtlfmt
        $chBrush = New-Object System.Drawing.SolidBrush($cWhite)
        $chRect = New-Object System.Drawing.RectangleF($x, $y, $ch.W, $h)
        $g.DrawString($ch.Text, $chipFont, $chBrush, $chRect, $chFmt)
        $chBrush.Dispose(); $chFmt.Dispose()
        $x += $ch.W + $gap
    }
    $chipFont.Dispose()

    # --- CTA button ---
    $ctaFont = New-Object System.Drawing.Font("Segoe UI", 42, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $btnText = "تواصل معنا عبر واتساب"
    $btnW = [float]($g.MeasureString($btnText, $ctaFont).Width + 140)
    $btnX = ($W - $btnW) / 2
    $btnY = 880.0
    $btnH = 108.0

    $shadow = RoundedRectPath ($btnX + 6) ($btnY + 8) $btnW $btnH 54
    $shBrush = New-Object System.Drawing.SolidBrush((New-Color 90 0 0 0))
    $g.FillPath($shBrush, $shadow)
    $shBrush.Dispose(); $shadow.Dispose()

    $btnPath = RoundedRectPath $btnX $btnY $btnW $btnH 54
    $btnBrush = New-Object System.Drawing.SolidBrush($cGreen)
    $g.FillPath($btnBrush, $btnPath)
    $btnBrush.Dispose()

    # chat bubble icon (WhatsApp vibe)
    $cx = $btnX + 62
    $by = $btnY + 19.0
    $bw = 70.0
    $bh = 70.0
    $bubble = RoundedRectPath ($cx - $bw / 2) $by $bw $bh 16
    $bubBrush = New-Object System.Drawing.SolidBrush($cWhite)
    $g.FillPath($bubBrush, $bubble)
    $bubBrush.Dispose()
    $tail = New-Object System.Drawing.Drawing2D.GraphicsPath
    $tail.StartFigure()
    $tail.AddLine(($cx - $bw / 2), ($by + $bh - 18), ($cx - $bw / 2 - 12), ($by + $bh + 4))
    $tail.AddLine(($cx - $bw / 2 - 12), ($by + $bh + 4), ($cx - $bw / 2 + 4), ($by + $bh - 14))
    $tail.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush($cWhite)), $tail)
    $tail.Dispose()
    $dotBrush = New-Object System.Drawing.SolidBrush($cGreen)
    foreach ($d in @(@(-14, 4), @(0, 6), @(14, 8))) {
        $g.FillEllipse($dotBrush, ($cx + $d[0] - $d[1]), ($by + $bh - 24 - $d[1]), ($d[1] * 2), ($d[1] * 2))
    }
    $dotBrush.Dispose()
    $bubble.Dispose()

    $ctaFmt = New-Rtlfmt
    $ctaRect = New-Object System.Drawing.RectangleF(($btnX + 110), $btnY, ($btnW - 130), $btnH)
    $ctaBrush = New-Object System.Drawing.SolidBrush($cWhite)
    $g.DrawString($btnText, $ctaFont, $ctaBrush, $ctaRect, $ctaFmt)
    $ctaBrush.Dispose(); $ctaFmt.Dispose(); $ctaFont.Dispose()
    $btnPath.Dispose()

    # --- Footer ---
    $footBrush = New-Object System.Drawing.SolidBrush((New-Color 255 130 144 168))
    $footFont = New-Object System.Drawing.Font("Segoe UI", 25, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $footRect = New-Object System.Drawing.RectangleF(90, 1015, 900, 50)
    $g.DrawString("بداية سريعة • ضمان الخدمة • توريال بالدريجة", $footFont, $footBrush, $footRect, $fmt)
    $footFont.Dispose(); $footBrush.Dispose(); $fmt.Dispose()

    # --- Corner accent frames (adds "ad" polish) ---
    $edge = New-Object System.Drawing.Pen($cCoral, 6)
    $g.DrawArc($edge, 26, 26, 120, 120, 180, 90)
    $g.DrawArc($edge, $W - 146, 26, 120, 120, 270, 90)
    $edge.Dispose()
    $edge2 = New-Object System.Drawing.Pen($cTeal, 6)
    $g.DrawArc($edge2, 26, $H - 146, 120, 120, 90, 90)
    $g.DrawArc($edge2, $W - 146, $H - 146, 120, 120, 0, 90)
    $edge2.Dispose()

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Saved: $OutPath"
}
finally {
    $g.Dispose()
    $bmp.Dispose()
}