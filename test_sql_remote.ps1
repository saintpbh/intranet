$connString = 'Server=mssql.nskorea.com;User Id=prok.or.kr;Password=jOTy29{ox;TrustServerCertificate=True;'
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
try {
    $conn.Open()
    Write-Host 'Connection Successful!'
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = 'SELECT name FROM sys.databases'
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "Database: $($reader['name'])"
    }
    $conn.Close()
} catch {
    Write-Host "Connection Failed: $_"
}
