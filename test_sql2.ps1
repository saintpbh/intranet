$connString = 'Server=127.0.0.1,1433;User Id=prok.or.kr;Password=jOTy29{ox;TrustServerCertificate=True;'
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
try {
    $conn.Open()
    Write-Host 'Connection Successful!'
    $conn.Close()
} catch {
    Write-Host "Connection Failed: $_"
}
