$server = "192.168.0.145"
$user = "pbh"
$password = "prok3000"

$connString = "Server=$server;User Id=$user;Password=$password;"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connString)
    $conn.Open()
    Write-Host "Connected successfully."
    $cmd = $conn.CreateCommand()
    
    try {
        $cmd.CommandText = "EXEC sp_databases"
        $reader = $cmd.ExecuteReader()
        Write-Host "--- Databases (sp_databases) ---"
        while ($reader.Read()) {
            Write-Host $reader["DATABASE_NAME"]
        }
        $reader.Close()
    } catch {
        Write-Host "Could not list databases: $($_.Exception.Message)"
    }
    
    try {
        $cmd.CommandText = "SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES"
        $reader = $cmd.ExecuteReader()
        Write-Host "--- Tables in current DB ---"
        while ($reader.Read()) {
            Write-Host ($reader["TABLE_CATALOG"].ToString() + "." + $reader["TABLE_SCHEMA"].ToString() + "." + $reader["TABLE_NAME"].ToString())
        }
        $reader.Close()
    } catch {
        Write-Host "Could not list tables: $($_.Exception.Message)"
    }
    
    $conn.Close()
} catch {
    Write-Error $_.Exception.Message
}
