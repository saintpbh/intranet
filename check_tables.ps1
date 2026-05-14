$connString = 'Server=mssql.nskorea.com;Database=prok.or.kr;User Id=prok.or.kr;Password=jOTy29{ox;TrustServerCertificate=True;'
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = ''BASE TABLE'''
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "Table: $($reader['TABLE_NAME'])"
    }
    $conn.Close()
} catch {
    Write-Host "Failed: $_"
}
