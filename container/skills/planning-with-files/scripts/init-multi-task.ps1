param(
    [string]$TaskSlug = ""
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$TemplateDir = Join-Path $SkillDir "templates"
$PlansDir = "plans"

New-Item -ItemType Directory -Force -Path (Join-Path $PlansDir "_template") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PlansDir "archive") | Out-Null

function Copy-IfMissing {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Destination)) {
        Copy-Item $Source $Destination
        Write-Output "Created $Destination"
    } else {
        Write-Output "Exists  $Destination"
    }
}

Copy-IfMissing (Join-Path $TemplateDir "multi-task-README.md") (Join-Path $PlansDir "README.md")
Copy-IfMissing (Join-Path $TemplateDir "multi-task-INDEX.md") (Join-Path $PlansDir "INDEX.md")
Copy-IfMissing (Join-Path $TemplateDir "task_plan.md") (Join-Path $PlansDir "_template/task_plan.md")
Copy-IfMissing (Join-Path $TemplateDir "findings.md") (Join-Path $PlansDir "_template/findings.md")
Copy-IfMissing (Join-Path $TemplateDir "progress.md") (Join-Path $PlansDir "_template/progress.md")

if ($TaskSlug -ne "") {
    $TaskDir = Join-Path $PlansDir $TaskSlug
    New-Item -ItemType Directory -Force -Path $TaskDir | Out-Null
    Copy-IfMissing (Join-Path $TemplateDir "task_plan.md") (Join-Path $TaskDir "task_plan.md")
    Copy-IfMissing (Join-Path $TemplateDir "findings.md") (Join-Path $TaskDir "findings.md")
    Copy-IfMissing (Join-Path $TemplateDir "progress.md") (Join-Path $TaskDir "progress.md")
    Write-Output ""
    Write-Output "Task directory ready: $TaskDir"
    Write-Output "Next: cd $TaskDir"
} else {
    Write-Output ""
    Write-Output "Multi-task planning layout ready in $PlansDir"
    Write-Output "Archive directory ready: $(Join-Path $PlansDir "archive")"
    Write-Output "Next: re-run with a task slug, or create a task directory under $PlansDir/"
}
