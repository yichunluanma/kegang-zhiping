$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host '请先安装 Node.js 24 或更新版本。'; Read-Host '按回车结束'; exit 1 }
if (-not (Test-Path -LiteralPath 'node_modules\katex')) {
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Read-Host '依赖安装失败，按回车结束'; exit 1 }
}
$appPreviewUrl = 'http://127.0.0.1:3210'
if (Test-Path -LiteralPath '.env') {
  $appPortLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^PORT=\d+$' } | Select-Object -First 1
  if ($appPortLine) { $appPreviewUrl = 'http://127.0.0.1:' + ($appPortLine -replace '^PORT=', '') }
}
try { $appExisting = Invoke-RestMethod -Uri ($appPreviewUrl + '/api/health') -TimeoutSec 2 } catch { $appExisting = $null }
if ($appExisting.version -eq '0.1.0') { Start-Process $appPreviewUrl; Write-Host '应用已在运行。'; exit 0 }
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-File', ('"' + $PSScriptRoot + '\open-preview.ps1"'), '-Url', $appPreviewUrl) -WindowStyle Hidden
Write-Host '课纲智评正在启动。若页面尚未加载，请稍后刷新。关闭此窗口即可停止服务。'
& node server.mjs
Read-Host '服务已结束，按回车关闭'
