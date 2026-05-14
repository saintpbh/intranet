$connString = 'Server=192.168.0.145;Database=KJ_CHURCH;User Id=pbh;Password=prok3000;TrustServerCertificate=True;'
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
