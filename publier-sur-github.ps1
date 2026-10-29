# Publie le site Ōshō sur GitHub.
#
# 1. Créez un dépôt VIDE sur https://github.com/new (ne cochez ni README, ni .gitignore, ni licence).
# 2. Dans ce dossier, lancez :
#      powershell -ExecutionPolicy Bypass -File .\publier-sur-github.ps1
#    puis collez l'adresse du dépôt, par exemple https://github.com/votre-nom/osho.git
#    (ou passez-la directement : ... -File .\publier-sur-github.ps1 https://github.com/votre-nom/osho.git)
#
# Le script enregistre les derniers changements, relie le dossier au dépôt et envoie la branche main.
# GitHub vous demandera de vous connecter la première fois (fenêtre du navigateur).
param([string]$Url)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git n'est pas installé : https://git-scm.com/download/win"
  exit 1
}
if (-not (Test-Path .git)) { git init -b main | Out-Null }

if (-not $Url) { $Url = Read-Host "Adresse du dépôt GitHub (https://github.com/.../....git)" }
$Url = $Url.Trim()
if ($Url -notmatch '^(https://github\.com/|git@github\.com:)') {
  Write-Host "Adresse inattendue : $Url"
  exit 1
}

# derniers changements éventuels
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "Mise a jour du site" | Out-Null }

$remotes = @(git remote)
if ($remotes -contains 'origin') { git remote set-url origin $Url } else { git remote add origin $Url }
git branch -M main
git push -u origin main
if ($LASTEXITCODE -eq 0) { Write-Host "Publié : $Url" } else { Write-Host "L'envoi a échoué : vérifiez l'adresse et votre connexion à GitHub." }
