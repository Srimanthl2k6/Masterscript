param(
  [Parameter(Mandatory = $true)][string]$Executable,
  [Parameter(Mandatory = $true)][string]$Installer
)

$ErrorActionPreference = 'Stop'
$executablePath = (Resolve-Path -LiteralPath $Executable).Path
$applicationName = [IO.Path]::GetFileName($executablePath)
$profileDirectory = Join-Path ([IO.Path]::GetTempPath()) ('masterscript-benchmark-' + [guid]::NewGuid())
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$previousProfile = $env:WEBVIEW2_USER_DATA_FOLDER
$restorations = @()

try {
  $env:WEBVIEW2_USER_DATA_FOLDER = $profileDirectory
  if ($elevated) {
    Write-Host "Using temporary HKLM WebView2 policy for elevated benchmark: $applicationName"
    # WebView2 150+ ignores environment overrides in elevated hosts (including
    # GitHub's Windows runners). Scope temporary policy to this executable only.
    # https://github.com/MicrosoftEdge/WebView2Feedback/issues/5645#issuecomment-4934355430
    $settings = @{
      AdditionalBrowserArguments = '--remote-debugging-port=9339'
      UserDataFolder = $profileDirectory
    }
    foreach ($setting in $settings.GetEnumerator()) {
      $policyPath = 'HKLM:\Software\Policies\Microsoft\Edge\WebView2\' + $setting.Key
      if (-not (Test-Path -LiteralPath $policyPath)) {
        New-Item -Path $policyPath -Force | Out-Null
      }
      $key = Get-Item -LiteralPath $policyPath
      $existed = $key.GetValueNames() -contains $applicationName
      $restorations += @{
        Path = $policyPath
        Existed = $existed
        Value = $key.GetValue($applicationName)
        Kind = $(if ($existed) { $key.GetValueKind($applicationName) } else { 'String' })
      }
      New-ItemProperty -LiteralPath $policyPath -Name $applicationName -Value $setting.Value -PropertyType String -Force | Out-Null
    }
  }
  Write-Host "WebView2 benchmark profile: $profileDirectory"
  npm run benchmark:tauri -- "--executable=$executablePath" "--installer=$Installer"
  if ($LASTEXITCODE -ne 0) { throw "Tauri benchmark failed with exit code $LASTEXITCODE" }
} finally {
  foreach ($previous in $restorations) {
    if ($previous.Existed) {
      New-ItemProperty -LiteralPath $previous.Path -Name $applicationName -Value $previous.Value -PropertyType $previous.Kind -Force | Out-Null
    } else {
      Remove-ItemProperty -LiteralPath $previous.Path -Name $applicationName -ErrorAction SilentlyContinue
    }
  }
  $env:WEBVIEW2_USER_DATA_FOLDER = $previousProfile
}
