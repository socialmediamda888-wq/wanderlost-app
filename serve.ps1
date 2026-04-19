$port = 8080
$prefix = "http://localhost:$port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Wanderlost server running at $prefix"
Write-Host "Press Ctrl+C to stop"
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.json' = 'application/json'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.webp' = 'image/webp'
    '.webm' = 'video/webm'
}
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $response = $context.Response
            $path = $request.Url.LocalPath
            if ($path -eq '/') { $path = '/index.html' }
            $filePath = Join-Path $root $path.TrimStart('/')
            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath)
                $contentType = $mimeTypes[$ext]
                if (-not $contentType) { $contentType = 'application/octet-stream' }
                $response.ContentType = $contentType
                $response.StatusCode = 200
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
            $response.Close()
            Write-Host "$([DateTime]::Now.ToString('HH:mm:ss')) $($request.HttpMethod) $path -> $($response.StatusCode)"
        } catch {
            # Silently handle broken connections (browser disconnects, etc.)
            Write-Host "$([DateTime]::Now.ToString('HH:mm:ss')) WARN: $($_.Exception.Message)"
        }
    }
} finally {
    $listener.Stop()
}
