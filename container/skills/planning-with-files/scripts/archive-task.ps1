param(
    [string]$TaskSlug = ""
)

if ($TaskSlug -eq "") {
    Write-Error "Usage: archive-task.ps1 <task-slug>"
    exit 1
}

if ($TaskSlug -in @(".", "..", "_template", "archive")) {
    Write-Error "Refusing to archive reserved task slug: $TaskSlug"
    exit 1
}

$PlansDir = "plans"
$SourceDir = Join-Path $PlansDir $TaskSlug
$ArchiveDir = Join-Path $PlansDir "archive"
$DestDir = Join-Path $ArchiveDir $TaskSlug

if (-not (Test-Path $SourceDir -PathType Container)) {
    Write-Error "Task directory not found: $SourceDir"
    exit 1
}

if (Test-Path $DestDir) {
    Write-Error "Archive target already exists: $DestDir"
    exit 1
}

New-Item -ItemType Directory -Force -Path $ArchiveDir | Out-Null
Move-Item -Path $SourceDir -Destination $DestDir
Write-Output "Archived $SourceDir -> $DestDir"
