$ErrorActionPreference = "Continue"
# Build a motion Reel MP4 (1080x1920) from static scene frames.
# Ken Burns (zoompan) + xfade crossfades. No narration track (add in editor).

$ff = "C:\Users\hp\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Frames = Join-Path $Here "frames"
$Work   = Join-Path $Here "build"
if (Test-Path $Work) { Remove-Item -Recurse -Force $Work }
New-Item -ItemType Directory -Path $Work | Out-Null

$W = 1080; $H = 1920
$FPS = 30
$SceneDur = 5.3
$FramesPerScene = [int]($FPS * $SceneDur)
$XfadeDur = 0.7
$NumScenes = 6

$scenes = @(
  @{ file="scene1_problem.png";   dir="in"  },
  @{ file="scene2_solution.png";  dir="out" },
  @{ file="scene3_platforms.png"; dir="in"  },
  @{ file="scene4_benefits.png";  dir="out" },
  @{ file="scene5_dashboard.png"; dir="in"  },
  @{ file="scene6_cta.png";       dir="out" }
)

$clips = @()
for ($i = 0; $i -lt $NumScenes; $i++) {
  $img = Join-Path $Frames $scenes[$i].file
  $out = Join-Path $Work ("clip$($i+1).mp4")
  $dir = $scenes[$i].dir
  if ($dir -eq "in") {
    $zoom = "zoom+0.0008"
  } else {
    $zoom = "if(lte(zoom,1.0),1.15,max(1.001,zoom-0.0008))"
  }
  $x = "iw/2-(iw/zoom/2)"
  $y = "ih/2-(ih/zoom/2)"
  $vf = "scale=540:960:-1,zoompan=z='$zoom':x='$x':y='$y':d=${FramesPerScene}:s=540x960:fps=$FPS,scale=$W`:$H`:flags=lanczos,setsar=1,format=yuv420p"
  $ffargs = @("-y","-loop","1","-i",$img,"-vf",$vf,"-t",$SceneDur,"-r",$FPS,"-c:v","libx264","-preset","fast","-crf","20",$out)
  & $ff @ffargs 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Output ("ERROR building clip{0} exit={1}" -f ($i+1),$LASTEXITCODE); exit 1 }
  Write-Output ("built clip{0}.mp4" -f ($i+1))
  $clips += $out
}

$inputs = @()
foreach ($c in $clips) { $inputs += "-i"; $inputs += $c }

$parts = @()
$offset = 0.0
$prev = $null
for ($i = 0; $i -lt $NumScenes - 1; $i++) {
  $offset = [math]::Round($offset + $SceneDur - $XfadeDur, 3)
  if ($i -eq 0) {
    $parts += "[0:v][1:v]xfade=transition=fade:duration=${XfadeDur}:offset=${offset}[v1]"
    $prev = "v1"
  } else {
    $parts += "[$prev][$($i+1):v]xfade=transition=fade:duration=${XfadeDur}:offset=${offset}[v$($i+1)]"
    $prev = "v$($i+1)"
  }
}
$filter = $parts -join ";"

$finalOut = Join-Path $Here "reel_motion_1080x1920.mp4"
$fargs = @("-y") + $inputs + @("-filter_complex",$filter,"-map","[$prev]","-r",$FPS,"-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p","-movflags","+faststart",$finalOut)
& $ff @fargs 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Output ("ERROR final exit={0}" -f $LASTEXITCODE); exit 1 }
Write-Output "FINAL: $finalOut"
