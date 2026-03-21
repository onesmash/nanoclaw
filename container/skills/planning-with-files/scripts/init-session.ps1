# Backward-compatible wrapper for task workspace initialization
# Usage: .\init-session.ps1 [task-slug]

param(
    [string]$TaskSlug = "task"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $ScriptDir "init-multi-task.ps1") $TaskSlug
