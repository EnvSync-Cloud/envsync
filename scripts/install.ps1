#!/usr/bin/env pwsh
#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Repo = "EnvSync-Cloud/envsync"
$Binary = "envsync"
$InstallDir = "$env:LOCALAPPDATA\envsync\bin"
$GitHubUrl = "https://github.com/${Repo}/releases/latest/download"

function Get-OS {
    return "windows"
}

function Get-Arch {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture
    switch ($arch) {
        "X64"  { return "amd64" }
        "Arm64" { return "arm64" }
        default { return "unknown" }
    }
}

function Main {
    $os = Get-OS
    $arch = Get-Arch

    if ($arch -eq "unknown") {
        Write-Error "Unable to detect architecture"
        exit 1
    }

    $filename = "${Binary}_${os}_${arch}.exe"
    $downloadUrl = "${GitHubUrl}/${filename}"

    Write-Host "Installing ${Binary}..."
    Write-Host "  OS:   ${os}"
    Write-Host "  Arch: ${arch}"
    Write-Host "  URL:  ${downloadUrl}"

    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

    Invoke-WebRequest -Uri $downloadUrl -OutFile "${InstallDir}\${Binary}.exe"

    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($currentPath -notlike "*$InstallDir*") {
        Write-Host "Adding ${InstallDir} to PATH..."
        [Environment]::SetEnvironmentVariable("PATH", "${currentPath};${InstallDir}", "User")
        $env:PATH = "${env:PATH};${InstallDir}"
    }

    Write-Host ""
    Write-Host "Installed ${Binary} to ${InstallDir}\${Binary}.exe"
    Write-Host ""

    & "${InstallDir}\${Binary}.exe" --version 2>$null | ForEach-Object { Write-Host "Version: $_" }

    Write-Host "Run 'envsync --help' to get started."
}

Main
